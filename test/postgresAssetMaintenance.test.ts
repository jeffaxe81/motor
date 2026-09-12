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
  "drizzle/0005_m8_asset_maintenance.sql",
];
let pool: Pool | null = null;

async function loadSubject() {
  if (!databaseUrl) throw new Error("DATABASE_URL is required for PostgreSQL integration tests");
  const { PostgresAssetRepository } = await import("../src/persistence/postgresAssetRepository.js");
  pool = new Pool({ connectionString: databaseUrl });
  await pool.query("DROP TABLE IF EXISTS asset_maintenance");
  await pool.query("DROP TABLE IF EXISTS asset_inspections");
  await pool.query("DROP TABLE IF EXISTS asset_evidence");
  await pool.query("DROP TABLE IF EXISTS asset_locations");
  await pool.query("DROP TABLE IF EXISTS asset_event_outbox");
  await pool.query("DROP TABLE IF EXISTS asset_versions");
  await pool.query("DROP TABLE IF EXISTS asset_audit_log");
  await pool.query("DROP TABLE IF EXISTS assets");
  for (const migrationPath of migrations) await pool.query(await fs.readFile(path.resolve(process.cwd(), migrationPath), "utf8"));
  let id = 0;
  return new AssetService(new PostgresAssetRepository(pool), { now: () => new Date("2026-09-12T21:30:00.000Z"), generateId: () => `92000000-0000-4000-8000-${String(++id).padStart(12, "0")}` });
}
afterEach(async () => { if (pool) await pool.end(); pool = null; });
const suite = databaseUrl ? describe : describe.skip;
const context = { tenantId: "tenant-a", userId: "user-pg-m8", correlationId: "corr-pg-m8-0001", permissions: ["assets:read", "assets:write"] };

suite("M8 PostgreSQL maintenance", () => {
  it("persists immutable maintenance metadata and totals", async () => {
    const service = await loadSubject();
    const asset = await service.create(context, { code: "AT-M8-PG", name: "Ativo PG", assetType: "poste", status: "ativo", technicalData: {} });
    await service.recordMaintenance(context, asset.id, { kind: "repair", description: "Troca", parts: [{ code: "P1", description: "Peça", quantity: 2, unitCost: 12.5 }], costs: [{ category: "labor", amount: 40, currency: "BRL" }], source: "api" });
    const rows = await pool!.query("SELECT kind, total_cost, source FROM asset_maintenance WHERE asset_id = $1", [asset.id]);
    expect(rows.rows).toEqual([{ kind: "repair", total_cost: 65, source: "api" }]);
  });
});
