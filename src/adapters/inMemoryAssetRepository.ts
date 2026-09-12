import type { Asset, AssetAuditEntry, AssetVersionSnapshot } from "../domain/asset.js";
import { codeConflictError } from "../domain/asset.js";
import type { AssetRepository, AssetUpdateResult } from "../application/assetRepository.js";

const assetKey = (tenantId: string, assetId: string) => `${tenantId}\u0000${assetId}`;
const codeKey = (tenantId: string, code: string) => `${tenantId}\u0000${code}`;

function cloneAsset(asset: Asset): Asset {
  return {
    ...asset,
    technicalData: structuredClone(asset.technicalData),
    createdAt: new Date(asset.createdAt),
    updatedAt: new Date(asset.updatedAt),
  };
}

function cloneAudit(entry: AssetAuditEntry): AssetAuditEntry {
  return { ...entry, occurredAt: new Date(entry.occurredAt) };
}

function cloneSnapshot(snapshot: AssetVersionSnapshot): AssetVersionSnapshot {
  return {
    ...snapshot,
    technicalData: structuredClone(snapshot.technicalData),
    changedAt: new Date(snapshot.changedAt),
  };
}

function snapshotFor(asset: Asset, audit: AssetAuditEntry): AssetVersionSnapshot {
  return {
    tenantId: asset.tenantId,
    assetId: asset.id,
    version: asset.version,
    code: asset.code,
    name: asset.name,
    assetType: asset.assetType,
    status: asset.status,
    technicalData: structuredClone(asset.technicalData),
    changedAt: audit.occurredAt,
    changedBy: audit.actorUserId,
    reason: audit.reason,
    origin: audit.origin,
    correlationId: audit.correlationId,
  };
}

export class InMemoryAssetRepository implements AssetRepository {
  private readonly assets = new Map<string, Asset>();
  private readonly codes = new Map<string, string>();
  private readonly audit: AssetAuditEntry[] = [];
  private readonly versions = new Map<string, AssetVersionSnapshot[]>();

  async findById(tenantId: string, assetId: string): Promise<Asset | null> {
    const asset = this.assets.get(assetKey(tenantId, assetId));
    return asset ? cloneAsset(asset) : null;
  }

  async findByCode(tenantId: string, code: string): Promise<Asset | null> {
    const id = this.codes.get(codeKey(tenantId, code));
    return id ? this.findById(tenantId, id) : null;
  }

  async listHistory(tenantId: string, assetId: string): Promise<AssetVersionSnapshot[]> {
    return (this.versions.get(assetKey(tenantId, assetId)) ?? []).map(cloneSnapshot);
  }

  async create(asset: Asset, audit: AssetAuditEntry): Promise<Asset> {
    const index = codeKey(asset.tenantId, asset.code);
    if (this.codes.has(index)) throw codeConflictError();

    const stored = cloneAsset(asset);
    const key = assetKey(asset.tenantId, asset.id);
    this.assets.set(key, stored);
    this.codes.set(index, asset.id);
    this.audit.push(cloneAudit(audit));
    this.versions.set(key, [snapshotFor(stored, audit)]);
    return cloneAsset(stored);
  }

  async update(
    tenantId: string,
    assetId: string,
    expectedVersion: number,
    nextAsset: Asset,
    audit: AssetAuditEntry,
  ): Promise<AssetUpdateResult> {
    const key = assetKey(tenantId, assetId);
    const current = this.assets.get(key);
    if (!current) return { status: "not_found" };
    if (current.version !== expectedVersion) return { status: "version_conflict" };

    const nextCodeIndex = codeKey(tenantId, nextAsset.code);
    const conflictingId = this.codes.get(nextCodeIndex);
    if (conflictingId && conflictingId !== assetId) return { status: "code_conflict" };

    if (nextAsset.code !== current.code) {
      this.codes.delete(codeKey(tenantId, current.code));
      this.codes.set(nextCodeIndex, assetId);
    }

    const stored = cloneAsset(nextAsset);
    this.assets.set(key, stored);
    this.audit.push(cloneAudit(audit));
    const history = this.versions.get(key) ?? [];
    history.push(snapshotFor(stored, audit));
    this.versions.set(key, history);
    return { status: "updated", asset: cloneAsset(stored) };
  }

  async listAudit(tenantId: string, assetId: string): Promise<AssetAuditEntry[]> {
    return this.audit
      .filter(entry => entry.tenantId === tenantId && entry.assetId === assetId)
      .map(cloneAudit);
  }

  async countAssets(): Promise<number> {
    return this.assets.size;
  }
}
