import { describe, expect, it } from "vitest";
import { InMemoryAssetRepository } from "../src/adapters/inMemoryAssetRepository.js";
import { buildAssetApp } from "../src/http/app.js";

const context = { tenantId: "tenant-a", userId: "user-http-rel", correlationId: "corr-http-relations-0001", permissions: ["assets:read", "assets:write"] };

describe("M9 relation HTTP API", () => {
  it("creates and lists asset relations", async () => {
    let id = 0;
    const app = buildAssetApp({
      repository: new InMemoryAssetRepository(),
      resolveContext: () => context,
      serviceDependencies: { generateId: () => `b0000000-0000-4000-8000-${String(++id).padStart(12, "0")}` },
    });
    const a = (await app.inject({ method: "POST", url: "/api/v1/assets", payload: { code: "A", name: "A", assetType: "poste", status: "ativo", technicalData: {} } })).json();
    const b = (await app.inject({ method: "POST", url: "/api/v1/assets", payload: { code: "B", name: "B", assetType: "sensor", status: "ativo", technicalData: {} } })).json();
    const created = await app.inject({ method: "POST", url: `/api/v1/assets/${a.id}/relations`, payload: { relatedAssetId: b.id, relationType: "monitors", source: "ui" } });
    expect(created.statusCode).toBe(201);
    const listed = await app.inject({ method: "GET", url: `/api/v1/assets/${a.id}/relations` });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toHaveLength(1);
    await app.close();
  });
});
