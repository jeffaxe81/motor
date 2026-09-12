import { describe, expect, it } from "vitest";
import { InMemoryAssetRepository } from "../src/adapters/inMemoryAssetRepository.js";
import { AssetService } from "../src/application/assetService.js";

const tenantA = {
  tenantId: "tenant-a",
  userId: "user-a",
  correlationId: "corr-history-a",
  permissions: ["assets:read", "assets:write"],
};

const tenantB = {
  tenantId: "tenant-b",
  userId: "user-b",
  correlationId: "corr-history-b",
  permissions: ["assets:read", "assets:write"],
};

function serviceFixture() {
  const repository = new InMemoryAssetRepository();
  let now = new Date("2026-09-12T12:00:00.000Z");
  const service = new AssetService(repository, {
    generateId: () => "10000000-0000-4000-8000-000000000001",
    now: () => now,
  });

  return {
    repository,
    service,
    advance() {
      now = new Date("2026-09-12T12:05:00.000Z");
    },
  };
}

describe("M2 asset history", () => {
  it("keeps version 1 immutable after version 2 is created", async () => {
    const { service, advance } = serviceFixture();
    const created = await service.create(tenantA, {
      code: "POSTE-001",
      name: "Poste principal",
      assetType: "poste",
      status: "active",
      technicalData: { material: "concreto" },
    });

    advance();
    await service.update(tenantA, created.id, {
      expectedVersion: 1,
      name: "Poste principal revisado",
      technicalData: { material: "concreto", heightMeters: 12 },
    });

    const history = await (service as unknown as {
      history(context: unknown, assetId: string): Promise<Array<{
        version: number;
        name: string;
        technicalData: Record<string, unknown>;
      }>>;
    }).history(tenantA, created.id);

    expect(history.map(item => item.version)).toEqual([1, 2]);
    expect(history[0]).toMatchObject({
      version: 1,
      name: "Poste principal",
      technicalData: { material: "concreto" },
    });
    expect(history[1]).toMatchObject({
      version: 2,
      name: "Poste principal revisado",
      technicalData: { material: "concreto", heightMeters: 12 },
    });
  });

  it("compares two historical versions by changed field", async () => {
    const { service, advance } = serviceFixture();
    const created = await service.create(tenantA, {
      code: "POSTE-001",
      name: "Poste principal",
      assetType: "poste",
      status: "active",
      technicalData: { material: "concreto" },
    });

    advance();
    await service.update(tenantA, created.id, {
      expectedVersion: 1,
      status: "maintenance",
    });

    const comparison = await (service as unknown as {
      compare(context: unknown, assetId: string, fromVersion: number, toVersion: number): Promise<{
        fromVersion: number;
        toVersion: number;
        changes: Array<{ field: string; before: unknown; after: unknown }>;
      }>;
    }).compare(tenantA, created.id, 1, 2);

    expect(comparison).toEqual({
      fromVersion: 1,
      toVersion: 2,
      changes: [
        { field: "status", before: "active", after: "maintenance" },
      ],
    });
  });

  it("does not expose an asset history across tenants", async () => {
    const { service } = serviceFixture();
    const created = await service.create(tenantA, {
      code: "POSTE-001",
      name: "Poste principal",
      assetType: "poste",
      status: "active",
      technicalData: {},
    });

    await expect((service as unknown as {
      history(context: unknown, assetId: string): Promise<unknown>;
    }).history(tenantB, created.id)).rejects.toMatchObject({
      code: "asset.not_found",
      httpStatus: 404,
    });
  });
});
