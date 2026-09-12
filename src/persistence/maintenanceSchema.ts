import { foreignKey, index, jsonb, pgTable, timestamp, varchar, uuid, doublePrecision } from "drizzle-orm/pg-core";
import { assets } from "./schema.js";
import type { AssetMaintenanceInput } from "../domain/asset.js";

export const assetMaintenance = pgTable(
  "asset_maintenance",
  {
    id: uuid("id").primaryKey(),
    tenantId: varchar("tenant_id", { length: 128 }).notNull(),
    assetId: uuid("asset_id").notNull(),
    kind: varchar("kind", { length: 100 }).notNull(),
    description: varchar("description", { length: 500 }).notNull(),
    parts: jsonb("parts").$type<AssetMaintenanceInput["parts"]>().notNull(),
    costs: jsonb("costs").$type<AssetMaintenanceInput["costs"]>().notNull(),
    totalCost: doublePrecision("total_cost").notNull(),
    warranty: jsonb("warranty").$type<AssetMaintenanceInput["warranty"]>(),
    links: jsonb("links").$type<AssetMaintenanceInput["links"]>(),
    source: varchar("source", { length: 128 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    createdBy: varchar("created_by", { length: 128 }).notNull(),
    correlationId: varchar("correlation_id", { length: 160 }).notNull(),
  },
  table => [
    foreignKey({
      name: "asset_maintenance_asset_tenant_fk",
      columns: [table.assetId, table.tenantId],
      foreignColumns: [assets.id, assets.tenantId],
    }).onDelete("restrict"),
    index("asset_maintenance_tenant_asset_created_idx").on(table.tenantId, table.assetId, table.createdAt),
  ],
);
