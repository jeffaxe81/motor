import { describe, expect, it } from "vitest";
import { AssetService } from "../src/application/assetService.js";
import { InMemoryAssetRepository } from "../src/adapters/inMemoryAssetRepository.js";

const context=(tenantId:string)=>({tenantId,userId:"user-telemetry",correlationId:`corr-telemetry-${tenantId}`,permissions:["assets:read","assets:write"]});
function subject(){let id=0;return new AssetService(new InMemoryAssetRepository(),{generateId:()=>`11000000-0000-4000-8000-${String(++id).padStart(12,"0")}`});}

describe("M11 asset telemetry",()=>{
  it("records a versioned relevant telemetry event idempotently",async()=>{
    const service=subject();
    const asset=await service.create(context("tenant-a"),{code:"TEL-1",name:"Sensor",assetType:"sensor",status:"ativo",technicalData:{}});
    const input={eventId:"evt-001",eventVersion:"1",eventType:"temperature.alert",occurredAt:"2026-09-12T17:00:00.000Z",source:"iot-gateway",relevant:true,payload:{celsius:82.4}};
    const first=await service.recordTelemetry(context("tenant-a"),asset.id,input);
    const second=await service.recordTelemetry(context("tenant-a"),asset.id,input);
    expect(second.id).toBe(first.id);
    expect(await service.listTelemetry(context("tenant-a"),asset.id)).toHaveLength(1);
    expect((await service.timeline(context("tenant-a"),asset.id)).some(item=>item.type==="asset.telemetry.recorded")).toBe(true);
  });

  it("rejects invalid payload/version and isolates tenant",async()=>{
    const service=subject();
    const asset=await service.create(context("tenant-a"),{code:"TEL-2",name:"Sensor",assetType:"sensor",status:"ativo",technicalData:{}});
    await expect(service.recordTelemetry(context("tenant-a"),asset.id,{eventId:"",eventVersion:"",eventType:"temperature",occurredAt:"invalid",source:"iot",relevant:true,payload:{}})).rejects.toMatchObject({code:"validation.invalid"});
    await expect(service.listTelemetry(context("tenant-b"),asset.id)).rejects.toMatchObject({code:"asset.not_found"});
  });

  it("does not add non-relevant telemetry to the historical timeline",async()=>{
    const service=subject();
    const asset=await service.create(context("tenant-a"),{code:"TEL-3",name:"Sensor",assetType:"sensor",status:"ativo",technicalData:{}});
    await service.recordTelemetry(context("tenant-a"),asset.id,{eventId:"evt-noise",eventVersion:"1",eventType:"heartbeat",occurredAt:"2026-09-12T17:01:00.000Z",source:"iot-gateway",relevant:false,payload:{online:true}});
    const timeline=await service.timeline(context("tenant-a"),asset.id);
    expect(timeline.some(item=>item.type==="asset.telemetry.recorded")).toBe(false);
  });
});
