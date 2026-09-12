import type { Asset, AssetAuditEntry, AssetVersionSnapshot } from "../domain/asset.js";

export type AssetUpdateResult =
  | { status: "updated"; asset: Asset }
  | { status: "not_found" }
  | { status: "version_conflict" }
  | { status: "code_conflict" };

export interface AssetRepository {
  findById(tenantId: string, assetId: string): Promise<Asset | null>;
  findByCode(tenantId: string, code: string): Promise<Asset | null>;
  listHistory(tenantId: string, assetId: string): Promise<AssetVersionSnapshot[]>;
  create(asset: Asset, audit: AssetAuditEntry): Promise<Asset>;
  update(
    tenantId: string,
    assetId: string,
    expectedVersion: number,
    nextAsset: Asset,
    audit: AssetAuditEntry,
  ): Promise<AssetUpdateResult>;
}
