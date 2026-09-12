import { describe, expect, it } from "vitest";
import { InMemoryAssetRepository } from "../src/adapters/inMemoryAssetRepository.js";
import { buildAssetApp } from "../src/http/app.js";

const context = { tenantId:"tenant-a", userId:"user-http-dispatch", correlationId:"corr-http-dispatch-0001", permissions:["assets:read","assets:write"] };

describe("M10 dispatch reference HTTP",()=>{
  it("creates idempotently and lists external dispatch references",async()=>{
    let id=0;
    const app=buildAssetApp({repository:new InMemoryAssetRepository(),resolveContext:()=>context,serviceDependencies:{generateId:()=>`e0000000-0000-4000-8000-${String(++id).padStart(12,"0")}`}});
    const created=await app.inject({method:"POST",url:"/api/v1/assets",payload:{code:"HTTP-D-1",name:"Poste",assetType:"poste",status:"ativo",technicalData:{}}});
    const asset=created.json();
    const payload={referenceType:"order",referenceId:"dispatch-order:42",source:"dispatch",idempotencyKey:"tenant-a:order:42"};
    const first=await app.inject({method:"POST",url:`/api/v1/assets/${asset.id}/dispatch-references`,payload});
    const second=await app.inject({method:"POST",url:`/api/v1/assets/${asset.id}/dispatch-references`,payload});
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(second.json().id).toBe(first.json().id);
    const listed=await app.inject({method:"GET",url:`/api/v1/assets/${asset.id}/dispatch-references`});
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toHaveLength(1);
  });
});
