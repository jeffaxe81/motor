import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import {
  assetBoundsSchema,
  assetCreateInputSchema,
  assetEvidenceInputSchema,
  assetInspectionInputSchema,
  assetLocationInputSchema,
  assetRequestContextSchema,
  assetSearchInputSchema,
  assetUpdateInputSchema,
  codeConflictError,
  forbiddenError,
  notFoundError,
  validationError,
  versionConflictError,
  type Asset,
  type AssetAuditEntry,
  type AssetBounds,
  type AssetCreateInput,
  type AssetEvidence,
  type AssetEvidenceInput,
  type AssetInspection,
  type AssetInspectionInput,
  type AssetLocation,
  type AssetLocationInput,
  type AssetRequestContext,
  type AssetSearchInput,
  type AssetSearchResult,
  type AssetTimelineItem,
  type AssetUpdateInput,
  type AssetVersionChange,
  type AssetVersionComparison,
  type AssetVersionSnapshot,
} from "../domain/asset.js";
import type { AssetRepository } from "./assetRepository.js";

export interface AssetServiceDependencies { now?: () => Date; generateId?: () => string; }
const comparableFields = ["code", "name", "assetType", "status", "technicalData"] as const;
function sameValue(left: unknown, right: unknown): boolean { return JSON.stringify(left) === JSON.stringify(right); }
function timelineItemFrom(snapshot: AssetVersionSnapshot): AssetTimelineItem {
  return { id: `asset:${snapshot.assetId}:v${snapshot.version}`, tenantId: snapshot.tenantId, assetId: snapshot.assetId, type: snapshot.version === 1 ? "asset.created" : "asset.updated", occurredAt: new Date(snapshot.changedAt), authorUserId: snapshot.changedBy, source: snapshot.origin, reason: snapshot.reason, correlationId: snapshot.correlationId, version: snapshot.version, data: { code: snapshot.code, name: snapshot.name, assetType: snapshot.assetType, status: snapshot.status, technicalData: structuredClone(snapshot.technicalData) } };
}
function evidenceTimelineItem(evidence: AssetEvidence): AssetTimelineItem {
  return { id: `asset:${evidence.assetId}:evidence:${evidence.id}`, tenantId: evidence.tenantId, assetId: evidence.assetId, type: "asset.evidence.added", occurredAt: new Date(evidence.createdAt), authorUserId: evidence.createdBy, source: evidence.source, reason: evidence.kind, correlationId: evidence.correlationId, version: 0, data: { evidenceId: evidence.id, kind: evidence.kind, fileName: evidence.fileName, mediaType: evidence.mediaType, sizeBytes: evidence.sizeBytes, storageKey: evidence.storageKey, sha256: evidence.sha256, signatureReference: evidence.signatureReference, valid: evidence.valid } };
}
function inspectionTimelineItem(inspection: AssetInspection): AssetTimelineItem {
  return { id: `asset:${inspection.assetId}:inspection:${inspection.id}`, tenantId: inspection.tenantId, assetId: inspection.assetId, type: "asset.inspection.finalized", occurredAt: new Date(inspection.createdAt), authorUserId: inspection.createdBy, source: inspection.source, reason: inspection.result, correlationId: inspection.correlationId, version: 0, data: { inspectionId: inspection.id, checklistReference: inspection.checklistReference, result: inspection.result, responses: structuredClone(inspection.responses), evidenceIds: [...inspection.evidenceIds], location: inspection.location ? { ...inspection.location } : undefined } };
}

