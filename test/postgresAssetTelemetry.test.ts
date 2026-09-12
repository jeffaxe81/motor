import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { afterEach, describe, expect, it } from "vitest";
import { AssetService } from "../src/application/assetService.js";

const databaseUrl=process.env.DATABASE_URL;
let pool:Pool|null=null;
const migrations=["drizzle/0000_m1_assets.sql","drizzle/0001_m2_asset_history.sql","drizzle/0002_m3_asset_locations.sql","drizzle/0003_m6_asset_evidence.sql","drizzle/0004_m7_asset_inspections.sql","drizzle/0005_m8_asset_maintenance.sql","drizzle/0006_m9_asset_relations.sql","drizzle/0007_m10_asset_dispatch_references.sql","drizzle/0008_m11_asset_telemetry.sql"];
async function loadSubject(){if(!databaseUrl)throw new Error("DATABASE_URL is required");const{PostgresAssetRepository}=await import("../src/persistence/postgresAssetRepository.js");pool=new Pool({connectionString:databaseUrl});for(const table of ["asset_telemetry","asset_dispatch_references","asset_relations","asset_maintenance","asset_inspections","asset_evidence","asset_locations","asset_event_outbox","asset_versions","asset_audit_log","assets"])await pool.query(`DROP TABLE IF EXISTS ${table}`);for(const migration of migrations)await pool.query(await fs.readFile(path.resolve(process.cwd(),migration),"utf8"));let id=0;return new AssetService(new PostgresAssetRepository(pool),{generateId:()=>`13000000-0000-4000-8000-${String(++id).padStart(12,"0")}`});}
afterEach(async()=>{if(pool){await pool.query("DROP TABLE IF EXISTS asset_telemetry");await pool.end();}pool=null;});
const suite=databaseUrl?describe:describe.skip;
const context={tenantId:"tenant-a",userId:"user-pg-telemetry",correlationId:"corr-pg-telemetry-0001",permissions:["assets:read","assets:write"]};
suite("M11 PostgreSQL telemetry",()=>{
  it("persists one row for repeated event id",async()=>{
    const service=await loadSubject();
    const asset=await service.create(context,{code:"PG-TEL-1",name:"Sensor",assetType:"sensor",status:"ativo",technicalData:{}});
    const input={eventId:"evt-pg-001",eventVersion:"1",eventType:"temperature.alert",occurredAt:"2026-09-12T17:00:00.000Z",source:"iot-gateway",relevant:true,payload:{celsius:83.2}};
    const first=await service.recordTelemetry(context,asset.id,input);
    const second=await service.recordTelemetry(context,asset.id,input);
    expect(second.id).toBe(first.id);
    const rows=await pool!.query("SELECT event_id,event_version,event_type,relevant,payload FROM asset_telemetry WHERE asset_id=$1",[asset.id]);
    expect(rows.rows).toEqual([{event_id:"evt-pg-001",event_version:"1",event_type:"temperature.alert",relevant:true,payload:{celsius:83.2}}]);
  });
});
