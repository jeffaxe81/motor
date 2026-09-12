import { describe, expect, it } from "vitest";
import { AssetService } from "../src/application/assetService.js";
import { InMemoryAssetRepository } from "../src/adapters/inMemoryAssetRepository.js";

const context = (tenantId: string) => ({
  tenantId,
  userId: "user-evidence",
  correlationId: `corr-evidence-${tenantId}`,
  permissions: ["assets:read", "assets:write"],
});

describe("M6 asset evidence", () => {
  it("registers evidence metadata without storing binary content", async () => {
    const repository = new InMemoryAssetRepository();
    const service = new AssetService(repository, {
      generateId: (() => {
        let id = 0;
        return () => `70000000-0000-4000-8000-${String(++id).padStart(12, "0")}`;
      })(),
    });

    const asset = await service.create(context("tenant-a"), {
      code: "AT-EV-001",
      name: "Ativo com evidencia",
      assetType: "poste",
      status: "ativo",
      technicalData: {},
    });

    const evidence = await service.addEvidence(context("tenant-a"), asset.id, {
      kind: "photo-before",
      fileName: "antes.jpg",
      mediaType: "image/jpeg",
      sizeBytes: 1200,
      storageKey: "tenant-a/assets/AT-EV-001/antes.jpg",
      sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      source: "field-app",
    });

    expect(evidence).toMatchObject({
      tenantId: "tenant-a",
      assetId: asset.id,
      kind: "photo-before",
      storageKey: "tenant-a/assets/AT-EV-001/antes.jpg",
      sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      valid: true,
    });
    expect(evidence).not.toHaveProperty("content");
  });

  it("rejects invalid file metadata", async () => {
    const repository = new InMemoryAssetRepository();
    const service = new AssetService(repository, {
      generateId: (() => {
        let id = 0;
        return () => `71000000-0000-4000-8000-${String(++id).padStart(12, "0")}`;
      })(),
    });
    const asset = await service.create(context("tenant-a"), {
      code: "AT-EV-002",
      name: "Ativo invalido",
      assetType: "poste",
      status: "ativo",
      technicalData: {},
    });

    await expect(service.addEvidence(context("tenant-a"), asset.id, {
      kind: "document",
      fileName: "arquivo.exe",
      mediaType: "application/x-msdownload",
      sizeBytes: 10,
      storageKey: "tenant-a/assets/AT-EV-002/arquivo.exe",
      sha256: "invalid",
      source: "api",
    })).rejects.toMatchObject({ code: "validation.invalid" });
  });

  it("does not expose evidence across tenants and publishes it in the timeline", async () => {
    const repository = new InMemoryAssetRepository();
    const service = new AssetService(repository, {
      generateId: (() => {
        let id = 0;
        return () => `72000000-0000-4000-8000-${String(++id).padStart(12, "0")}`;
      })(),
    });
    const asset = await service.create(context("tenant-a"), {
      code: "AT-EV-003",
      name: "Ativo tenant",
      assetType: "poste",
      status: "ativo",
      technicalData: {},
    });

    await service.addEvidence(context("tenant-a"), asset.id, {
      kind: "report",
      fileName: "laudo.pdf",
      mediaType: "application/pdf",
      sizeBytes: 2048,
      storageKey: "tenant-a/assets/AT-EV-003/laudo.pdf",
      sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      source: "inspection-api",
      signatureReference: "signature-module:123",
    });

    await expect(service.listEvidence(context("tenant-b"), asset.id)).rejects.toMatchObject({
      code: "asset.not_found",
    });

    const timeline = await service.timeline(context("tenant-a"), asset.id);
    expect(timeline.some(item => item.type === "asset.evidence.added")).toBe(true);
  });
});
