import { z } from "zod";

const opaqueIdSchema = z.string().trim().min(1).max(128);
const correlationIdSchema = z.string().trim().min(8).max(160);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i);

const assetChangeMetadataSchema = z.object({
  reason: z.string().trim().min(1).max(200),
  origin: z.string().trim().min(1).max(128),
}).strict();

const inspectionLocationSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
}).strict();

export const assetInspectionInputSchema = z.object({
  checklistReference: z.string().trim().min(1).max(300),
  responses: z.record(z.string(), z.unknown()),
  result: z.string().trim().min(1).max(100),
  source: z.string().trim().min(1).max(128),
  location: inspectionLocationSchema.optional(),
  evidenceIds: z.array(opaqueIdSchema).max(100).default([]),
}).strict();

export const assetEvidenceInputSchema = z.object({
  kind: z.enum(["photo-before", "photo-after", "document", "report"]),
  fileName: z.string().trim().min(1).max(255),
  mediaType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
  sizeBytes: z.number().int().positive().max(25 * 1024 * 1024),
  storageKey: z.string().trim().min(1).max(500),
  sha256: sha256Schema,
  source: z.string().trim().min(1).max(128),
  signatureReference: z.string().trim().min(1).max(300).optional(),
}).strict();

export const assetLocationInputSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  source: z.string().trim().min(1).max(128),
}).strict();

export const assetBoundsSchema = z.object({
  minLatitude: z.number().finite().min(-90).max(90),
  maxLatitude: z.number().finite().min(-90).max(90),
  minLongitude: z.number().finite().min(-180).max(180),
  maxLongitude: z.number().finite().min(-180).max(180),
}).strict().refine(
  value => value.minLatitude <= value.maxLatitude && value.minLongitude <= value.maxLongitude,
  { message: "Invalid geographic bounds" },
);

export const assetSearchInputSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  query: z.string().trim().min(1).max(200).optional(),
  assetType: z.string().trim().min(1).max(100).optional(),
  status: z.string().trim().min(1).max(64).optional(),
}).strict();

export const assetCreateInputSchema = z.object({
  code: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  assetType: z.string().trim().min(1).max(100),
  status: z.string().trim().min(1).max(64),
  technicalData: z.record(z.string(), z.unknown()),
}).strict();

export const assetUpdateInputSchema = z.object({
  expectedVersion: z.number().int().positive(),
  code: z.string().trim().min(1).max(100).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  assetType: z.string().trim().min(1).max(100).optional(),
  status: z.string().trim().min(1).max(64).optional(),
  technicalData: z.record(z.string(), z.unknown()).optional(),
  change: assetChangeMetadataSchema.optional(),
}).strict().refine(
  value => [value.code, value.name, value.assetType, value.status, value.technicalData]
    .some(field => field !== undefined),
  { message: "At least one asset field must be changed" },
);

export const assetRequestContextSchema = z.object({
  tenantId: opaqueIdSchema,
  userId: opaqueIdSchema,
  correlationId: correlationIdSchema,
  permissions: z.array(z.string().trim().min(1)).max(100),
}).strict();

export type AssetCreateInput = z.infer<typeof assetCreateInputSchema>;
export type AssetUpdateInput = z.infer<typeof assetUpdateInputSchema>;
export type AssetRequestContext = z.infer<typeof assetRequestContextSchema>;
export type AssetLocationInput = z.infer<typeof assetLocationInputSchema>;
export type AssetBounds = z.infer<typeof assetBoundsSchema>;
export type AssetSearchInput = z.infer<typeof assetSearchInputSchema>;
export type AssetEvidenceInput = z.infer<typeof assetEvidenceInputSchema>;
export type AssetInspectionInput = z.infer<typeof assetInspectionInputSchema>;

export interface Asset {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  assetType: string;
  status: string;
  technicalData: Record<string, unknown>;
  version: number;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
}

export interface AssetSearchResult {
  items: Asset[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AssetLocation {
  tenantId: string;
  assetId: string;
  latitude: number;
  longitude: number;
  source: string;
  updatedAt: Date;
  updatedBy: string;
  correlationId: string;
}

export interface AssetEvidence {
  id: string;
  tenantId: string;
  assetId: string;
  kind: AssetEvidenceInput["kind"];
  fileName: string;
  mediaType: AssetEvidenceInput["mediaType"];
  sizeBytes: number;
  storageKey: string;
  sha256: string;
  source: string;
  signatureReference?: string;
  createdAt: Date;
  createdBy: string;
  correlationId: string;
  valid: boolean;
}

export interface AssetInspection {
  id: string;
  tenantId: string;
  assetId: string;
  checklistReference: string;
  responses: Record<string, unknown>;
  result: string;
  status: "finalized";
  source: string;
  location?: { latitude: number; longitude: number };
  evidenceIds: string[];
  createdAt: Date;
  createdBy: string;
  correlationId: string;
}

export interface AssetAuditEntry {
  tenantId: string;
  assetId: string;
  action: "created" | "updated";
  actorUserId: string;
  version: number;
  correlationId: string;
  occurredAt: Date;
  reason: string;
  origin: string;
}

export interface AssetVersionSnapshot {
  tenantId: string;
  assetId: string;
  version: number;
  code: string;
  name: string;
  assetType: string;
  status: string;
  technicalData: Record<string, unknown>;
  changedAt: Date;
  changedBy: string;
  reason: string;
  origin: string;
  correlationId: string;
}

export interface AssetTimelineItem {
  id: string;
  tenantId: string;
  assetId: string;
  type: "asset.created" | "asset.updated" | "asset.evidence.added" | "asset.inspection.finalized";
  occurredAt: Date;
  authorUserId: string;
  source: string;
  reason: string;
  correlationId: string;
  version: number;
  data: Record<string, unknown>;
}

export interface AssetVersionChange {
  field: "code" | "name" | "assetType" | "status" | "technicalData";
  before: unknown;
  after: unknown;
}

export interface AssetVersionComparison {
  fromVersion: number;
  toVersion: number;
  changes: AssetVersionChange[];
}

export class AssetError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = "AssetError";
  }
}

export function validationError(): AssetError {
  return new AssetError("validation.invalid", "Invalid asset request", 400);
}

export function forbiddenError(): AssetError {
  return new AssetError("authorization.forbidden", "Operation not permitted", 403);
}

export function notFoundError(): AssetError {
  return new AssetError("asset.not_found", "Asset not found", 404);
}

export function codeConflictError(): AssetError {
  return new AssetError("asset.code_conflict", "Asset code already exists in this tenant", 409);
}

export function versionConflictError(): AssetError {
  return new AssetError("asset.version_conflict", "Asset version is stale", 409);
}
