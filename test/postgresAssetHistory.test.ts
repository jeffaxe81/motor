import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { afterEach, describe, expect, it } from "vitest";
import { AssetService } from "../src/application/assetService.js";

const repositoryModulePath = "../src/persistence/postgresAssetRepository.js";
const m1MigrationPath = path.resolve(process.cwd(), "drizzle/0000_m1_assets.sql");
const m2MigrationPath = path.resolve(process.cwd(), "drizzle/0001_m2_asset_history.sql");
const databaseUrl = process.env.DATABASE_URL;

let pool: Pool | null = null;

async function applyOptionalM2Migration(target: Pool) {
  try {
    const migration = await fs.readFile(m2MigrationPath, "utf8");
    await target.query(migration);
  } catch (error) {
    const candidate = error as NodeJS.ErrnoException;
    if (candidate.code !== "ENOENT") throw error;
  }
}

async function loadSubject() {
  if (!databaseUrl) throw new Error("DATABASE_URL is required for PostgreSQL integration tests");
  const { PostgresAssetRepository } = await import(repositoryModulePath);
  pool = new Pool({ connectionString: databaseUrl });

  await pool.query("DROP TABLE IF EXISTS asset_event_outbox");
  await pool.query("DROP TABLE IF EXISTS asset_versions");
  await pool.query("DROP TABLE IF EXISTS asset_audit_log");
  await pool.query("DROP TABLE IF EXISTS assets");
  await pool.query(await fs.readFile(m1MigrationPath, "utf8"));
  await applyOptionalM2Migration(pool);

  let id = 0;
  const repository = new PostgresAssetRepository(pool);
  const service = new AssetService(repository, {
    now: () => new Date("2026-09-12T16:00:00.000Z"),
    generateId: () => `30000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
  });
  return { repository, service };
}

afterEach(async () => {
  if (pool) await pool.end();
  pool = null;
});

const context = {
  tenantId: "tenant-a",
  userId: "user-postgres-m2",
  correlationId: "corr-postgres-m2-0001",
  permissions: ["assets:read", "assets:write"],
};

const registration = {
  code: "ATIVO-M2-001",
  name: "Ativo M2",
  assetType: "equipamento",
  status: "active",
  technicalData: { vendor: "Axesistemas" },
};

const suite = databaseUrl ? describe : describe.skip;

suite("M2 PostgreSQL history", () => {
  it("provides the asset_versions and asset_event_outbox tables", async () => {
    await loadSubject();
    const result = await pool!.query(
      "SELECT to_regclass('public.asset_versions') AS versions, to_regclass('public.asset_event_outbox') AS outbox",
    );

    expect(result.rows[0]).toEqual({
      versions: "asset_versions",
      outbox: "asset_event_outbox",
    });
  });

  it("persists immutable snapshots and versioned outbox events", async () => {
    const { service } = await loadSubject();
    const created = await service.create(context, registration);
    await service.update(context, created.id, {
      expectedVersion: 1,
      status: "maintenance",
      change: {
        reason: "scheduled-maintenance",
        origin: "maintenance-api",
      },
    });

    const history = await service.history(context, created.id);
    expect(history.map(item => ({
      version: item.version,
      status: item.status,
      reason: item.reason,
      origin: item.origin,
    }))).toEqual([
      {
        version: 1,
        status: "active",
        reason: "initial-registration",
        origin: "api",
      },
      {
        version: 2,
        status: "maintenance",
        reason: "scheduled-maintenance",
        origin: "maintenance-api",
      },
    ]);

    const events = await pool!.query(
      "SELECT event_type, event_version, asset_version, tenant_id, correlation_id FROM asset_event_outbox WHERE asset_id = $1 ORDER BY asset_version",
      [created.id],
    );
    expect(events.rows).toEqual([
      {
        event_type: "asset.created",
        event_version: "1",
        asset_version: 1,
        tenant_id: "tenant-a",
        correlation_id: "corr-postgres-m2-0001",
      },
      {
        event_type: "asset.updated",
        event_version: "1",
        asset_version: 2,
        tenant_id: "tenant-a",
        correlation_id: "corr-postgres-m2-0001",
      },
    ]);
  });
});
