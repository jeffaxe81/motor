import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { afterEach, describe, expect, it } from "vitest";
import { AssetService } from "../src/application/assetService.js";

const databaseUrl = process.env.DATABASE_URL;
const migrations = [
  "drizzle/0000_m1_assets.sql",
  "drizzle/0001_m2_asset_history.sql",
  "drizzle/0002_m3_asset_locations.sql",
  "drizzle/0003_m6_asset_evidence.sql",
];

let pool: Pool | null = null;

async function loadSubject() {
  if (!databaseUrl) throw new Error("DATABASE_URL is required for PostgreSQL integration tests");
  const { PostgresAssetRepository } = await import("../src/persistence/postgresAssetRepository.js");
  pool = new Pool({ connectionString: databaseUrl });

  await pool.query("DROP TABLE IF EXISTS asset_evidence");
  await pool.query("DROP TABLE IF EXISTS asset_locations");
  await pool.query("DROP TABLE IF EXISTS asset_event_outbox");
  await pool.query("DROP TABLE IF EXISTS asset_versions");
  await pool.query("DROP TABLE IF EXISTS asset_audit_log");
  await pool.query("DROP TABLE IF EXISTS assets");
  for (const migrationPath of migrations) {
    await pool.query(await fs.readFile(path.resolve(process.cwd(), migrationPath), "utf8"));
  }

  let id = 0;
  const repository = new PostgresAssetRepository(pool);
  const service = new AssetService(repository, {
    now: () => new Date("2026-09-12T19:30:00.000Z"),
    generateId: () => `74000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
  });
  return { service };
}

afterEach(async () => {
  if (pool) await pool.end();
  pool = null;
});

const suite = databaseUrl ? describe : describe.skip;
const context = {
  tenantId: "tenant-a",
  userId: "user-postgres-evidence",
  correlationId: "corr-postgres-evidence-0001",
  permissions: ["assets:read", "assets:write"],
};

suite("M6 PostgreSQL evidence", () => {
  it("persists evidence metadata without binary payload", async () => {
    const { service } = await loadSubject();
    const asset = await service.create(context, {
      code: "AT-PG-EV-001",
      name: "Ativo PG Evidencia",
      assetType: "poste",
      status: "ativo",
      technicalData: {},
    });

    await service.addEvidence(context, asset.id, {
      kind: "photo-after",
      fileName: "depois.png",
      mediaType: "image/png",
      sizeBytes: 8192,
      storageKey: "tenant-a/assets/AT-PG-EV-001/depois.png",
      sha256: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      source: "field-app",
    });

    const rows = await pool!.query(
      "SELECT tenant_id, asset_id, kind, storage_key, sha256, valid FROM asset_evidence WHERE asset_id = $1",
      [asset.id],
    );
    expect(rows.rows).toEqual([{
      tenant_id: "tenant-a",
      asset_id: asset.id,
      kind: "photo-after",
      storage_key: "tenant-a/assets/AT-PG-EV-001/depois.png",
      sha256: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      valid: true,
    }]);
  });
});
