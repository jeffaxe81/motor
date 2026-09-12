import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { afterEach, describe, expect, it } from "vitest";
import { AssetService } from "../src/application/assetService.js";

const repositoryModulePath = "../src/persistence/postgresAssetRepository.js";
const migrationPath = path.resolve(process.cwd(), "drizzle/0000_m1_assets.sql");
const databaseUrl = process.env.DATABASE_URL;

let pool: Pool | null = null;

async function loadSubject() {
  if (!databaseUrl) throw new Error("DATABASE_URL is required for PostgreSQL integration tests");
  const { PostgresAssetRepository } = await import(repositoryModulePath);
  pool = new Pool({ connectionString: databaseUrl });
  const migration = await fs.readFile(migrationPath, "utf8");

  await pool.query("DROP TABLE IF EXISTS asset_audit_log");
  await pool.query("DROP TABLE IF EXISTS assets");
  await pool.query(migration);

  let id = 0;
  const repository = new PostgresAssetRepository(pool);
  const service = new AssetService(repository, {
    now: () => new Date("2026-09-12T15:00:00.000Z"),
    generateId: () => `10000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
  });

  return { repository, service };
}

afterEach(async () => {
  if (pool) await pool.end();
  pool = null;
});

const context = (tenantId: string) => ({
  tenantId,
  userId: "user-postgres",
  correlationId: `corr-postgres-${tenantId}`,
  permissions: ["assets:read", "assets:write"],
});

const registration = {
  code: "ATIVO-DB-001",
  name: "Ativo PostgreSQL",
  assetType: "equipamento",
  status: "ativo",
  technicalData: { vendor: "Axesistemas", capacity: 10 },
};

const suite = databaseUrl ? describe : describe.skip;

suite("M1 PostgresAssetRepository", () => {
  it("persists tenant-scoped assets and enforces code uniqueness per tenant", async () => {
    const { repository, service } = await loadSubject();

    const tenantA = await service.create(context("tenant-a"), registration);
    const tenantB = await service.create(context("tenant-b"), registration);

    await expect(service.create(context("tenant-a"), registration)).rejects.toMatchObject({
      code: "asset.code_conflict",
    });

    expect(await repository.findById("tenant-b", tenantA.id)).toBeNull();
    expect((await repository.findById("tenant-a", tenantA.id))?.id).toBe(tenantA.id);
    expect(tenantB.code).toBe(tenantA.code);

    const rows = await pool!.query("SELECT tenant_id, code FROM assets ORDER BY tenant_id");
    expect(rows.rows).toEqual([
      { tenant_id: "tenant-a", code: "ATIVO-DB-001" },
      { tenant_id: "tenant-b", code: "ATIVO-DB-001" },
    ]);
  });

  it("applies optimistic concurrency atomically", async () => {
    const { service } = await loadSubject();
    const created = await service.create(context("tenant-a"), registration);

    const winner = await service.update(context("tenant-a"), created.id, {
      expectedVersion: 1,
      name: "Atualização persistida",
    });
    expect(winner.version).toBe(2);

    await expect(service.update(context("tenant-a"), created.id, {
      expectedVersion: 1,
      name: "Atualização obsoleta",
    })).rejects.toMatchObject({ code: "asset.version_conflict" });

    const persisted = await pool!.query(
      "SELECT name, version FROM assets WHERE tenant_id = $1 AND id = $2",
      ["tenant-a", created.id],
    );
    expect(persisted.rows[0]).toEqual({ name: "Atualização persistida", version: 2 });
  });

  it("writes asset state and audit in the same transaction", async () => {
    const { service } = await loadSubject();
    const created = await service.create(context("tenant-a"), registration);
    await service.update(context("tenant-a"), created.id, {
      expectedVersion: 1,
      status: "manutencao",
    });

    const audit = await pool!.query(
      "SELECT action, version, tenant_id, actor_user_id, correlation_id FROM asset_audit_log WHERE asset_id = $1 ORDER BY id",
      [created.id],
    );

    expect(audit.rows).toEqual([
      {
        action: "created",
        version: 1,
        tenant_id: "tenant-a",
        actor_user_id: "user-postgres",
        correlation_id: "corr-postgres-tenant-a",
      },
      {
        action: "updated",
        version: 2,
        tenant_id: "tenant-a",
        actor_user_id: "user-postgres",
        correlation_id: "corr-postgres-tenant-a",
      },
    ]);
  });
});
