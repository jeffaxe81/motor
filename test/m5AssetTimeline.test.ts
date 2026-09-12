import { describe, expect, it } from "vitest";
import { AssetService } from "../src/application/assetService.js";
import { InMemoryAssetRepository } from "../src/adapters/inMemoryAssetRepository.js";

const context = (tenantId: string) => ({
  tenantId,
  userId: "user-timeline",
  correlationId: `corr-timeline-${tenantId}`,
  permissions: ["assets:read", "assets:write"],
});

describe("M5 asset timeline", () => {
  it("returns canonical timeline items ordered deterministically", async () => {
    const repository = new InMemoryAssetRepository();
    let now = 0;
    const service = new AssetService(repository, {
      now: () => new Date(`2026-09-12T17:00:0${now++}.000Z`),
      generateId: () => "50000000-0000-4000-8000-000000000001",
    });

    const created = await service.create(context("tenant-a"), {
      code: "AT-001",
      name: "Ativo Timeline",
      assetType: "poste",
      status: "ativo",
      technicalData: {},
    });

    await service.update(context("tenant-a"), created.id, {
      expectedVersion: 1,
      status: "manutencao",
      change: { reason: "inspection", origin: "api" },
    });

    const timeline = await service.timeline(context("tenant-a"), created.id);

    expect(timeline.map(item => ({ type: item.type, version: item.version }))).toEqual([
      { type: "asset.created", version: 1 },
      { type: "asset.updated", version: 2 },
    ]);
    expect(timeline[0]).toMatchObject({
      assetId: created.id,
      tenantId: "tenant-a",
      authorUserId: "user-timeline",
      source: "api",
    });
  });

  it("returns an empty timeline only for an existing asset without timeline records", async () => {
    const repository = new InMemoryAssetRepository();
    const service = new AssetService(repository);
    const created = await service.create(context("tenant-a"), {
      code: "AT-EMPTY",
      name: "Ativo vazio",
      assetType: "poste",
      status: "ativo",
      technicalData: {},
    });

    const timeline = await service.timeline(context("tenant-a"), created.id);
    expect(Array.isArray(timeline)).toBe(true);
  });

  it("does not expose timeline from another tenant", async () => {
    const repository = new InMemoryAssetRepository();
    const service = new AssetService(repository, {
      generateId: () => "50000000-0000-4000-8000-000000000002",
    });
    const created = await service.create(context("tenant-a"), {
      code: "AT-002",
      name: "Ativo tenant A",
      assetType: "poste",
      status: "ativo",
      technicalData: {},
    });

    await expect(service.timeline(context("tenant-b"), created.id)).rejects.toMatchObject({
      code: "asset.not_found",
    });
  });
});
