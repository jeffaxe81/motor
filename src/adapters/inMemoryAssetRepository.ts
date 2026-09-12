import type {
  Asset, AssetAuditEntry, AssetBounds, AssetDispatchReference, AssetEvidence, AssetInspection, AssetLocation,
  AssetMaintenance, AssetRelation, AssetSearchInput, AssetSearchResult, AssetVersionSnapshot,
} from "../domain/asset.js";
import { codeConflictError } from "../domain/asset.js";
import type { AssetRepository, AssetUpdateResult } from "../application/assetRepository.js";

const assetKey = (tenantId: string, assetId: string) => `${tenantId}\u0000${assetId}`;
const codeKey = (tenantId: string, code: string) => `${tenantId}\u0000${code}`;
const dispatchKey = (tenantId: string, assetId: string, idempotencyKey: string) => `${tenantId}\u0000${assetId}\u0000${idempotencyKey}`;
function cloneAsset(asset: Asset): Asset { return { ...asset, technicalData: structuredClone(asset.technicalData), createdAt: new Date(asset.createdAt), updatedAt: new Date(asset.updatedAt) }; }
function cloneAudit(entry: AssetAuditEntry): AssetAuditEntry { return { ...entry, occurredAt: new Date(entry.occurredAt) }; }
function cloneSnapshot(snapshot: AssetVersionSnapshot): AssetVersionSnapshot { return { ...snapshot, technicalData: structuredClone(snapshot.technicalData), changedAt: new Date(snapshot.changedAt) }; }
function cloneLocation(location: AssetLocation): AssetLocation { return { ...location, updatedAt: new Date(location.updatedAt) }; }
function cloneEvidence(evidence: AssetEvidence): AssetEvidence { return { ...evidence, createdAt: new Date(evidence.createdAt) }; }
function cloneInspection(inspection: AssetInspection): AssetInspection { return { ...inspection, responses: structuredClone(inspection.responses), evidenceIds: [...inspection.evidenceIds], ...(inspection.location ? { location: { ...inspection.location } } : {}), createdAt: new Date(inspection.createdAt) }; }
function cloneMaintenance(record: AssetMaintenance): AssetMaintenance { return { ...record, parts: structuredClone(record.parts), costs: structuredClone(record.costs), ...(record.warranty ? { warranty: structuredClone(record.warranty) } : {}), ...(record.links ? { links: structuredClone(record.links) } : {}), createdAt: new Date(record.createdAt) }; }
function cloneRelation(relation: AssetRelation): AssetRelation { return { ...relation, createdAt: new Date(relation.createdAt) }; }
function cloneDispatchReference(reference: AssetDispatchReference): AssetDispatchReference { return { ...reference, createdAt: new Date(reference.createdAt) }; }
function snapshotFor(asset: Asset, audit: AssetAuditEntry): AssetVersionSnapshot { return { tenantId: asset.tenantId, assetId: asset.id, version: asset.version, code: asset.code, name: asset.name, assetType: asset.assetType, status: asset.status, technicalData: structuredClone(asset.technicalData), changedAt: audit.occurredAt, changedBy: audit.actorUserId, reason: audit.reason, origin: audit.origin, correlationId: audit.correlationId }; }

