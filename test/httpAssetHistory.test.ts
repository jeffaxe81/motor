import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";
import { InMemoryAssetRepository } from "../src/adapters/inMemoryAssetRepository.js";

const appModulePath = "../src/http/app.js";

function resolveContext(request: FastifyRequest) {
  return {
    tenantId: String(request.headers["x-tenant-id"] ?? ""),
    userId: String(request.headers["x-user-id"] ?? ""),
    correlationId: String(request.headers["x-correlation-id"] ?? ""),
    permissions: String(request.headers["x-permissions"] ?? "")
      .split(",")
      .map(value => value.trim())
      .filter(Boolean),
  };
}

const headers = {
  "x-tenant-id": "tenant-a",
  "x-user-id": "user-api-m2",
  "x-correlation-id": "corr-http-m2-0001",
  "x-permissions": "assets:read,assets:write",
};

const payload = {
  code: "ATIVO-HTTP-M2-001",
  name: "Ativo HTTP M2",
  assetType: "equipamento",
  status: "active",
  technicalData: {},
};

describe("M2 assets history REST API", () => {
  it("returns chronological history through /api/v1/assets/:id/history", async () => {
    const { buildAssetApp } = await import(appModulePath);
    const app = buildAssetApp({ repository: new InMemoryAssetRepository(), resolveContext });

    const created = (await app.inject({
      method: "POST",
      url: "/api/v1/assets",
      headers,
      payload,
    })).json();

    const update = await app.inject({
      method: "PATCH",
      url: `/api/v1/assets/${created.id}`,
      headers,
      payload: {
        expectedVersion: 1,
        status: "maintenance",
        change: { reason: "inspection", origin: "web" },
      },
    });
    expect(update.statusCode).toBe(200);

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/assets/${created.id}/history`,
      headers: { ...headers, "x-permissions": "assets:read" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().map((item: { version: number; status: string }) => ({
      version: item.version,
      status: item.status,
    }))).toEqual([
      { version: 1, status: "active" },
      { version: 2, status: "maintenance" },
    ]);
    await app.close();
  });

  it("compares two versions through /api/v1/assets/:id/compare", async () => {
    const { buildAssetApp } = await import(appModulePath);
    const app = buildAssetApp({ repository: new InMemoryAssetRepository(), resolveContext });

    const created = (await app.inject({
      method: "POST",
      url: "/api/v1/assets",
      headers,
      payload,
    })).json();

    await app.inject({
      method: "PATCH",
      url: `/api/v1/assets/${created.id}`,
      headers,
      payload: { expectedVersion: 1, name: "Ativo HTTP M2 revisado" },
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/assets/${created.id}/compare?fromVersion=1&toVersion=2`,
      headers: { ...headers, "x-permissions": "assets:read" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      fromVersion: 1,
      toVersion: 2,
      changes: [
        {
          field: "name",
          before: "Ativo HTTP M2",
          after: "Ativo HTTP M2 revisado",
        },
      ],
    });
    await app.close();
  });
});
