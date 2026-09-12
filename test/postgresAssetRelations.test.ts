import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { afterEach, describe, expect, it } from "vitest";
import { AssetService } from "../src/application/assetService.js";

const databaseUrl = process.env.DATABASE_URL;
let pool: Pool | null = null;
const migrations = ["drizzle/0000_m1_assets.sql","drizzle/0001_m2_asset_history.sql","drizzle/0002_m3_asset_locations.sql","drizzle/0003_m6_asset_evidence.sql","drizzle/0004_m7_asset_inspections.sql","drizzle/0005_m8_asset_maintenance.sql","drizzle/0006_m9_asset_relations.sql"];

async function loadSubject() {
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const { PostgresAssetRepository } = await import("../src/persistence/postgresAssetRepository.js");
  pool = new Pool({ connectionString: databaseUrl });
  for (const table of ["asset_relations","asset_maintenance","asset_inspections","asset_evidence","asset_locations","asset_event_outbox","asset_versions","asset_audit_log","assets"]) await pool.query(`DROP TABLE IF EXISTS ${table}`);
  for (const migration of migrations) await pool.query(await fs.readFile(path.resolve(process.cwd(), migration), "utf8"));
  let id = 0;
  return new AssetService(new PostgresAssetRepository(pool), { generateId: () => `c0000000-0000-4000-8000-${String(++id).padStart(12,"0")}` });
}

afterEach(async()=>{if(pool)await pool.end();pool=null;});
const suite = databaseUrl ? describe : describe.skip;
const context = { tenantId:"tenant-a", userId:"user-pg-rel", correlationId:"corr-pg-relations-0001", permissions:["assets:read","assets:write"] };

suite("M9 PostgreSQL relations",()=>{
  it("persists explicit same-tenant relation",async()=>{
    const service=await loadSubject();
    const a=await service.create(context,{code:"PG-A",name:"A",assetType:"poste",status:"ativo",technicalData:{}});
    const b=await service.create(context,{code:"PG-B",name:"B",assetType:"sensor",status:"ativo",technicalData:{}});
    await service.linkAsset(context,a.id,{relatedAssetId:b.id,relationType:"contains",source:"api"});
    const rows=await pool!.query("SELECT tenant_id, asset_id, related_asset_id, relation_type FROM asset_relations WHERE asset_id=$1",[a.id]);
    expect(rows.rows).toEqual([{tenant_id:"tenant-a",asset_id:a.id,related_asset_id:b.id,relation_type:"contains"}]);
  });
});
