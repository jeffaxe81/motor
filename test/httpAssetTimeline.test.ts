import { describe, expect, it } from "vitest";
import { InMemoryAssetRepository } from "../src/adapters/inMemoryAssetRepository.js";
import { buildAssetApp } from "../src/http/app.js";

const context = {
  tenantId: "tenant-a",
  userId: "user-http-timeline",
  correlationId: "corr-http-timeline-0001",
  permissions: ["assets:read", "assets:write"],
};

describe("M5 HTTP asset timeline", () => {
  it("returns the canonical timeline through the asset API", async () => {
    const repository = new InMemoryAssetRepository();
    let id = 0;
    const app = buildAssetApp({
      repository,
      resolveContext: async () => context,
      serviceDependencies: {
        now: (() => {
          let second = 0;
          return () => new Date(`2026-09-12T18:00:${String(second++).padStart(2, "0")}.000Z`);
        })(),
        generateId: () => `60000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
      },
    });

    const createdResponse = await app.inject({
      method: "POST",
      url: "/api/v1/assets",
      payload: {
        code: "AT-HTTP-001",
        name: "Ativo HTTP Timeline",
        assetType: "poste",
        status: "ativo",
        technicalData: {},
      },
    });
    const created = createdResponse.json();

    await app.inject({
      method: "PATCH",
      url: `/api/v1/assets/${created.id}`,
      payload: {
        expectedVersion: 1,
        status: "manutencao",
        change: { reason: "inspection", origin: "field-app" },
      },
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/assets/${created.id}/timeline`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveLength(2);
    expect(body.map((item: { type: string }) => item.type)).toEqual(["asset.created", "asset.updated"]);
    expect(body[1]).toMatchObject({
      source: "field-app",
      reason: "inspection",
      authorUserId: "user-http-timeline",
      version: 2,
    });

    await app.close();
  });
});
