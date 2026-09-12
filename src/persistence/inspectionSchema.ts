import { doublePrecision, foreignKey, index, jsonb, pgTable, timestamp, varchar, uuid } from "drizzle-orm/pg-core";
import { assets } from "./schema.js";

export const assetInspections = pgTable(
  "asset_inspections",
  {
    id: uuid("id").primaryKey(),
    tenantId: varchar("tenant_id", { length: 128 }).notNull(),
    assetId: uuid("asset_id").notNull(),
    checklistReference: varchar("checklist_reference", { length: 300 }).notNull(),
    responses: jsonb("responses").$type<Record<string, unknown>>().notNull(),
    result: varchar("result", { length: 100 }).notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    source: varchar("source", { length: 128 }).notNull(),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    evidenceIds: jsonb("evidence_ids").$type<string[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    createdBy: varchar("created_by", { length: 128 }).notNull(),
    correlationId: varchar("correlation_id", { length: 160 }).notNull(),
  },
  table => [
    foreignKey({
      name: "asset_inspections_asset_tenant_fk",
      columns: [table.assetId, table.tenantId],
      foreignColumns: [assets.id, assets.tenantId],
    }).onDelete("restrict"),
    index("asset_inspections_tenant_asset_created_idx").on(table.tenantId, table.assetId, table.createdAt),
  ],
);
