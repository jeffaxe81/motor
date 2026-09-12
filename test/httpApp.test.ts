import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";
import { InMemoryAssetRepository } from "../src/adapters/inMemoryAssetRepository.js";

const appModulePath = "../src/http/app.js";

function resolveContext(request: FastifyRequest) {
  const tenantId = String(request.headers["x-tenant-id"] ?? "");
  const userId = String(request.headers["x-user-id"] ?? "");
  const correlationId = String(request.headers["x-correlation-id"] ?? "");
  const permissions = String(request.headers["x-permissions"] ?? "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);

  return { tenantId, userId, correlationId, permissions };
}

const headers = (tenantId = "tenant-a", permissions = "assets:read,assets:write") => ({
  "x-tenant-id": tenantId,
  "x-user-id": "user-api",
  "x-correlation-id": "corr-http-m1-0001",
  "x-permissions": permissions,
});

const payload = {
  code: "POSTE-HTTP-001",
  name: "Poste HTTP 001",
  assetType: "poste-iluminacao",
  status: "ativo",
  technicalData: { material: "concreto" },
};

describe("M1 assets REST API", () => {
  it("creates and retrieves an asset through /api/v1", async () => {
    const { buildAssetApp } = await import(appModulePath);
    const app = buildAssetApp({ repository: new InMemoryAssetRepository(), resolveContext });

    const createdResponse = await app.inject({
      method: "POST",
      url: "/api/v1/assets",
      headers: headers(),
      payload,
    });

    expect(createdResponse.statusCode).toBe(201);
    const created = createdResponse.json();
    expect(created).toMatchObject({
      tenantId: "tenant-a",
      code: payload.code,
      version: 1,
    });

    const fetchedResponse = await app.inject({
      method: "GET",
      url: `/api/v1/assets/${created.id}`,
      headers: headers("tenant-a", "assets:read"),
    });

    expect(fetchedResponse.statusCode).toBe(200);
    expect(fetchedResponse.json()).toMatchObject({ id: created.id, tenantId: "tenant-a" });
    await app.close();
  });

  it("returns a strict correlated forbidden error", async () => {
    const { buildAssetApp } = await import(appModulePath);
    const app = buildAssetApp({ repository: new InMemoryAssetRepository(), resolveContext });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/assets",
      headers: headers("tenant-a", "assets:read"),
      payload,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      envelopeVersion: "1",
      correlationId: "corr-http-m1-0001",
      error: {
        code: "authorization.forbidden",
        message: "Operation not permitted",
        retryable: false,
      },
    });
    await app.close();
  });

  it("returns 400 for an invalid registration body", async () => {
    const { buildAssetApp } = await import(appModulePath);
    const app = buildAssetApp({ repository: new InMemoryAssetRepository(), resolveContext });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/assets",
      headers: headers(),
      payload: { ...payload, code: "" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      correlationId: "corr-http-m1-0001",
      error: { code: "validation.invalid" },
    });
    await app.close();
  });

  it("returns 404 when another tenant tries to read an asset", async () => {
    const { buildAssetApp } = await import(appModulePath);
    const app = buildAssetApp({ repository: new InMemoryAssetRepository(), resolveContext });

    const created = (await app.inject({
      method: "POST",
      url: "/api/v1/assets",
      headers: headers("tenant-a"),
      payload,
    })).json();

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/assets/${created.id}`,
      headers: headers("tenant-b", "assets:read"),
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: "asset.not_found" } });
    await app.close();
  });

  it("returns 409 for a stale PATCH and preserves the winning version", async () => {
    const { buildAssetApp } = await import(appModulePath);
    const app = buildAssetApp({ repository: new InMemoryAssetRepository(), resolveContext });

    const created = (await app.inject({
      method: "POST",
      url: "/api/v1/assets",
      headers: headers(),
      payload,
    })).json();

    const winner = await app.inject({
      method: "PATCH",
      url: `/api/v1/assets/${created.id}`,
      headers: headers(),
      payload: { expectedVersion: 1, name: "Versão vencedora" },
    });
    expect(winner.statusCode).toBe(200);
    expect(winner.json()).toMatchObject({ name: "Versão vencedora", version: 2 });

    const stale = await app.inject({
      method: "PATCH",
      url: `/api/v1/assets/${created.id}`,
      headers: headers(),
      payload: { expectedVersion: 1, name: "Versão obsoleta" },
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({ error: { code: "asset.version_conflict" } });

    const current = await app.inject({
      method: "GET",
      url: `/api/v1/assets/${created.id}`,
      headers: headers("tenant-a", "assets:read"),
    });
    expect(current.json()).toMatchObject({ name: "Versão vencedora", version: 2 });
    await app.close();
  });
});
