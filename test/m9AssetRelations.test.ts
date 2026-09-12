import { describe, expect, it } from "vitest";
import { AssetService } from "../src/application/assetService.js";
import { InMemoryAssetRepository } from "../src/adapters/inMemoryAssetRepository.js";

const context = (tenantId: string) => ({ tenantId, userId: "user-relations", correlationId: `corr-relations-${tenantId}`, permissions: ["assets:read", "assets:write"] });

function serviceWithIds(repository: InMemoryAssetRepository) {
  let id = 0;
  return new AssetService(repository, { generateId: () => `a0000000-0000-4000-8000-${String(++id).padStart(12, "0")}` });
}

describe("M9 asset relations", () => {
  it("links two assets in the same tenant with an explicit relation type", async () => {
    const repository = new InMemoryAssetRepository();
    const service = serviceWithIds(repository);
    const parent = await service.create(context("tenant-a"), { code: "AT-R-001", name: "Poste", assetType: "poste", status: "ativo", technicalData: {} });
    const child = await service.create(context("tenant-a"), { code: "AT-R-002", name: "Luminária", assetType: "luminaria", status: "ativo", technicalData: {} });

    const relation = await service.linkAsset(context("tenant-a"), parent.id, {
      relatedAssetId: child.id,
      relationType: "contains",
      source: "inventory-ui",
    });

    expect(relation).toMatchObject({ tenantId: "tenant-a", assetId: parent.id, relatedAssetId: child.id, relationType: "contains" });
    const listed = await service.listRelatedAssets(context("tenant-a"), parent.id);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.relatedAssetId).toBe(child.id);
  });

  it("rejects self relation and cross-tenant relation", async () => {
    const repository = new InMemoryAssetRepository();
    const service = serviceWithIds(repository);
    const a = await service.create(context("tenant-a"), { code: "AT-R-003", name: "A", assetType: "poste", status: "ativo", technicalData: {} });
    const b = await service.create(context("tenant-b"), { code: "AT-R-004", name: "B", assetType: "poste", status: "ativo", technicalData: {} });

    await expect(service.linkAsset(context("tenant-a"), a.id, { relatedAssetId: a.id, relationType: "contains", source: "api" })).rejects.toMatchObject({ code: "validation.invalid" });
    await expect(service.linkAsset(context("tenant-a"), a.id, { relatedAssetId: b.id, relationType: "contains", source: "api" })).rejects.toMatchObject({ code: "asset.not_found" });
  });

  it("publishes relations in the asset timeline", async () => {
    const repository = new InMemoryAssetRepository();
    const service = serviceWithIds(repository);
    const a = await service.create(context("tenant-a"), { code: "AT-R-005", name: "A", assetType: "poste", status: "ativo", technicalData: {} });
    const b = await service.create(context("tenant-a"), { code: "AT-R-006", name: "B", assetType: "sensor", status: "ativo", technicalData: {} });
    await service.linkAsset(context("tenant-a"), a.id, { relatedAssetId: b.id, relationType: "monitors", source: "api" });
    const timeline = await service.timeline(context("tenant-a"), a.id);
    expect(timeline.some(item => item.type === "asset.relation.added")).toBe(true);
  });
});