export class AssetService {
  private readonly now: () => Date;
  private readonly generateId: () => string;
  constructor(private readonly repository: AssetRepository, dependencies: AssetServiceDependencies = {}) { this.now = dependencies.now ?? (() => new Date()); this.generateId = dependencies.generateId ?? randomUUID; }
  async create(contextInput: unknown, input: unknown): Promise<Asset> {
    const context = this.parseContext(contextInput); this.requirePermission(context, "assets:write"); const parsed = this.parseCreate(input); if (await this.repository.findByCode(context.tenantId, parsed.code)) throw codeConflictError();
    const now = this.now(); const asset: Asset = { id: this.generateId(), tenantId: context.tenantId, code: parsed.code, name: parsed.name, assetType: parsed.assetType, status: parsed.status, technicalData: structuredClone(parsed.technicalData), version: 1, createdAt: now, createdBy: context.userId, updatedAt: now, updatedBy: context.userId };
    return this.repository.create(asset, this.auditFor(asset, context, "created", now, "initial-registration", "api"));
  }
  async search(contextInput: unknown, input: unknown): Promise<AssetSearchResult> { const context = this.parseContext(contextInput); this.requirePermission(context, "assets:read"); return this.repository.search(context.tenantId, this.parseSearch(input)); }
  async get(contextInput: unknown, assetId: string): Promise<Asset> { const context = this.parseContext(contextInput); this.requirePermission(context, "assets:read"); const asset = await this.repository.findById(context.tenantId, assetId); if (!asset) throw notFoundError(); return asset; }
  async history(contextInput: unknown, assetId: string): Promise<AssetVersionSnapshot[]> { const context = this.parseContext(contextInput); this.requirePermission(context, "assets:read"); const asset = await this.repository.findById(context.tenantId, assetId); if (!asset) throw notFoundError(); return this.repository.listHistory(context.tenantId, assetId); }
  async timeline(contextInput: unknown, assetId: string): Promise<AssetTimelineItem[]> {
    const context = this.parseContext(contextInput); this.requirePermission(context, "assets:read"); const asset = await this.repository.findById(context.tenantId, assetId); if (!asset) throw notFoundError();
    const [history, evidence, inspections] = await Promise.all([this.repository.listHistory(context.tenantId, assetId), this.repository.listEvidence(context.tenantId, assetId), this.repository.listInspections(context.tenantId, assetId)]);
    return [...history.map(timelineItemFrom), ...evidence.map(evidenceTimelineItem), ...inspections.map(inspectionTimelineItem)].sort((left, right) => { const byTime = left.occurredAt.getTime() - right.occurredAt.getTime(); if (byTime !== 0) return byTime; if (left.version !== right.version) return left.version - right.version; return left.id.localeCompare(right.id); });
  }
  async addEvidence(contextInput: unknown, assetId: string, input: unknown): Promise<AssetEvidence> {
    const context = this.parseContext(contextInput); this.requirePermission(context, "assets:write"); const parsed = this.parseEvidence(input); const asset = await this.repository.findById(context.tenantId, assetId); if (!asset) throw notFoundError();
    const evidence: AssetEvidence = { id: this.generateId(), tenantId: context.tenantId, assetId, kind: parsed.kind, fileName: parsed.fileName, mediaType: parsed.mediaType, sizeBytes: parsed.sizeBytes, storageKey: parsed.storageKey, sha256: parsed.sha256.toLowerCase(), source: parsed.source, ...(parsed.signatureReference ? { signatureReference: parsed.signatureReference } : {}), createdAt: this.now(), createdBy: context.userId, correlationId: context.correlationId, valid: true };
    return this.repository.addEvidence(evidence);
  }
  async listEvidence(contextInput: unknown, assetId: string): Promise<AssetEvidence[]> { const context = this.parseContext(contextInput); this.requirePermission(context, "assets:read"); const asset = await this.repository.findById(context.tenantId, assetId); if (!asset) throw notFoundError(); return this.repository.listEvidence(context.tenantId, assetId); }
  async recordInspection(contextInput: unknown, assetId: string, input: unknown): Promise<AssetInspection> {
    const context = this.parseContext(contextInput); this.requirePermission(context, "assets:write"); const parsed = this.parseInspection(input); const asset = await this.repository.findById(context.tenantId, assetId); if (!asset) throw notFoundError();
    if (parsed.evidenceIds.length) { const evidence = await this.repository.listEvidence(context.tenantId, assetId); const owned = new Set(evidence.map(item => item.id)); if (parsed.evidenceIds.some(id => !owned.has(id))) throw validationError(); }
    const inspection: AssetInspection = { id: this.generateId(), tenantId: context.tenantId, assetId, checklistReference: parsed.checklistReference, responses: structuredClone(parsed.responses), result: parsed.result, status: "finalized", source: parsed.source, ...(parsed.location ? { location: { ...parsed.location } } : {}), evidenceIds: [...parsed.evidenceIds], createdAt: this.now(), createdBy: context.userId, correlationId: context.correlationId };
    return this.repository.addInspection(inspection);
  }
  async listInspections(contextInput: unknown, assetId: string): Promise<AssetInspection[]> { const context = this.parseContext(contextInput); this.requirePermission(context, "assets:read"); const asset = await this.repository.findById(context.tenantId, assetId); if (!asset) throw notFoundError(); return this.repository.listInspections(context.tenantId, assetId); }
  async compare(contextInput: unknown, assetId: string, fromVersion: number, toVersion: number): Promise<AssetVersionComparison> { if (!Number.isInteger(fromVersion) || fromVersion <= 0 || !Number.isInteger(toVersion) || toVersion <= 0) throw validationError(); const history = await this.history(contextInput, assetId); const from = history.find(snapshot => snapshot.version === fromVersion); const to = history.find(snapshot => snapshot.version === toVersion); if (!from || !to) throw notFoundError(); const changes: AssetVersionChange[] = []; for (const field of comparableFields) if (!sameValue(from[field], to[field])) changes.push({ field, before: structuredClone(from[field]), after: structuredClone(to[field]) }); return { fromVersion, toVersion, changes }; }
  async setLocation(contextInput: unknown, assetId: string, input: unknown): Promise<AssetLocation> { const context = this.parseContext(contextInput); this.requirePermission(context, "assets:write"); const parsed = this.parseLocation(input); const asset = await this.repository.findById(context.tenantId, assetId); if (!asset) throw notFoundError(); return this.repository.setLocation({ tenantId: context.tenantId, assetId, latitude: parsed.latitude, longitude: parsed.longitude, source: parsed.source, updatedAt: this.now(), updatedBy: context.userId, correlationId: context.correlationId }); }
  async getLocation(contextInput: unknown, assetId: string): Promise<AssetLocation> { const context = this.parseContext(contextInput); this.requirePermission(context, "assets:read"); const asset = await this.repository.findById(context.tenantId, assetId); if (!asset) throw notFoundError(); const location = await this.repository.findLocation(context.tenantId, assetId); if (!location) throw notFoundError(); return location; }
  async searchByBounds(contextInput: unknown, boundsInput: unknown): Promise<AssetLocation[]> { const context = this.parseContext(contextInput); this.requirePermission(context, "assets:read"); return this.repository.findLocationsByBounds(context.tenantId, this.parseBounds(boundsInput)); }
  async update(contextInput: unknown, assetId: string, input: unknown): Promise<Asset> {
    const context = this.parseContext(contextInput); this.requirePermission(context, "assets:write"); const parsed = this.parseUpdate(input); const current = await this.repository.findById(context.tenantId, assetId); if (!current) throw notFoundError();
    if (parsed.code !== undefined && parsed.code !== current.code) { const withCode = await this.repository.findByCode(context.tenantId, parsed.code); if (withCode && withCode.id !== current.id) throw codeConflictError(); }
    const now = this.now(); const next: Asset = { ...current, ...(parsed.code !== undefined ? { code: parsed.code } : {}), ...(parsed.name !== undefined ? { name: parsed.name } : {}), ...(parsed.assetType !== undefined ? { assetType: parsed.assetType } : {}), ...(parsed.status !== undefined ? { status: parsed.status } : {}), ...(parsed.technicalData !== undefined ? { technicalData: structuredClone(parsed.technicalData) } : {}), version: current.version + 1, updatedAt: now, updatedBy: context.userId };
    const result = await this.repository.update(context.tenantId, assetId, parsed.expectedVersion, next, this.auditFor(next, context, "updated", now, parsed.change?.reason ?? "technical-update", parsed.change?.origin ?? "api")); if (result.status === "not_found") throw notFoundError(); if (result.status === "version_conflict") throw versionConflictError(); if (result.status === "code_conflict") throw codeConflictError(); return result.asset;
  }
  private parseContext(input: unknown): AssetRequestContext { try { return assetRequestContextSchema.parse(input); } catch (error) { if (error instanceof ZodError) throw validationError(); throw error; } }
  private parseCreate(input: unknown): AssetCreateInput { try { return assetCreateInputSchema.parse(input); } catch (error) { if (error instanceof ZodError) throw validationError(); throw error; } }
  private parseUpdate(input: unknown): AssetUpdateInput { try { return assetUpdateInputSchema.parse(input); } catch (error) { if (error instanceof ZodError) throw validationError(); throw error; } }
  private parseLocation(input: unknown): AssetLocationInput { try { return assetLocationInputSchema.parse(input); } catch (error) { if (error instanceof ZodError) throw validationError(); throw error; } }
  private parseBounds(input: unknown): AssetBounds { try { return assetBoundsSchema.parse(input); } catch (error) { if (error instanceof ZodError) throw validationError(); throw error; } }
  private parseSearch(input: unknown): AssetSearchInput { try { return assetSearchInputSchema.parse(input ?? {}); } catch (error) { if (error instanceof ZodError) throw validationError(); throw error; } }
  private parseEvidence(input: unknown): AssetEvidenceInput { try { return assetEvidenceInputSchema.parse(input); } catch (error) { if (error instanceof ZodError) throw validationError(); throw error; } }
  private parseInspection(input: unknown): AssetInspectionInput { try { return assetInspectionInputSchema.parse(input); } catch (error) { if (error instanceof ZodError) throw validationError(); throw error; } }
  private requirePermission(context: AssetRequestContext, permission: string): void { if (!context.permissions.includes(permission)) throw forbiddenError(); }
  private auditFor(asset: Asset, context: AssetRequestContext, action: AssetAuditEntry["action"], occurredAt: Date, reason: string, origin: string): AssetAuditEntry { return { tenantId: context.tenantId, assetId: asset.id, action, actorUserId: context.userId, version: asset.version, correlationId: context.correlationId, occurredAt, reason, origin }; }
}
