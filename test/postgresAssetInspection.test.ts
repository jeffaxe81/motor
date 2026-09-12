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
  "drizzle/0004_m7_asset_inspections.sql",
];
let pool: Pool | null = null;

async function loadSubject() {
  if (!databaseUrl) throw new Error("DATABASE_URL is required for PostgreSQL integration tests");
  const { PostgresAssetRepository } = await import("../src/persistence/postgresAssetRepository.js");
  pool = new Pool({ connectionString: databaseUrl });
  await pool.query("DROP TABLE IF EXISTS asset_inspections");
  await pool.query("DROP TABLE IF EXISTS asset_evidence");
  await pool.query("DROP TABLE IF EXISTS asset_locations");
  await pool.query("DROP TABLE IF EXISTS asset_event_outbox");
  await pool.query("DROP TABLE IF EXISTS asset_versions");
  await pool.query("DROP TABLE IF EXISTS asset_audit_log");
  await pool.query("DROP TABLE IF EXISTS assets");
  for (const migrationPath of migrations) await pool.query(await fs.readFile(path.resolve(process.cwd(), migrationPath), "utf8"));
  let id = 0;
  const service = new AssetService(new PostgresAssetRepository(pool), {
    now: () => new Date("2026-09-12T20:45:00.000Z"),
    generateId: () => `82000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
  });
  return { service };
}

afterEach(async () => {
  if (pool) {
    await pool.query("DROP TABLE IF EXISTS asset_inspections");
    await pool.end();
  }
  pool = null;
});

const suite = databaseUrl ? describe : describe.skip;
const context = { tenantId: "tenant-a", userId: "user-pg-inspection", correlationId: "corr-pg-inspection-0001", permissions: ["assets:read", "assets:write"] };

suite("M7 PostgreSQL inspections", () => {
  it("persists finalized checklist results and optional location", async () => {
    const { service } = await loadSubject();
    const asset = await service.create(context, { code: "AT-PG-INSP", name: "Ativo PG", assetType: "poste", status: "ativo", technicalData: {} });
    const inspection = await service.recordInspection(context, asset.id, { checklistReference: "checklist:poste:v1", responses: { estrutura: "ok" }, result: "approved", source: "field-app", location: { latitude: -27.59, longitude: -48.55 } });
    const rows = await pool!.query("SELECT tenant_id, asset_id, checklist_reference, result, status, latitude, longitude FROM asset_inspections WHERE id = $1", [inspection.id]);
    expect(rows.rows).toEqual([{ tenant_id: "tenant-a", asset_id: asset.id, checklist_reference: "checklist:poste:v1", result: "approved", status: "finalized", latitude: -27.59, longitude: -48.55 }]);
  });
});
