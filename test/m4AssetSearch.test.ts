import { describe, expect, it } from "vitest";
import { AssetService } from "../src/application/assetService.js";
import { InMemoryAssetRepository } from "../src/adapters/inMemoryAssetRepository.js";

const context = (tenantId: string) => ({
  tenantId,
  userId: "user-search",
  correlationId: `corr-search-${tenantId}`,
  permissions: ["assets:read", "assets:write"],
});

async function createAsset(
  service: AssetService,
  tenantId: string,
  code: string,
  name: string,
  assetType: string,
  status: string,
  technicalData: Record<string, unknown>,
) {
  return service.create(context(tenantId), {
    code,
    name,
    assetType,
    status,
    technicalData,
  });
}

describe("M4 asset search and listing", () => {
  it("returns stable paginated results ordered by code and id", async () => {
    const repository = new InMemoryAssetRepository();
    let id = 0;
    const service = new AssetService(repository, {
      generateId: () => `40000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
    });

    await createAsset(service, "tenant-a", "AT-003", "Poste C", "poste", "ativo", {});
    await createAsset(service, "tenant-a", "AT-001", "Poste A", "poste", "ativo", {});
    await createAsset(service, "tenant-a", "AT-002", "Poste B", "poste", "ativo", {});

    const first = await service.search(context("tenant-a"), { page: 1, pageSize: 2 });
    const second = await service.search(context("tenant-a"), { page: 2, pageSize: 2 });

    expect(first.total).toBe(3);
    expect(first.items.map(item => item.code)).toEqual(["AT-001", "AT-002"]);
    expect(second.items.map(item => item.code)).toEqual(["AT-003"]);
  });

  it("searches approved registration fields", async () => {
    const repository = new InMemoryAssetRepository();
    const service = new AssetService(repository);

    await createAsset(service, "tenant-a", "PST-001", "Poste Central", "poste", "ativo", { manufacturer: "Alpha" });
    await createAsset(service, "tenant-a", "CAM-001", "Camera Norte", "camera", "ativo", { manufacturer: "Beta" });

    const byName = await service.search(context("tenant-a"), { query: "central" });
    const byCode = await service.search(context("tenant-a"), { query: "cam-001" });
    const byTechnicalData = await service.search(context("tenant-a"), { query: "alpha" });

    expect(byName.items.map(item => item.code)).toEqual(["PST-001"]);
    expect(byCode.items.map(item => item.code)).toEqual(["CAM-001"]);
    expect(byTechnicalData.items.map(item => item.code)).toEqual(["PST-001"]);
  });

  it("filters by existing approved fields", async () => {
    const repository = new InMemoryAssetRepository();
    const service = new AssetService(repository);

    await createAsset(service, "tenant-a", "PST-001", "Poste 1", "poste", "ativo", {});
    await createAsset(service, "tenant-a", "PST-002", "Poste 2", "poste", "manutencao", {});
    await createAsset(service, "tenant-a", "CAM-001", "Camera", "camera", "ativo", {});

    const result = await service.search(context("tenant-a"), {
      assetType: "poste",
      status: "ativo",
    });

    expect(result.items.map(item => item.code)).toEqual(["PST-001"]);
  });

  it("never returns assets from another tenant", async () => {
    const repository = new InMemoryAssetRepository();
    const service = new AssetService(repository);

    await createAsset(service, "tenant-a", "SHARED-001", "Ativo A", "poste", "ativo", {});
    await createAsset(service, "tenant-b", "SHARED-002", "Ativo B", "poste", "ativo", {});

    const result = await service.search(context("tenant-a"), { query: "Ativo" });

    expect(result.total).toBe(1);
    expect(result.items.map(item => item.code)).toEqual(["SHARED-001"]);
  });
});
