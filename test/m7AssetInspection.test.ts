import { describe, expect, it } from "vitest";
import { AssetService } from "../src/application/assetService.js";
import { InMemoryAssetRepository } from "../src/adapters/inMemoryAssetRepository.js";

const context = (tenantId: string) => ({
  tenantId,
  userId: "user-inspection",
  correlationId: `corr-inspection-${tenantId}`,
  permissions: ["assets:read", "assets:write"],
});

function serviceWithIds(repository: InMemoryAssetRepository) {
  let id = 0;
  return new AssetService(repository, {
    now: (() => {
      let second = 0;
      return () => new Date(`2026-09-12T20:00:${String(second++).padStart(2, "0")}.000Z`);
    })(),
    generateId: () => `80000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
  });
}

describe("M7 asset inspections and checklists", () => {
  it("records a finalized inspection with checklist, answers, author and optional location", async () => {
    const repository = new InMemoryAssetRepository();
    const service = serviceWithIds(repository);
    const asset = await service.create(context("tenant-a"), {
      code: "AT-INSP-001",
      name: "Poste inspecionado",
      assetType: "poste",
      status: "ativo",
      technicalData: {},
    });

    const inspection = await service.recordInspection(context("tenant-a"), asset.id, {
      checklistReference: "checklist:poste:v1",
      responses: {
        estruturaIntegra: true,
        observacao: "sem anomalias",
      },
      result: "approved",
      source: "field-app",
      location: { latitude: -27.59, longitude: -48.55 },
    });

    expect(inspection).toMatchObject({
      tenantId: "tenant-a",
      assetId: asset.id,
      checklistReference: "checklist:poste:v1",
      result: "approved",
      status: "finalized",
      createdBy: "user-inspection",
      source: "field-app",
      location: { latitude: -27.59, longitude: -48.55 },
    });
  });

  it("links only evidence that belongs to the same asset and tenant", async () => {
    const repository = new InMemoryAssetRepository();
    const service = serviceWithIds(repository);
    const asset = await service.create(context("tenant-a"), {
      code: "AT-INSP-002",
      name: "Poste com anexo",
      assetType: "poste",
      status: "ativo",
      technicalData: {},
    });
    const otherAsset = await service.create(context("tenant-a"), {
      code: "AT-INSP-003",
      name: "Outro poste",
      assetType: "poste",
      status: "ativo",
      technicalData: {},
    });
    const evidence = await service.addEvidence(context("tenant-a"), asset.id, {
      kind: "photo-after",
      fileName: "vistoria.jpg",
      mediaType: "image/jpeg",
      sizeBytes: 1024,
      storageKey: "tenant-a/assets/AT-INSP-002/vistoria.jpg",
      sha256: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      source: "field-app",
    });
    const foreignEvidence = await service.addEvidence(context("tenant-a"), otherAsset.id, {
      kind: "photo-after",
      fileName: "outro.jpg",
      mediaType: "image/jpeg",
      sizeBytes: 1024,
      storageKey: "tenant-a/assets/AT-INSP-003/outro.jpg",
      sha256: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      source: "field-app",
    });

    const inspection = await service.recordInspection(context("tenant-a"), asset.id, {
      checklistReference: "checklist:poste:v1",
      responses: { fotoConferida: true },
      result: "approved",
      source: "field-app",
      evidenceIds: [evidence.id],
    });
    expect(inspection.evidenceIds).toEqual([evidence.id]);

    await expect(service.recordInspection(context("tenant-a"), asset.id, {
      checklistReference: "checklist:poste:v1",
      responses: { fotoConferida: true },
      result: "approved",
      source: "field-app",
      evidenceIds: [foreignEvidence.id],
    })).rejects.toMatchObject({ code: "validation.invalid" });
  });

  it("keeps finalized inspections immutable and isolated by tenant", async () => {
    const repository = new InMemoryAssetRepository();
    const service = serviceWithIds(repository);
    const asset = await service.create(context("tenant-a"), {
      code: "AT-INSP-004",
      name: "Ativo imutavel",
      assetType: "poste",
      status: "ativo",
      technicalData: {},
    });

    const created = await service.recordInspection(context("tenant-a"), asset.id, {
      checklistReference: "checklist:poste:v1",
      responses: { aterramento: "ok" },
      result: "approved",
      source: "inspection-api",
    });

    created.responses.aterramento = "alterado";
    const listed = await service.listInspections(context("tenant-a"), asset.id);
    expect(listed[0]?.responses).toEqual({ aterramento: "ok" });

    await expect(service.listInspections(context("tenant-b"), asset.id)).rejects.toMatchObject({
      code: "asset.not_found",
    });
  });

  it("publishes finalized inspections in the asset timeline", async () => {
    const repository = new InMemoryAssetRepository();
    const service = serviceWithIds(repository);
    const asset = await service.create(context("tenant-a"), {
      code: "AT-INSP-005",
      name: "Ativo timeline",
      assetType: "poste",
      status: "ativo",
      technicalData: {},
    });

    await service.recordInspection(context("tenant-a"), asset.id, {
      checklistReference: "checklist:poste:v1",
      responses: { estrutura: "ok" },
      result: "approved",
      source: "field-app",
    });

    const timeline = await service.timeline(context("tenant-a"), asset.id);
    expect(timeline.some(item => item.type === "asset.inspection.finalized")).toBe(true);
  });
});
