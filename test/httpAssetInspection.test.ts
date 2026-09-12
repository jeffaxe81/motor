import { describe, expect, it } from "vitest";
import { InMemoryAssetRepository } from "../src/adapters/inMemoryAssetRepository.js";
import { buildAssetApp } from "../src/http/app.js";

const context = {
  tenantId: "tenant-a",
  userId: "user-http-inspection",
  correlationId: "corr-http-inspection-0001",
  permissions: ["assets:read", "assets:write"],
};

describe("M7 HTTP inspections", () => {
  it("records and lists finalized inspections", async () => {
    let id = 0;
    const app = buildAssetApp({
      repository: new InMemoryAssetRepository(),
      resolveContext: async () => context,
      serviceDependencies: {
        now: () => new Date("2026-09-12T20:30:00.000Z"),
        generateId: () => `81000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
      },
    });
    const created = (await app.inject({ method: "POST", url: "/api/v1/assets", payload: { code: "AT-HTTP-INSP", name: "Ativo HTTP", assetType: "poste", status: "ativo", technicalData: {} } })).json();
    const response = await app.inject({ method: "POST", url: `/api/v1/assets/${created.id}/inspections`, payload: { checklistReference: "checklist:poste:v1", responses: { estrutura: "ok" }, result: "approved", source: "field-app" } });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ assetId: created.id, status: "finalized", result: "approved" });
    const list = await app.inject({ method: "GET", url: `/api/v1/assets/${created.id}/inspections` });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toHaveLength(1);
    await app.close();
  });
});
