import { and, asc, eq, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import type {
  Asset,
  AssetAuditEntry,
  AssetBounds,
  AssetLocation,
  AssetVersionSnapshot,
} from "../domain/asset.js";
import { codeConflictError } from "../domain/asset.js";
import type { AssetRepository, AssetUpdateResult } from "../application/assetRepository.js";
import { assetAuditLog, assetEventOutbox, assetLocations, assetVersions, assets } from "./schema.js";

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

function toSnapshot(row: typeof assetVersions.$inferSelect): AssetVersionSnapshot {
  return {
    tenantId: row.tenantId,
    assetId: row.assetId,
    version: row.version,
    code: row.code,
    name: row.name,
    assetType: row.assetType,
    status: row.status,
    technicalData: structuredClone(row.technicalData),
    changedAt: row.changedAt,
    changedBy: row.changedBy,
    reason: row.reason,
    origin: row.origin,
    correlationId: row.correlationId,
  };
}

function toLocation(row: typeof assetLocations.$inferSelect): AssetLocation {
  return {
    tenantId: row.tenantId,
    assetId: row.assetId,
    latitude: row.latitude,
    longitude: row.longitude,
    source: row.source,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
    correlationId: row.correlationId,
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

function versionValues(
  asset: Asset,
  audit: AssetAuditEntry,
): typeof assetVersions.$inferInsert {
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

function outboxValues(
  asset: Asset,
  audit: AssetAuditEntry,
): typeof assetEventOutbox.$inferInsert {
  const eventType = audit.action === "created" ? "asset.created" : "asset.updated";
  return {
    eventId: `asset:${asset.tenantId}:${asset.id}:v${asset.version}:${eventType}`,
    eventType,
    eventVersion: "1",
    tenantId: asset.tenantId,
    assetId: asset.id,
    assetVersion: asset.version,
    correlationId: audit.correlationId,
    occurredAt: audit.occurredAt,
    payload: {
      assetId: asset.id,
      version: asset.version,
      code: asset.code,
      name: asset.name,
      assetType: asset.assetType,
      status: asset.status,
      technicalData: structuredClone(asset.technicalData),
      changedBy: audit.actorUserId,
      reason: audit.reason,
      origin: audit.origin,
    },
  };
}

export class PostgresAssetRepository implements AssetRepository {
  private readonly db;

  constructor(pool: Pool) {
    this.db = drizzle(pool, {
      schema: { assets, assetAuditLog, assetVersions, assetEventOutbox, assetLocations },
    });
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

  async listHistory(tenantId: string, assetId: string): Promise<AssetVersionSnapshot[]> {
    const rows = await this.db
      .select()
      .from(assetVersions)
      .where(and(eq(assetVersions.tenantId, tenantId), eq(assetVersions.assetId, assetId)))
      .orderBy(asc(assetVersions.version));
    return rows.map(toSnapshot);
  }

  async setLocation(location: AssetLocation): Promise<AssetLocation> {
    const rows = await this.db
      .insert(assetLocations)
      .values(location)
      .onConflictDoUpdate({
        target: [assetLocations.tenantId, assetLocations.assetId],
        set: {
          latitude: location.latitude,
          longitude: location.longitude,
          source: location.source,
          updatedAt: location.updatedAt,
          updatedBy: location.updatedBy,
          correlationId: location.correlationId,
        },
      })
      .returning();
    const row = rows[0];
    if (!row) throw new Error("Asset location upsert returned no row");
    return toLocation(row);
  }

  async findLocation(tenantId: string, assetId: string): Promise<AssetLocation | null> {
    const rows = await this.db
      .select()
      .from(assetLocations)
      .where(and(eq(assetLocations.tenantId, tenantId), eq(assetLocations.assetId, assetId)))
      .limit(1);
    const row = rows[0];
    return row ? toLocation(row) : null;
  }

  async findLocationsByBounds(tenantId: string, bounds: AssetBounds): Promise<AssetLocation[]> {
    const rows = await this.db
      .select()
      .from(assetLocations)
      .where(and(
        eq(assetLocations.tenantId, tenantId),
        gte(assetLocations.latitude, bounds.minLatitude),
        lte(assetLocations.latitude, bounds.maxLatitude),
        gte(assetLocations.longitude, bounds.minLongitude),
        lte(assetLocations.longitude, bounds.maxLongitude),
      ))
      .orderBy(asc(assetLocations.assetId));
    return rows.map(toLocation);
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
        await tx.insert(assetVersions).values(versionValues(asset, audit));
        await tx.insert(assetEventOutbox).values(outboxValues(asset, audit));
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

        const persisted = toAsset(updated);
        await tx.insert(assetAuditLog).values(auditValues(audit));
        await tx.insert(assetVersions).values(versionValues(persisted, audit));
        await tx.insert(assetEventOutbox).values(outboxValues(persisted, audit));
        return { status: "updated" as const, asset: persisted };
      });
    } catch (error) {
      if (isTenantCodeConflict(error)) return { status: "code_conflict" };
      throw error;
    }
  }
}
