import type { Asset, AssetAuditEntry } from "../domain/asset.js";
import { codeConflictError } from "../domain/asset.js";
import type { AssetRepository, AssetUpdateResult } from "../application/assetRepository.js";

const assetKey = (tenantId: string, assetId: string) => `${tenantId}\u0000${assetId}`;
const codeKey = (tenantId: string, code: string) => `${tenantId}\u0000${code}`;

function cloneAsset(asset: Asset): Asset {
  return {
    ...asset,
    technicalData: structuredClone(asset.technicalData),
    createdAt: new Date(asset.createdAt),
    updatedAt: new Date(asset.updatedAt),
  };
}

function cloneAudit(entry: AssetAuditEntry): AssetAuditEntry {
  return { ...entry, occurredAt: new Date(entry.occurredAt) };
}

export class InMemoryAssetRepository implements AssetRepository {
  private readonly assets = new Map<string, Asset>();
  private readonly codes = new Map<string, string>();
  private readonly audit: AssetAuditEntry[] = [];

  async findById(tenantId: string, assetId: string): Promise<Asset | null> {
    const asset = this.assets.get(assetKey(tenantId, assetId));
    return asset ? cloneAsset(asset) : null;
  }

  async findByCode(tenantId: string, code: string): Promise<Asset | null> {
    const id = this.codes.get(codeKey(tenantId, code));
    return id ? this.findById(tenantId, id) : null;
  }

  async create(asset: Asset, audit: AssetAuditEntry): Promise<Asset> {
    const index = codeKey(asset.tenantId, asset.code);
    if (this.codes.has(index)) throw codeConflictError();

    const stored = cloneAsset(asset);
    this.assets.set(assetKey(asset.tenantId, asset.id), stored);
    this.codes.set(index, asset.id);
    this.audit.push(cloneAudit(audit));
    return cloneAsset(stored);
  }

  async update(
    tenantId: string,
    assetId: string,
    expectedVersion: number,
    nextAsset: Asset,
    audit: AssetAuditEntry,
  ): Promise<AssetUpdateResult> {
    const key = assetKey(tenantId, assetId);
    const current = this.assets.get(key);
    if (!current) return { status: "not_found" };
    if (current.version !== expectedVersion) return { status: "version_conflict" };

    const nextCodeIndex = codeKey(tenantId, nextAsset.code);
    const conflictingId = this.codes.get(nextCodeIndex);
    if (conflictingId && conflictingId !== assetId) return { status: "code_conflict" };

    if (nextAsset.code !== current.code) {
      this.codes.delete(codeKey(tenantId, current.code));
      this.codes.set(nextCodeIndex, assetId);
    }

    const stored = cloneAsset(nextAsset);
    this.assets.set(key, stored);
    this.audit.push(cloneAudit(audit));
    return { status: "updated", asset: cloneAsset(stored) };
  }

  async listAudit(tenantId: string, assetId: string): Promise<AssetAuditEntry[]> {
    return this.audit
      .filter(entry => entry.tenantId === tenantId && entry.assetId === assetId)
      .map(cloneAudit);
  }

  async countAssets(): Promise<number> {
    return this.assets.size;
  }
}
