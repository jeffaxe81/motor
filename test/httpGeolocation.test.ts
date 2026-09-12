import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";
import { InMemoryAssetRepository } from "../src/adapters/inMemoryAssetRepository.js";
import { buildAssetApp } from "../src/http/app.js";

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
  "x-user-id": "user-http-geo",
  "x-correlation-id": "corr-http-geo-0001",
  "x-permissions": "assets:read,assets:write",
};

const registration = {
  code: "POSTE-HTTP-GEO-001",
  name: "Poste HTTP Geo",
  assetType: "poste-iluminacao",
  status: "ativo",
  technicalData: {},
};

describe("M3 geolocation REST API", () => {
  it("stores location and returns it through the map bounds endpoint", async () => {
    const app = buildAssetApp({ repository: new InMemoryAssetRepository(), resolveContext });

    const created = (await app.inject({
      method: "POST",
      url: "/api/v1/assets",
      headers,
      payload: registration,
    })).json();

    const location = await app.inject({
      method: "PUT",
      url: `/api/v1/assets/${created.id}/location`,
      headers,
      payload: {
        latitude: -27.5945,
        longitude: -48.5477,
        source: "web-map",
      },
    });
    expect(location.statusCode).toBe(200);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/assets/map?minLatitude=-27.7&maxLatitude=-27.4&minLongitude=-48.7&maxLongitude=-48.4",
      headers: { ...headers, "x-permissions": "assets:read" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      expect.objectContaining({
        assetId: created.id,
        latitude: -27.5945,
        longitude: -48.5477,
        source: "web-map",
      }),
    ]);
    await app.close();
  });

  it("returns validation.invalid for invalid coordinates", async () => {
    const app = buildAssetApp({ repository: new InMemoryAssetRepository(), resolveContext });
    const created = (await app.inject({
      method: "POST",
      url: "/api/v1/assets",
      headers,
      payload: registration,
    })).json();

    const response = await app.inject({
      method: "PUT",
      url: `/api/v1/assets/${created.id}/location`,
      headers,
      payload: { latitude: -91, longitude: -48.5, source: "web-map" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("validation.invalid");
    await app.close();
  });
});
