import Fastify, { type FastifyRequest } from "fastify";
import { AssetService, type AssetServiceDependencies } from "../application/assetService.js";
import type { AssetRepository } from "../application/assetRepository.js";
import { AssetError, type AssetRequestContext } from "../domain/asset.js";

export type AssetContextResolver = (
  request: FastifyRequest,
) => AssetRequestContext | Promise<AssetRequestContext>;

export interface BuildAssetAppOptions {
  repository: AssetRepository;
  resolveContext: AssetContextResolver;
  serviceDependencies?: AssetServiceDependencies;
}

function correlationIdFrom(request: FastifyRequest): string {
  const header = request.headers["x-correlation-id"];
  return typeof header === "string" && header.trim() ? header.trim() : request.id;
}

export function buildAssetApp(options: BuildAssetAppOptions) {
  const app = Fastify({ logger: false });
  const service = new AssetService(options.repository, options.serviceDependencies);

  app.setErrorHandler((error, request, reply) => {
    const correlationId = correlationIdFrom(request);

    if (error instanceof AssetError) {
      return reply.status(error.httpStatus).send({
        envelopeVersion: "1",
        correlationId,
        error: {
          code: error.code,
          message: error.message,
          retryable: false,
        },
      });
    }

    request.log.error({ err: error, correlationId }, "Unhandled asset API error");
    return reply.status(500).send({
      envelopeVersion: "1",
      correlationId,
      error: {
        code: "internal.error",
        message: "Internal server error",
        retryable: false,
      },
    });
  });

  app.post("/api/v1/assets", async (request, reply) => {
    const context = await options.resolveContext(request);
    const asset = await service.create(context, request.body);
    return reply.status(201).send(asset);
  });

  app.get("/api/v1/assets/:id", async request => {
    const context = await options.resolveContext(request);
    const { id } = request.params as { id: string };
    return service.get(context, id);
  });

  app.patch("/api/v1/assets/:id", async request => {
    const context = await options.resolveContext(request);
    const { id } = request.params as { id: string };
    return service.update(context, id, request.body);
  });

  return app;
}
