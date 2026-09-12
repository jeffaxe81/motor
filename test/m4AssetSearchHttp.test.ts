import { describe, expect, it } from "vitest";
import { InMemoryAssetRepository } from "../src/adapters/inMemoryAssetRepository.js";
import { AssetService } from "../src/application/assetService.js";
import { buildAssetApp } from "../src/http/app.js";

const context = {
  tenantId: "tenant-a",
  userId: "user-http-search",
  correlationId: "corr-http-search-0001",
  permissions: ["assets:read", "assets:write"],
};

describe("M4 asset search HTTP", () => {
  it("exposes paginated search with filters", async () => {
    const repository = new InMemoryAssetRepository();
    const service = new AssetService(repository);
    await service.create(context, {
      code: "PST-001",
      name: "Poste Central",
      assetType: "poste",
      status: "ativo",
      technicalData: { manufacturer: "Alpha" },
    });
    await service.create(context, {
      code: "CAM-001",
      name: "Camera Norte",
      assetType: "camera",
      status: "ativo",
      technicalData: { manufacturer: "Beta" },
    });

    const app = buildAssetApp({ repository, resolveContext: async () => context });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/assets?query=central&assetType=poste&page=1&pageSize=10",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(10);
    expect(body.items.map((item: { code: string }) => item.code)).toEqual(["PST-001"]);
    await app.close();
  });

  it("rejects invalid pagination", async () => {
    const repository = new InMemoryAssetRepository();
    const app = buildAssetApp({ repository, resolveContext: async () => context });
    const response = await app.inject({ method: "GET", url: "/api/v1/assets?page=0&pageSize=101" });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("validation.invalid");
    await app.close();
  });
});
