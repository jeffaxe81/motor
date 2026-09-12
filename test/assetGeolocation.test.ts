import { describe, expect, it } from "vitest";
import { InMemoryAssetRepository } from "../src/adapters/inMemoryAssetRepository.js";
import { AssetService } from "../src/application/assetService.js";

const context = (tenantId = "tenant-a") => ({
  tenantId,
  userId: "user-geo",
  correlationId: `corr-geo-${tenantId}`,
  permissions: ["assets:read", "assets:write"],
});

function fixture() {
  let id = 0;
  const repository = new InMemoryAssetRepository();
  const service = new AssetService(repository, {
    now: () => new Date("2026-09-12T17:00:00.000Z"),
    generateId: () => `40000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
  });
  return { service };
}

const registration = (code: string) => ({
  code,
  name: `Ativo ${code}`,
  assetType: "poste-iluminacao",
  status: "ativo",
  technicalData: {},
});

describe("M3 asset geolocation", () => {
  it("associates a valid geographic position to an asset", async () => {
    const { service } = fixture();
    const asset = await service.create(context(), registration("POSTE-GEO-001"));
    const located = await (service as any).setLocation(context(), asset.id, {
      latitude: -27.5945,
      longitude: -48.5477,
      source: "field-app",
    });
    expect(located).toMatchObject({
      tenantId: "tenant-a",
      assetId: asset.id,
      latitude: -27.5945,
      longitude: -48.5477,
      source: "field-app",
      updatedBy: "user-geo",
    });
  });

  it("rejects coordinates outside the geographic limits", async () => {
    const { service } = fixture();
    const asset = await service.create(context(), registration("POSTE-GEO-002"));
    await expect((service as any).setLocation(context(), asset.id, {
      latitude: 91,
      longitude: -48.5,
      source: "field-app",
    })).rejects.toMatchObject({ code: "validation.invalid" });
    await expect((service as any).setLocation(context(), asset.id, {
      latitude: -27.5,
      longitude: 181,
      source: "field-app",
    })).rejects.toMatchObject({ code: "validation.invalid" });
  });

  it("returns only tenant assets inside the requested bounding box", async () => {
    const { service } = fixture();
    const inside = await service.create(context("tenant-a"), registration("POSTE-GEO-003"));
    const outside = await service.create(context("tenant-a"), registration("POSTE-GEO-004"));
    const otherTenant = await service.create(context("tenant-b"), registration("POSTE-GEO-005"));
    const geo = service as any;
    await geo.setLocation(context("tenant-a"), inside.id, { latitude: -27.59, longitude: -48.55, source: "field-app" });
    await geo.setLocation(context("tenant-a"), outside.id, { latitude: -26.30, longitude: -48.84, source: "field-app" });
    await geo.setLocation(context("tenant-b"), otherTenant.id, { latitude: -27.59, longitude: -48.55, source: "field-app" });
    const result = await geo.searchByBounds(context("tenant-a"), {
      minLatitude: -27.70,
      maxLatitude: -27.40,
      minLongitude: -48.70,
      maxLongitude: -48.40,
    });
    expect(result.map((item: { assetId: string }) => item.assetId)).toEqual([inside.id]);
  });
});
