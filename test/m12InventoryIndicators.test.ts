import { describe, expect, it } from "vitest";
import { AssetService } from "../src/application/assetService.js";
import { InMemoryAssetRepository } from "../src/adapters/inMemoryAssetRepository.js";

const context=(tenantId:string)=>({tenantId,userId:"user-indicators",correlationId:`corr-indicators-${tenantId}`,permissions:["assets:read","assets:write"]});
function subject(){let id=0;return new AssetService(new InMemoryAssetRepository(),{generateId:()=>`14000000-0000-4000-8000-${String(++id).padStart(12,"0")}`});}

describe("M12 inventory indicators",()=>{
  it("derives indicators only from records already present in the tenant prontuario",async()=>{
    const service=subject();
    const a=await service.create(context("tenant-a"),{code:"IND-1",name:"Poste A",assetType:"poste",status:"ativo",technicalData:{}});
    await service.create(context("tenant-a"),{code:"IND-2",name:"Poste B",assetType:"poste",status:"inativo",technicalData:{}});
    await service.create(context("tenant-b"),{code:"IND-X",name:"Outro tenant",assetType:"poste",status:"ativo",technicalData:{}});
    await service.recordMaintenance(context("tenant-a"),a.id,{kind:"corrective",description:"Troca de componente",parts:[{code:"P1",description:"Peça",quantity:1,unitCost:100}],costs:[{category:"labor",amount:50,currency:"BRL"}],source:"field-app"});
    await service.recordInspection(context("tenant-a"),a.id,{checklistReference:"CHK-1",responses:{ok:true},result:"approved",source:"field-app"});

    const indicators=await service.inventoryIndicators(context("tenant-a"));
    expect(indicators).toEqual({
      totalAssets:2,
      assetsByStatus:{ativo:1,inativo:1},
      maintenanceRecords:1,
      maintenanceTotalCost:150,
      finalizedInspections:1,
    });
  });
});
