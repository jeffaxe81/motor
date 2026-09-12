import { describe, expect, it } from "vitest";
import { InMemoryAssetRepository } from "../src/adapters/inMemoryAssetRepository.js";
import { buildAssetApp } from "../src/http/app.js";

const context = { tenantId: "tenant-a", userId: "user-http-m8", correlationId: "corr-http-m8-0001", permissions: ["assets:read", "assets:write"] };

describe("M8 HTTP maintenance", () => {
  it("records and lists maintenance through REST", async () => {
    const repository = new InMemoryAssetRepository(); let id = 0;
    const app = buildAssetApp({ repository, resolveContext: async () => context, serviceDependencies: { generateId: () => `91000000-0000-4000-8000-${String(++id).padStart(12, "0")}` } });
    const created = (await app.inject({ method: "POST", url: "/api/v1/assets", payload: { code: "AT-M8-HTTP", name: "Ativo", assetType: "poste", status: "ativo", technicalData: {} } })).json();
    const response = await app.inject({ method: "POST", url: `/api/v1/assets/${created.id}/maintenance`, payload: { kind: "repair", description: "Troca", parts: [{ code: "P1", description: "Peça", quantity: 2, unitCost: 10 }], costs: [{ category: "labor", amount: 30, currency: "BRL" }], source: "api" } });
    expect(response.statusCode).toBe(201); expect(response.json().totalCost).toBe(50);
    const list = await app.inject({ method: "GET", url: `/api/v1/assets/${created.id}/maintenance` });
    expect(list.statusCode).toBe(200); expect(list.json()).toHaveLength(1);
    await app.close();
  });
});
