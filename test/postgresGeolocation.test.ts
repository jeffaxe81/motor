import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { afterEach, describe, expect, it } from "vitest";
import { AssetService } from "../src/application/assetService.js";

const databaseUrl = process.env.DATABASE_URL;
const m1 = path.resolve(process.cwd(), "drizzle/0000_m1_assets.sql");
const m2 = path.resolve(process.cwd(), "drizzle/0001_m2_asset_history.sql");
const m3 = path.resolve(process.cwd(), "drizzle/0002_m3_asset_locations.sql");
let pool: Pool | null = null;

async function loadSubject() {
  if (!databaseUrl) throw new Error("DATABASE_URL is required for PostgreSQL integration tests");
  const { PostgresAssetRepository } = await import("../src/persistence/postgresAssetRepository.js");
  pool = new Pool({ connectionString: databaseUrl });
  await pool.query("DROP TABLE IF EXISTS asset_locations");
  await pool.query("DROP TABLE IF EXISTS asset_event_outbox");
  await pool.query("DROP TABLE IF EXISTS asset_versions");
  await pool.query("DROP TABLE IF EXISTS asset_audit_log");
  await pool.query("DROP TABLE IF EXISTS assets");
  await pool.query(await fs.readFile(m1, "utf8"));
  await pool.query(await fs.readFile(m2, "utf8"));
  await pool.query(await fs.readFile(m3, "utf8"));

  let id = 0;
  const repository = new PostgresAssetRepository(pool);
  const service = new AssetService(repository, {
    now: () => new Date("2026-09-12T18:00:00.000Z"),
    generateId: () => `50000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
  });
  return { service };
}

afterEach(async () => {
  if (pool) await pool.end();
  pool = null;
});

const context = (tenantId: string) => ({
  tenantId,
  userId: "user-postgres-geo",
  correlationId: `corr-postgres-geo-${tenantId}`,
  permissions: ["assets:read", "assets:write"],
});

const registration = (code: string) => ({
  code,
  name: `Ativo ${code}`,
  assetType: "poste-iluminacao",
  status: "ativo",
  technicalData: {},
});

const suite = databaseUrl ? describe : describe.skip;

suite("M3 PostgreSQL geolocation", () => {
  it("upserts a location and queries it by tenant-scoped bounds", async () => {
    const { service } = await loadSubject();
    const inside = await service.create(context("tenant-a"), registration("POSTE-PG-GEO-001"));
    const outside = await service.create(context("tenant-a"), registration("POSTE-PG-GEO-002"));
    const otherTenant = await service.create(context("tenant-b"), registration("POSTE-PG-GEO-003"));

    await service.setLocation(context("tenant-a"), inside.id, {
      latitude: -27.5945,
      longitude: -48.5477,
      source: "field-app",
    });
    await service.setLocation(context("tenant-a"), outside.id, {
      latitude: -26.3044,
      longitude: -48.8464,
      source: "field-app",
    });
    await service.setLocation(context("tenant-b"), otherTenant.id, {
      latitude: -27.5945,
      longitude: -48.5477,
      source: "field-app",
    });

    const result = await service.searchByBounds(context("tenant-a"), {
      minLatitude: -27.7,
      maxLatitude: -27.4,
      minLongitude: -48.7,
      maxLongitude: -48.4,
    });

    expect(result.map(item => item.assetId)).toEqual([inside.id]);

    const persisted = await pool!.query(
      "SELECT tenant_id, asset_id, latitude, longitude, source FROM asset_locations WHERE asset_id = $1",
      [inside.id],
    );
    expect(persisted.rows[0]).toEqual({
      tenant_id: "tenant-a",
      asset_id: inside.id,
      latitude: -27.5945,
      longitude: -48.5477,
      source: "field-app",
    });
  });
});
