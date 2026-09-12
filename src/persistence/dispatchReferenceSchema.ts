import { foreignKey, index, pgTable, timestamp, unique, varchar, uuid } from "drizzle-orm/pg-core";
import { assets } from "./schema.js";

export const assetDispatchReferences = pgTable(
  "asset_dispatch_references",
  {
    id: uuid("id").primaryKey(),
    tenantId: varchar("tenant_id", { length: 128 }).notNull(),
    assetId: uuid("asset_id").notNull(),
    referenceType: varchar("reference_type", { length: 32 }).notNull(),
    referenceId: varchar("reference_id", { length: 300 }).notNull(),
    source: varchar("source", { length: 128 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 300 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    createdBy: varchar("created_by", { length: 128 }).notNull(),
    correlationId: varchar("correlation_id", { length: 160 }).notNull(),
  },
  table => [
    foreignKey({ name: "asset_dispatch_references_asset_tenant_fk", columns: [table.assetId, table.tenantId], foreignColumns: [assets.id, assets.tenantId] }).onDelete("restrict"),
    unique("asset_dispatch_references_idempotency_unique").on(table.tenantId, table.assetId, table.idempotencyKey),
    index("asset_dispatch_references_tenant_asset_idx").on(table.tenantId, table.assetId, table.createdAt),
  ],
);
