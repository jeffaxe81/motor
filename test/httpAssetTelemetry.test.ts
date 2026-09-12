import { describe, expect, it } from "vitest";
import { InMemoryAssetRepository } from "../src/adapters/inMemoryAssetRepository.js";
import { buildAssetApp } from "../src/http/app.js";

const context={tenantId:"tenant-a",userId:"user-http-telemetry",correlationId:"corr-http-telemetry-0001",permissions:["assets:read","assets:write"]};

describe("M11 telemetry HTTP",()=>{
  it("records idempotently and lists telemetry",async()=>{
    let id=0;
    const app=buildAssetApp({repository:new InMemoryAssetRepository(),resolveContext:()=>context,serviceDependencies:{generateId:()=>`12000000-0000-4000-8000-${String(++id).padStart(12,"0")}`}});
    const created=await app.inject({method:"POST",url:"/api/v1/assets",payload:{code:"HTTP-TEL-1",name:"Sensor",assetType:"sensor",status:"ativo",technicalData:{}}});
    const asset=created.json();
    const payload={eventId:"evt-http-001",eventVersion:"1",eventType:"temperature.alert",occurredAt:"2026-09-12T17:00:00.000Z",source:"iot-gateway",relevant:true,payload:{celsius:81}};
    const first=await app.inject({method:"POST",url:`/api/v1/assets/${asset.id}/telemetry`,payload});
    const second=await app.inject({method:"POST",url:`/api/v1/assets/${asset.id}/telemetry`,payload});
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(second.json().id).toBe(first.json().id);
    const listed=await app.inject({method:"GET",url:`/api/v1/assets/${asset.id}/telemetry`});
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toHaveLength(1);
  });
});
