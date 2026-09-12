import { describe, expect, it } from "vitest";
import { InMemoryAssetRepository } from "../src/adapters/inMemoryAssetRepository.js";
import { AssetService } from "../src/application/assetService.js";

const context = {
  tenantId: "tenant-a",
  userId: "user-maintenance",
  correlationId: "corr-history-meta-0001",
  permissions: ["assets:read", "assets:write"],
};

describe("M2 asset history metadata", () => {
  it("records supplied reason and origin on the new immutable version", async () => {
    const repository = new InMemoryAssetRepository();
    let now = new Date("2026-09-12T12:00:00.000Z");
    const service = new AssetService(repository, {
      generateId: () => "20000000-0000-4000-8000-000000000001",
      now: () => now,
    });

    const created = await service.create(context, {
      code: "ATIVO-META-001",
      name: "Ativo com histórico",
      assetType: "equipamento",
      status: "active",
      technicalData: {},
    });

    now = new Date("2026-09-12T12:15:00.000Z");
    await service.update(context, created.id, {
      expectedVersion: 1,
      status: "maintenance",
      change: {
        reason: "preventive-inspection",
        origin: "maintenance-api",
      },
    });

    const history = await service.history(context, created.id);
    expect(history[0]).toMatchObject({
      version: 1,
      reason: "initial-registration",
      origin: "api",
      changedBy: "user-maintenance",
      correlationId: "corr-history-meta-0001",
    });
    expect(history[1]).toMatchObject({
      version: 2,
      reason: "preventive-inspection",
      origin: "maintenance-api",
      changedBy: "user-maintenance",
      correlationId: "corr-history-meta-0001",
    });
    expect(history[1]?.changedAt.toISOString()).toBe("2026-09-12T12:15:00.000Z");
  });
});