export class InMemoryAssetRepository implements AssetRepository {
  private readonly assets = new Map<string, Asset>();
  private readonly codes = new Map<string, string>();
  private readonly audit: AssetAuditEntry[] = [];
  private readonly versions = new Map<string, AssetVersionSnapshot[]>();
  private readonly locations = new Map<string, AssetLocation>();
  private readonly evidence = new Map<string, AssetEvidence[]>();
  private readonly inspections = new Map<string, AssetInspection[]>();
  private readonly maintenance = new Map<string, AssetMaintenance[]>();
  private readonly relations = new Map<string, AssetRelation[]>();
  private readonly dispatchReferences = new Map<string, AssetDispatchReference[]>();
  private readonly dispatchIdempotency = new Map<string, AssetDispatchReference>();
  async findById(tenantId: string, assetId: string): Promise<Asset | null> { const asset = this.assets.get(assetKey(tenantId, assetId)); return asset ? cloneAsset(asset) : null; }
  async findByCode(tenantId: string, code: string): Promise<Asset | null> { const id = this.codes.get(codeKey(tenantId, code)); return id ? this.findById(tenantId, id) : null; }
  async search(tenantId: string, input: AssetSearchInput): Promise<AssetSearchResult> { const query = input.query?.toLocaleLowerCase(); const filtered = [...this.assets.values()].filter(asset => asset.tenantId === tenantId).filter(asset => !input.assetType || asset.assetType === input.assetType).filter(asset => !input.status || asset.status === input.status).filter(asset => !query || [asset.code, asset.name, asset.assetType, asset.status, JSON.stringify(asset.technicalData)].some(value => value.toLocaleLowerCase().includes(query))).sort((a,b)=>a.code.localeCompare(b.code)||a.id.localeCompare(b.id)); const total=filtered.length; const offset=(input.page-1)*input.pageSize; return {items:filtered.slice(offset,offset+input.pageSize).map(cloneAsset),page:input.page,pageSize:input.pageSize,total,totalPages:total===0?0:Math.ceil(total/input.pageSize)}; }
  async listHistory(tenantId: string, assetId: string): Promise<AssetVersionSnapshot[]> { return (this.versions.get(assetKey(tenantId, assetId)) ?? []).map(cloneSnapshot); }
  async addEvidence(evidence: AssetEvidence): Promise<AssetEvidence> { const key=assetKey(evidence.tenantId,evidence.assetId); const items=this.evidence.get(key)??[]; items.push(cloneEvidence(evidence)); this.evidence.set(key,items); return cloneEvidence(evidence); }
  async listEvidence(tenantId: string, assetId: string): Promise<AssetEvidence[]> { return (this.evidence.get(assetKey(tenantId,assetId))??[]).map(cloneEvidence).sort((a,b)=>a.createdAt.getTime()-b.createdAt.getTime()||a.id.localeCompare(b.id)); }
  async addInspection(inspection: AssetInspection): Promise<AssetInspection> { const key=assetKey(inspection.tenantId,inspection.assetId); const items=this.inspections.get(key)??[]; items.push(cloneInspection(inspection)); this.inspections.set(key,items); return cloneInspection(inspection); }
  async listInspections(tenantId: string, assetId: string): Promise<AssetInspection[]> { return (this.inspections.get(assetKey(tenantId,assetId))??[]).map(cloneInspection).sort((a,b)=>a.createdAt.getTime()-b.createdAt.getTime()||a.id.localeCompare(b.id)); }
  async addMaintenance(record: AssetMaintenance): Promise<AssetMaintenance> { const key=assetKey(record.tenantId,record.assetId); const items=this.maintenance.get(key)??[]; items.push(cloneMaintenance(record)); this.maintenance.set(key,items); return cloneMaintenance(record); }
  async listMaintenance(tenantId: string, assetId: string): Promise<AssetMaintenance[]> { return (this.maintenance.get(assetKey(tenantId,assetId))??[]).map(cloneMaintenance).sort((a,b)=>a.createdAt.getTime()-b.createdAt.getTime()||a.id.localeCompare(b.id)); }
  async addRelation(relation: AssetRelation): Promise<AssetRelation> { const key=assetKey(relation.tenantId,relation.assetId); const items=this.relations.get(key)??[]; items.push(cloneRelation(relation)); this.relations.set(key,items); return cloneRelation(relation); }
  async listRelations(tenantId: string, assetId: string): Promise<AssetRelation[]> { return (this.relations.get(assetKey(tenantId,assetId))??[]).map(cloneRelation).sort((a,b)=>a.createdAt.getTime()-b.createdAt.getTime()||a.id.localeCompare(b.id)); }
  async addDispatchReference(reference: AssetDispatchReference): Promise<AssetDispatchReference> { const idem=dispatchKey(reference.tenantId,reference.assetId,reference.idempotencyKey); const existing=this.dispatchIdempotency.get(idem); if(existing)return cloneDispatchReference(existing); const key=assetKey(reference.tenantId,reference.assetId); const stored=cloneDispatchReference(reference); const items=this.dispatchReferences.get(key)??[]; items.push(stored); this.dispatchReferences.set(key,items); this.dispatchIdempotency.set(idem,stored); return cloneDispatchReference(stored); }
  async findDispatchReferenceByIdempotencyKey(tenantId:string,assetId:string,idempotencyKey:string):Promise<AssetDispatchReference|null>{const found=this.dispatchIdempotency.get(dispatchKey(tenantId,assetId,idempotencyKey));return found?cloneDispatchReference(found):null;}
  async listDispatchReferences(tenantId:string,assetId:string):Promise<AssetDispatchReference[]>{return(this.dispatchReferences.get(assetKey(tenantId,assetId))??[]).map(cloneDispatchReference).sort((a,b)=>a.createdAt.getTime()-b.createdAt.getTime()||a.id.localeCompare(b.id));}
  async setLocation(location: AssetLocation): Promise<AssetLocation> { const stored=cloneLocation(location); this.locations.set(assetKey(location.tenantId,location.assetId),stored); return cloneLocation(stored); }
  async findLocation(tenantId: string, assetId: string): Promise<AssetLocation | null> { const location=this.locations.get(assetKey(tenantId,assetId)); return location?cloneLocation(location):null; }
  async findLocationsByBounds(tenantId: string,bounds:AssetBounds):Promise<AssetLocation[]>{return [...this.locations.values()].filter(l=>l.tenantId===tenantId&&l.latitude>=bounds.minLatitude&&l.latitude<=bounds.maxLatitude&&l.longitude>=bounds.minLongitude&&l.longitude<=bounds.maxLongitude).sort((a,b)=>a.assetId.localeCompare(b.assetId)).map(cloneLocation);}
  async create(asset: Asset,audit:AssetAuditEntry):Promise<Asset>{const index=codeKey(asset.tenantId,asset.code);if(this.codes.has(index))throw codeConflictError();const stored=cloneAsset(asset);const key=assetKey(asset.tenantId,asset.id);this.assets.set(key,stored);this.codes.set(index,asset.id);this.audit.push(cloneAudit(audit));this.versions.set(key,[snapshotFor(stored,audit)]);return cloneAsset(stored);}
  async update(tenantId:string,assetId:string,expectedVersion:number,nextAsset:Asset,audit:AssetAuditEntry):Promise<AssetUpdateResult>{const key=assetKey(tenantId,assetId);const current=this.assets.get(key);if(!current)return{status:"not_found"};if(current.version!==expectedVersion)return{status:"version_conflict"};const nextCodeIndex=codeKey(tenantId,nextAsset.code);const conflictingId=this.codes.get(nextCodeIndex);if(conflictingId&&conflictingId!==assetId)return{status:"code_conflict"};if(nextAsset.code!==current.code){this.codes.delete(codeKey(tenantId,current.code));this.codes.set(nextCodeIndex,assetId);}const stored=cloneAsset(nextAsset);this.assets.set(key,stored);this.audit.push(cloneAudit(audit));const history=this.versions.get(key)??[];history.push(snapshotFor(stored,audit));this.versions.set(key,history);return{status:"updated",asset:cloneAsset(stored)};}
  async listAudit(tenantId:string,assetId:string):Promise<AssetAuditEntry[]>{return this.audit.filter(e=>e.tenantId===tenantId&&e.assetId===assetId).map(cloneAudit);}
  async countAssets():Promise<number>{return this.assets.size;}
}
