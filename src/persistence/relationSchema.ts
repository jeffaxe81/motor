import { foreignKey, index, pgTable, timestamp, unique, varchar, uuid } from "drizzle-orm/pg-core";
import { assets } from "./schema.js";

export const assetRelations = pgTable(
  "asset_relations",
  {
    id: uuid("id").primaryKey(),
    tenantId: varchar("tenant_id", { length: 128 }).notNull(),
    assetId: uuid("asset_id").notNull(),
    relatedAssetId: uuid("related_asset_id").notNull(),
    relationType: varchar("relation_type", { length: 100 }).notNull(),
    source: varchar("source", { length: 128 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    createdBy: varchar("created_by", { length: 128 }).notNull(),
    correlationId: varchar("correlation_id", { length: 160 }).notNull(),
  },
  table => [
    foreignKey({ name: "asset_relations_asset_tenant_fk", columns: [table.assetId, table.tenantId], foreignColumns: [assets.id, assets.tenantId] }).onDelete("restrict"),
    foreignKey({ name: "asset_relations_related_tenant_fk", columns: [table.relatedAssetId, table.tenantId], foreignColumns: [assets.id, assets.tenantId] }).onDelete("restrict"),
    unique("asset_relations_unique").on(table.tenantId, table.assetId, table.relatedAssetId, table.relationType),
    index("asset_relations_tenant_asset_idx").on(table.tenantId, table.assetId, table.createdAt),
  ],
);
