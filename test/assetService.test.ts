import { describe, expect, it } from "vitest";

const serviceModulePath = "../src/application/assetService.js";
const repositoryModulePath = "../src/adapters/inMemoryAssetRepository.js";

async function loadSubject() {
  const [{ AssetService }, { InMemoryAssetRepository }] = await Promise.all([
    import(serviceModulePath),
    import(repositoryModulePath),
  ]);

  let id = 0;
  const repository = new InMemoryAssetRepository();
  const service = new AssetService(repository, {
    now: () => new Date("2026-09-12T14:30:00.000Z"),
    generateId: () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
  });

  return { service, repository };
}

const writer = (tenantId = "tenant-a") => ({
  tenantId,
  userId: "user-writer",
  correlationId: "corr-m1-writer-0001",
  permissions: ["assets:read", "assets:write"],
});

const reader = (tenantId = "tenant-a") => ({
  tenantId,
  userId: "user-reader",
  correlationId: "corr-m1-reader-0001",
  permissions: ["assets:read"],
});

const validAsset = {
  code: "POSTE-001",
  name: "Poste 001",
  assetType: "poste-iluminacao",
  status: "ativo",
  technicalData: {
    material: "concreto",
    heightMeters: 12,
  },
};

describe("M1 AssetService", () => {
  it("creates an asset with internal identity, version 1 and audit", async () => {
    const { service, repository } = await loadSubject();

    const created = await service.create(writer(), validAsset);

    expect(created).toMatchObject({
      id: "00000000-0000-4000-8000-000000000001",
      tenantId: "tenant-a",
      code: "POSTE-001",
      name: "Poste 001",
      assetType: "poste-iluminacao",
      status: "ativo",
      technicalData: validAsset.technicalData,
      version: 1,
      createdBy: "user-writer",
      updatedBy: "user-writer",
    });
    expect(created.createdAt.toISOString()).toBe("2026-09-12T14:30:00.000Z");
    expect(created.updatedAt.toISOString()).toBe("2026-09-12T14:30:00.000Z");

    const audit = await repository.listAudit("tenant-a", created.id);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      action: "created",
      tenantId: "tenant-a",
      assetId: created.id,
      actorUserId: "user-writer",
      version: 1,
      correlationId: "corr-m1-writer-0001",
    });
  });

  it("rejects invalid technical registration without persisting", async () => {
    const { service, repository } = await loadSubject();

    await expect(service.create(writer(), {
      ...validAsset,
      code: " ",
    })).rejects.toMatchObject({ code: "validation.invalid" });

    expect(await repository.countAssets()).toBe(0);
  });

  it("enforces write and read permissions", async () => {
    const { service } = await loadSubject();

    await expect(service.create(reader(), validAsset)).rejects.toMatchObject({
      code: "authorization.forbidden",
    });

    const created = await service.create(writer(), validAsset);
    await expect(service.get({
      ...writer(),
      permissions: ["assets:write"],
    }, created.id)).rejects.toMatchObject({
      code: "authorization.forbidden",
    });
  });

  it("does not expose or update an asset from another tenant", async () => {
    const { service } = await loadSubject();
    const created = await service.create(writer("tenant-a"), validAsset);

    await expect(service.get(reader("tenant-b"), created.id)).rejects.toMatchObject({
      code: "asset.not_found",
    });

    await expect(service.update(writer("tenant-b"), created.id, {
      expectedVersion: 1,
      name: "Tentativa indevida",
    })).rejects.toMatchObject({
      code: "asset.not_found",
    });

    expect((await service.get(reader("tenant-a"), created.id)).name).toBe("Poste 001");
  });

  it("keeps asset code unique inside a tenant but allows the same code in another tenant", async () => {
    const { service } = await loadSubject();

    await service.create(writer("tenant-a"), validAsset);
    await expect(service.create(writer("tenant-a"), validAsset)).rejects.toMatchObject({
      code: "asset.code_conflict",
    });

    const otherTenant = await service.create(writer("tenant-b"), validAsset);
    expect(otherTenant.tenantId).toBe("tenant-b");
    expect(otherTenant.code).toBe("POSTE-001");
  });

  it("updates the technical registration, increments the version and audits the change", async () => {
    const { service, repository } = await loadSubject();
    const created = await service.create(writer(), validAsset);

    const updated = await service.update(writer(), created.id, {
      expectedVersion: 1,
      name: "Poste 001 revisado",
      status: "manutencao",
      technicalData: {
        ...validAsset.technicalData,
        inspected: true,
      },
    });

    expect(updated).toMatchObject({
      id: created.id,
      tenantId: "tenant-a",
      name: "Poste 001 revisado",
      status: "manutencao",
      version: 2,
      updatedBy: "user-writer",
    });

    const audit = await repository.listAudit("tenant-a", created.id);
    expect(audit.map((entry: { action: string }) => entry.action)).toEqual(["created", "updated"]);
    expect(audit[1]).toMatchObject({ version: 2, correlationId: "corr-m1-writer-0001" });
  });

  it("rejects stale concurrent updates and preserves the winning state", async () => {
    const { service } = await loadSubject();
    const created = await service.create(writer(), validAsset);

    await service.update(writer(), created.id, {
      expectedVersion: 1,
      name: "Atualização vencedora",
    });

    await expect(service.update(writer(), created.id, {
      expectedVersion: 1,
      name: "Atualização obsoleta",
    })).rejects.toMatchObject({
      code: "asset.version_conflict",
    });

    const current = await service.get(reader(), created.id);
    expect(current.name).toBe("Atualização vencedora");
    expect(current.version).toBe(2);
  });

  it("does not allow tenant, owner or version to be overridden by update payload", async () => {
    const { service } = await loadSubject();
    const created = await service.create(writer(), validAsset);

    await expect(service.update(writer(), created.id, {
      expectedVersion: 1,
      name: "Tentativa",
      tenantId: "tenant-b",
    })).rejects.toMatchObject({ code: "validation.invalid" });
  });
});
