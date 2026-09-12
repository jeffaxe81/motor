import { z } from "zod";

const opaqueIdSchema = z.string().trim().min(1).max(128);
const correlationIdSchema = z.string().trim().min(8).max(160);

const assetChangeMetadataSchema = z.object({
  reason: z.string().trim().min(1).max(200),
  origin: z.string().trim().min(1).max(128),
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
