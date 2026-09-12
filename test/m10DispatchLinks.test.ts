import { describe, expect, it } from "vitest";
import { AssetService } from "../src/application/assetService.js";
import { InMemoryAssetRepository } from "../src/adapters/inMemoryAssetRepository.js";

const context = (tenantId: string) => ({ tenantId, userId: "user-dispatch-link", correlationId: `corr-dispatch-link-${tenantId}`, permissions: ["assets:read", "assets:write"] });

function serviceWithIds(repository: InMemoryAssetRepository) {
  let id = 0;
  return new AssetService(repository, { generateId: () => `d0000000-0000-4000-8000-${String(++id).padStart(12, "0")}` });
}

describe("M10 dispatch occurrence and order links", () => {
  it("links an external dispatch reference idempotently to the asset", async () => {
    const service = serviceWithIds(new InMemoryAssetRepository());
    const asset = await service.create(context("tenant-a"), { code: "AT-D-001", name: "Poste", assetType: "poste", status: "ativo", technicalData: {} });
    const input = { referenceType: "order", referenceId: "dispatch-order:456", source: "dispatch", idempotencyKey: "tenant-a:order:456" };
    const first = await service.linkDispatchReference(context("tenant-a"), asset.id, input);
    const second = await service.linkDispatchReference(context("tenant-a"), asset.id, input);
    expect(second.id).toBe(first.id);
    expect((await service.listDispatchReferences(context("tenant-a"), asset.id))).toHaveLength(1);
  });

  it("keeps references isolated by tenant", async () => {
    const service = serviceWithIds(new InMemoryAssetRepository());
    const asset = await service.create(context("tenant-a"), { code: "AT-D-002", name: "Ativo", assetType: "poste", status: "ativo", technicalData: {} });
    await service.linkDispatchReference(context("tenant-a"), asset.id, { referenceType: "occurrence", referenceId: "dispatch-occurrence:123", source: "dispatch", idempotencyKey: "tenant-a:occ:123" });
    await expect(service.listDispatchReferences(context("tenant-b"), asset.id)).rejects.toMatchObject({ code: "asset.not_found" });
  });

  it("publishes dispatch links in the asset timeline", async () => {
    const service = serviceWithIds(new InMemoryAssetRepository());
    const asset = await service.create(context("tenant-a"), { code: "AT-D-003", name: "Ativo", assetType: "poste", status: "ativo", technicalData: {} });
    await service.linkDispatchReference(context("tenant-a"), asset.id, { referenceType: "activity", referenceId: "dispatch-activity:789", source: "dispatch", idempotencyKey: "tenant-a:activity:789" });
    const timeline = await service.timeline(context("tenant-a"), asset.id);
    expect(timeline.some(item => item.type === "asset.dispatch.reference.linked")).toBe(true);
  });
});
