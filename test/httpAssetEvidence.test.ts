import { describe, expect, it } from "vitest";
import { InMemoryAssetRepository } from "../src/adapters/inMemoryAssetRepository.js";
import { buildAssetApp } from "../src/http/app.js";

const context = {
  tenantId: "tenant-a",
  userId: "user-http-evidence",
  correlationId: "corr-http-evidence-0001",
  permissions: ["assets:read", "assets:write"],
};

describe("M6 HTTP asset evidence", () => {
  it("registers and lists evidence metadata and exposes it in timeline", async () => {
    const repository = new InMemoryAssetRepository();
    let id = 0;
    const app = buildAssetApp({
      repository,
      resolveContext: async () => context,
      serviceDependencies: {
        now: (() => {
          let second = 0;
          return () => new Date(`2026-09-12T19:00:${String(second++).padStart(2, "0")}.000Z`);
        })(),
        generateId: () => `73000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
      },
    });

    const created = (await app.inject({
      method: "POST",
      url: "/api/v1/assets",
      payload: {
        code: "AT-HTTP-EV-001",
        name: "Ativo HTTP Evidencia",
        assetType: "poste",
        status: "ativo",
        technicalData: {},
      },
    })).json();

    const added = await app.inject({
      method: "POST",
      url: `/api/v1/assets/${created.id}/evidence`,
      payload: {
        kind: "report",
        fileName: "laudo.pdf",
        mediaType: "application/pdf",
        sizeBytes: 4096,
        storageKey: "tenant-a/assets/AT-HTTP-EV-001/laudo.pdf",
        sha256: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        source: "inspection-api",
        signatureReference: "signature-module:456",
      },
    });
    expect(added.statusCode).toBe(201);
    expect(added.json()).not.toHaveProperty("content");

    const listed = await app.inject({ method: "GET", url: `/api/v1/assets/${created.id}/evidence` });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toHaveLength(1);

    const timeline = await app.inject({ method: "GET", url: `/api/v1/assets/${created.id}/timeline` });
    expect(timeline.statusCode).toBe(200);
    expect(timeline.json().some((item: { type: string }) => item.type === "asset.evidence.added")).toBe(true);

    await app.close();
  });
});
