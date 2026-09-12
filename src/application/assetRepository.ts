import type {
  Asset,
  AssetAuditEntry,
  AssetBounds,
  AssetEvidence,
  AssetLocation,
  AssetSearchInput,
  AssetSearchResult,
  AssetVersionSnapshot,
} from "../domain/asset.js";

export type AssetUpdateResult =
  | { status: "updated"; asset: Asset }
  | { status: "not_found" }
  | { status: "version_conflict" }
  | { status: "code_conflict" };

export interface AssetRepository {
  findById(tenantId: string, assetId: string): Promise<Asset | null>;
  findByCode(tenantId: string, code: string): Promise<Asset | null>;
  search(tenantId: string, input: AssetSearchInput): Promise<AssetSearchResult>;
  listHistory(tenantId: string, assetId: string): Promise<AssetVersionSnapshot[]>;
  addEvidence(evidence: AssetEvidence): Promise<AssetEvidence>;
  listEvidence(tenantId: string, assetId: string): Promise<AssetEvidence[]>;
  setLocation(location: AssetLocation): Promise<AssetLocation>;
  findLocation(tenantId: string, assetId: string): Promise<AssetLocation | null>;
  findLocationsByBounds(tenantId: string, bounds: AssetBounds): Promise<AssetLocation[]>;
  create(asset: Asset, audit: AssetAuditEntry): Promise<Asset>;
  update(
    tenantId: string,
    assetId: string,
    expectedVersion: number,
    nextAsset: Asset,
    audit: AssetAuditEntry,
  ): Promise<AssetUpdateResult>;
}
