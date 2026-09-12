import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import type { Asset, AssetAuditEntry } from "../domain/asset.js";
import { codeConflictError } from "../domain/asset.js";
import type { AssetRepository, AssetUpdateResult } from "../application/assetRepository.js";
import { assetAuditLog, assets } from "./schema.js";

function isTenantCodeConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; constraint?: string };
  return candidate.code === "23505" && candidate.constraint === "assets_tenant_code_unique";
}

function toAsset(row: typeof assets.$inferSelect): Asset {
  return {
    id: row.id,
    tenantId: row.tenantId,
    code: row.code,
    name: row.name,
    assetType: row.assetType,
    status: row.status,
    technicalData: structuredClone(row.technicalData),
    version: row.version,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}

function auditValues(audit: AssetAuditEntry): typeof assetAuditLog.$inferInsert {
  return {
    tenantId: audit.tenantId,
    assetId: audit.assetId,
    action: audit.action,
    actorUserId: audit.actorUserId,
    version: audit.version,
    correlationId: audit.correlationId,
    occurredAt: audit.occurredAt,
  };
}

export class PostgresAssetRepository implements AssetRepository {
  private readonly db;

  constructor(pool: Pool) {
    this.db = drizzle(pool, { schema: { assets, assetAuditLog } });
  }

  async findById(tenantId: string, assetId: string): Promise<Asset | null> {
    const rows = await this.db
      .select()
      .from(assets)
      .where(and(eq(assets.tenantId, tenantId), eq(assets.id, assetId)))
      .limit(1);
    const row = rows[0];
    return row ? toAsset(row) : null;
  }

  async findByCode(tenantId: string, code: string): Promise<Asset | null> {
    const rows = await this.db
      .select()
      .from(assets)
      .where(and(eq(assets.tenantId, tenantId), eq(assets.code, code)))
      .limit(1);
    const row = rows[0];
    return row ? toAsset(row) : null;
  }

  async create(asset: Asset, audit: AssetAuditEntry): Promise<Asset> {
    try {
      return await this.db.transaction(async tx => {
        const rows = await tx.insert(assets).values({
          id: asset.id,
          tenantId: asset.tenantId,
          code: asset.code,
          name: asset.name,
          assetType: asset.assetType,
          status: asset.status,
          technicalData: asset.technicalData,
          version: asset.version,
          createdAt: asset.createdAt,
          createdBy: asset.createdBy,
          updatedAt: asset.updatedAt,
          updatedBy: asset.updatedBy,
        }).returning();

        const row = rows[0];
        if (!row) throw new Error("Asset insert returned no row");
        await tx.insert(assetAuditLog).values(auditValues(audit));
        return toAsset(row);
      });
    } catch (error) {
      if (isTenantCodeConflict(error)) throw codeConflictError();
      throw error;
    }
  }

  async update(
    tenantId: string,
    assetId: string,
    expectedVersion: number,
    nextAsset: Asset,
    audit: AssetAuditEntry,
  ): Promise<AssetUpdateResult> {
    try {
      return await this.db.transaction(async tx => {
        const rows = await tx
          .update(assets)
          .set({
            code: nextAsset.code,
            name: nextAsset.name,
            assetType: nextAsset.assetType,
            status: nextAsset.status,
            technicalData: nextAsset.technicalData,
            version: nextAsset.version,
            updatedAt: nextAsset.updatedAt,
            updatedBy: nextAsset.updatedBy,
          })
          .where(and(
            eq(assets.tenantId, tenantId),
            eq(assets.id, assetId),
            eq(assets.version, expectedVersion),
          ))
          .returning();

        const updated = rows[0];
        if (!updated) {
          const current = await tx
            .select({ version: assets.version })
            .from(assets)
            .where(and(eq(assets.tenantId, tenantId), eq(assets.id, assetId)))
            .limit(1);
          return current[0]
            ? { status: "version_conflict" as const }
            : { status: "not_found" as const };
        }

        await tx.insert(assetAuditLog).values(auditValues(audit));
        return { status: "updated" as const, asset: toAsset(updated) };
      });
    } catch (error) {
      if (isTenantCodeConflict(error)) return { status: "code_conflict" };
      throw error;
    }
  }
}
