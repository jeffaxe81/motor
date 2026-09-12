import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import {
  assetCreateInputSchema,
  assetRequestContextSchema,
  assetUpdateInputSchema,
  codeConflictError,
  forbiddenError,
  notFoundError,
  validationError,
  versionConflictError,
  type Asset,
  type AssetAuditEntry,
  type AssetCreateInput,
  type AssetRequestContext,
  type AssetUpdateInput,
} from "../domain/asset.js";
import type { AssetRepository } from "./assetRepository.js";

export interface AssetServiceDependencies {
  now?: () => Date;
  generateId?: () => string;
}

export class AssetService {
  private readonly now: () => Date;
  private readonly generateId: () => string;

  constructor(
    private readonly repository: AssetRepository,
    dependencies: AssetServiceDependencies = {},
  ) {
    this.now = dependencies.now ?? (() => new Date());
    this.generateId = dependencies.generateId ?? randomUUID;
  }

  async create(contextInput: unknown, input: unknown): Promise<Asset> {
    const context = this.parseContext(contextInput);
    this.requirePermission(context, "assets:write");
    const parsed = this.parseCreate(input);

    if (await this.repository.findByCode(context.tenantId, parsed.code)) {
      throw codeConflictError();
    }

    const now = this.now();
    const asset: Asset = {
      id: this.generateId(),
      tenantId: context.tenantId,
      code: parsed.code,
      name: parsed.name,
      assetType: parsed.assetType,
      status: parsed.status,
      technicalData: structuredClone(parsed.technicalData),
      version: 1,
      createdAt: now,
      createdBy: context.userId,
      updatedAt: now,
      updatedBy: context.userId,
    };

    const audit = this.auditFor(asset, context, "created", now);
    return this.repository.create(asset, audit);
  }

  async get(contextInput: unknown, assetId: string): Promise<Asset> {
    const context = this.parseContext(contextInput);
    this.requirePermission(context, "assets:read");

    const asset = await this.repository.findById(context.tenantId, assetId);
    if (!asset) throw notFoundError();
    return asset;
  }

  async update(contextInput: unknown, assetId: string, input: unknown): Promise<Asset> {
    const context = this.parseContext(contextInput);
    this.requirePermission(context, "assets:write");
    const parsed = this.parseUpdate(input);

    const current = await this.repository.findById(context.tenantId, assetId);
    if (!current) throw notFoundError();

    if (parsed.code !== undefined && parsed.code !== current.code) {
      const withCode = await this.repository.findByCode(context.tenantId, parsed.code);
      if (withCode && withCode.id !== current.id) throw codeConflictError();
    }

    const now = this.now();
    const next: Asset = {
      ...current,
      ...(parsed.code !== undefined ? { code: parsed.code } : {}),
      ...(parsed.name !== undefined ? { name: parsed.name } : {}),
      ...(parsed.assetType !== undefined ? { assetType: parsed.assetType } : {}),
      ...(parsed.status !== undefined ? { status: parsed.status } : {}),
      ...(parsed.technicalData !== undefined
        ? { technicalData: structuredClone(parsed.technicalData) }
        : {}),
      version: current.version + 1,
      updatedAt: now,
      updatedBy: context.userId,
    };

    const result = await this.repository.update(
      context.tenantId,
      assetId,
      parsed.expectedVersion,
      next,
      this.auditFor(next, context, "updated", now),
    );

    if (result.status === "not_found") throw notFoundError();
    if (result.status === "version_conflict") throw versionConflictError();
    if (result.status === "code_conflict") throw codeConflictError();
    return result.asset;
  }

  private parseContext(input: unknown): AssetRequestContext {
    try {
      return assetRequestContextSchema.parse(input);
    } catch (error) {
      if (error instanceof ZodError) throw validationError();
      throw error;
    }
  }

  private parseCreate(input: unknown): AssetCreateInput {
    try {
      return assetCreateInputSchema.parse(input);
    } catch (error) {
      if (error instanceof ZodError) throw validationError();
      throw error;
    }
  }

  private parseUpdate(input: unknown): AssetUpdateInput {
    try {
      return assetUpdateInputSchema.parse(input);
    } catch (error) {
      if (error instanceof ZodError) throw validationError();
      throw error;
    }
  }

  private requirePermission(context: AssetRequestContext, permission: string): void {
    if (!context.permissions.includes(permission)) throw forbiddenError();
  }

  private auditFor(
    asset: Asset,
    context: AssetRequestContext,
    action: AssetAuditEntry["action"],
    occurredAt: Date,
  ): AssetAuditEntry {
    return {
      tenantId: context.tenantId,
      assetId: asset.id,
      action,
      actorUserId: context.userId,
      version: asset.version,
      correlationId: context.correlationId,
      occurredAt,
    };
  }
}
