import { describe, expect, it } from "vitest";
import { InMemoryAssetRepository } from "../src/adapters/inMemoryAssetRepository.js";
import { buildAssetApp } from "../src/http/app.js";

const context={tenantId:"tenant-a",userId:"user-http-indicators",correlationId:"corr-http-indicators-0001",permissions:["assets:read","assets:write"]};

describe("M12 inventory indicators HTTP",()=>{
  it("returns indicators derived from the tenant records",async()=>{
    let id=0;
    const app=buildAssetApp({repository:new InMemoryAssetRepository(),resolveContext:()=>context,serviceDependencies:{generateId:()=>`15000000-0000-4000-8000-${String(++id).padStart(12,"0")}`}});
    const created=await app.inject({method:"POST",url:"/api/v1/assets",payload:{code:"HTTP-I-1",name:"Poste",assetType:"poste",status:"ativo",technicalData:{}}});
    const asset=created.json();
    await app.inject({method:"POST",url:`/api/v1/assets/${asset.id}/maintenance`,payload:{kind:"preventive",description:"Revisão",parts:[],costs:[{category:"labor",amount:80,currency:"BRL"}],source:"field-app"}});
    await app.inject({method:"POST",url:`/api/v1/assets/${asset.id}/inspections`,payload:{checklistReference:"CHK-HTTP",responses:{ok:true},result:"approved",source:"field-app"}});
    const response=await app.inject({method:"GET",url:"/api/v1/inventory/indicators"});
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({totalAssets:1,assetsByStatus:{ativo:1},maintenanceRecords:1,maintenanceTotalCost:80,finalizedInspections:1});
    await app.close();
  });
});
