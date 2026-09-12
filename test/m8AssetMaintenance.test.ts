import { describe, expect, it } from "vitest";
import { AssetService } from "../src/application/assetService.js";
import { InMemoryAssetRepository } from "../src/adapters/inMemoryAssetRepository.js";

const context = (tenantId: string) => ({
  tenantId,
  userId: "user-maintenance",
  correlationId: `corr-maintenance-${tenantId}`,
  permissions: ["assets:read", "assets:write"],
});

function serviceWithIds(repository: InMemoryAssetRepository) {
  let id = 0;
  return new AssetService(repository, {
    now: (() => {
      let second = 0;
      return () => new Date(`2026-09-12T21:00:${String(second++).padStart(2, "0")}.000Z`);
    })(),
    generateId: () => `90000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
  });
}

describe("M8 maintenance records", () => {
  it("records parts, costs and warranty metadata without becoming an ERP ledger", async () => {
    const repository = new InMemoryAssetRepository();
    const service = serviceWithIds(repository);
    const asset = await service.create(context("tenant-a"), {
      code: "AT-M8-001",
      name: "Ativo manutenção",
      assetType: "poste",
      status: "ativo",
      technicalData: {},
    });

    const record = await service.recordMaintenance(context("tenant-a"), asset.id, {
      kind: "repair",
      description: "Substituição de componente",
      parts: [
        { code: "P-001", description: "Relé", quantity: 2, unitCost: 15.5 },
      ],
      costs: [
        { category: "labor", amount: 80, currency: "BRL" },
      ],
      warranty: {
        reference: "warranty:relay:001",
        validUntil: "2027-09-12",
        documentReference: "storage://tenant-a/warranties/relay-001.pdf",
      },
      links: {
        inspectionId: "inspection:123",
        orderReference: "dispatch-order:456",
      },
      source: "maintenance-api",
    });

    expect(record).toMatchObject({
      tenantId: "tenant-a",
      assetId: asset.id,
      kind: "repair",
      source: "maintenance-api",
      totalCost: 111,
    });
    expect(record.parts[0]).toMatchObject({ code: "P-001", quantity: 2, unitCost: 15.5 });
  });

  it("rejects invalid monetary values", async () => {
    const repository = new InMemoryAssetRepository();
    const service = serviceWithIds(repository);
    const asset = await service.create(context("tenant-a"), {
      code: "AT-M8-002",
      name: "Ativo custo inválido",
      assetType: "poste",
      status: "ativo",
      technicalData: {},
    });

    await expect(service.recordMaintenance(context("tenant-a"), asset.id, {
      kind: "repair",
      description: "Custo inválido",
      parts: [{ code: "P-002", description: "Peça", quantity: 1, unitCost: -1 }],
      costs: [],
      source: "api",
    })).rejects.toMatchObject({ code: "validation.invalid" });
  });

  it("preserves historical records and tenant isolation", async () => {
    const repository = new InMemoryAssetRepository();
    const service = serviceWithIds(repository);
    const asset = await service.create(context("tenant-a"), {
      code: "AT-M8-003",
      name: "Ativo histórico",
      assetType: "poste",
      status: "ativo",
      technicalData: {},
    });

    const created = await service.recordMaintenance(context("tenant-a"), asset.id, {
      kind: "inspection-repair",
      description: "Ajuste de conexão",
      parts: [],
      costs: [{ category: "labor", amount: 50, currency: "BRL" }],
      source: "field-app",
    });
    created.costs[0]!.amount = 999;

    const listed = await service.listMaintenance(context("tenant-a"), asset.id);
    expect(listed[0]?.costs[0]?.amount).toBe(50);
    await expect(service.listMaintenance(context("tenant-b"), asset.id)).rejects.toMatchObject({
      code: "asset.not_found",
    });
  });

  it("publishes maintenance records in the asset timeline", async () => {
    const repository = new InMemoryAssetRepository();
    const service = serviceWithIds(repository);
    const asset = await service.create(context("tenant-a"), {
      code: "AT-M8-004",
      name: "Ativo timeline manutenção",
      assetType: "poste",
      status: "ativo",
      technicalData: {},
    });

    await service.recordMaintenance(context("tenant-a"), asset.id, {
      kind: "repair",
      description: "Troca preventiva",
      parts: [],
      costs: [],
      source: "field-app",
    });

    const timeline = await service.timeline(context("tenant-a"), asset.id);
    expect(timeline.some(item => item.type === "asset.maintenance.recorded")).toBe(true);
  });
});
