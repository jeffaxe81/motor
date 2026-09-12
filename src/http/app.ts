import Fastify, { type FastifyRequest } from "fastify";
import { AssetService, type AssetServiceDependencies } from "../application/assetService.js";
import type { AssetRepository } from "../application/assetRepository.js";
import { AssetError, type AssetRequestContext } from "../domain/asset.js";

export type AssetContextResolver = (request: FastifyRequest) => AssetRequestContext | Promise<AssetRequestContext>;
export interface BuildAssetAppOptions { repository: AssetRepository; resolveContext: AssetContextResolver; serviceDependencies?: AssetServiceDependencies; }
function correlationIdFrom(request: FastifyRequest): string { const header = request.headers["x-correlation-id"]; return typeof header === "string" && header.trim() ? header.trim() : request.id; }

export function buildAssetApp(options: BuildAssetAppOptions) {
  const app = Fastify({ logger: false });
  const service = new AssetService(options.repository, options.serviceDependencies);
  app.setErrorHandler((error, request, reply) => {
    const correlationId = correlationIdFrom(request);
    if (error instanceof AssetError) return reply.status(error.httpStatus).send({ envelopeVersion: "1", correlationId, error: { code: error.code, message: error.message, retryable: false } });
    request.log.error({ err: error, correlationId }, "Unhandled asset API error");
    return reply.status(500).send({ envelopeVersion: "1", correlationId, error: { code: "internal.error", message: "Internal server error", retryable: false } });
  });
  app.post("/api/v1/assets", async (request, reply) => { const context = await options.resolveContext(request); const asset = await service.create(context, request.body); return reply.status(201).send(asset); });
  app.get("/api/v1/assets", async request => { const context = await options.resolveContext(request); return service.search(context, request.query); });
  app.get("/api/v1/assets/map", async request => { const context = await options.resolveContext(request); const query = request.query as Record<string, string | undefined>; return service.searchByBounds(context, { minLatitude: Number(query.minLatitude), maxLatitude: Number(query.maxLatitude), minLongitude: Number(query.minLongitude), maxLongitude: Number(query.maxLongitude) }); });
  app.get("/api/v1/assets/:id/timeline", async request => { const context = await options.resolveContext(request); const { id } = request.params as { id: string }; return service.timeline(context, id); });
  app.get("/api/v1/assets/:id/evidence", async request => { const context = await options.resolveContext(request); const { id } = request.params as { id: string }; return service.listEvidence(context, id); });
  app.post("/api/v1/assets/:id/evidence", async (request, reply) => { const context = await options.resolveContext(request); const { id } = request.params as { id: string }; return reply.status(201).send(await service.addEvidence(context, id, request.body)); });
  app.get("/api/v1/assets/:id/inspections", async request => { const context = await options.resolveContext(request); const { id } = request.params as { id: string }; return service.listInspections(context, id); });
  app.post("/api/v1/assets/:id/inspections", async (request, reply) => { const context = await options.resolveContext(request); const { id } = request.params as { id: string }; return reply.status(201).send(await service.recordInspection(context, id, request.body)); });
  app.get("/api/v1/assets/:id/maintenance", async request => { const context = await options.resolveContext(request); const { id } = request.params as { id: string }; return service.listMaintenance(context, id); });
  app.post("/api/v1/assets/:id/maintenance", async (request, reply) => { const context = await options.resolveContext(request); const { id } = request.params as { id: string }; return reply.status(201).send(await service.recordMaintenance(context, id, request.body)); });
  app.get("/api/v1/assets/:id/history", async request => { const context = await options.resolveContext(request); const { id } = request.params as { id: string }; return service.history(context, id); });
  app.get("/api/v1/assets/:id/compare", async request => { const context = await options.resolveContext(request); const { id } = request.params as { id: string }; const { fromVersion, toVersion } = request.query as { fromVersion?: string; toVersion?: string }; return service.compare(context, id, Number(fromVersion), Number(toVersion)); });
  app.get("/api/v1/assets/:id/location", async request => { const context = await options.resolveContext(request); const { id } = request.params as { id: string }; return service.getLocation(context, id); });
  app.put("/api/v1/assets/:id/location", async request => { const context = await options.resolveContext(request); const { id } = request.params as { id: string }; return service.setLocation(context, id, request.body); });
  app.get("/api/v1/assets/:id", async request => { const context = await options.resolveContext(request); const { id } = request.params as { id: string }; return service.get(context, id); });
  app.patch("/api/v1/assets/:id", async request => { const context = await options.resolveContext(request); const { id } = request.params as { id: string }; return service.update(context, id, request.body); });
  return app;
}
