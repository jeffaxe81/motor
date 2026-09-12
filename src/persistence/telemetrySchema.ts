import { boolean, foreignKey, index, jsonb, pgTable, timestamp, unique, varchar, uuid } from "drizzle-orm/pg-core";
import { assets } from "./schema.js";

export const assetTelemetry = pgTable(
  "asset_telemetry",
  {
    id: uuid("id").primaryKey(),
    tenantId: varchar("tenant_id", { length: 128 }).notNull(),
    assetId: uuid("asset_id").notNull(),
    eventId: varchar("event_id", { length: 300 }).notNull(),
    eventVersion: varchar("event_version", { length: 32 }).notNull(),
    eventType: varchar("event_type", { length: 160 }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
    source: varchar("source", { length: 128 }).notNull(),
    relevant: boolean("relevant").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true, mode: "date" }).notNull(),
    receivedBy: varchar("received_by", { length: 128 }).notNull(),
    correlationId: varchar("correlation_id", { length: 160 }).notNull(),
  },
  table => [
    foreignKey({ name: "asset_telemetry_asset_tenant_fk", columns: [table.assetId, table.tenantId], foreignColumns: [assets.id, assets.tenantId] }).onDelete("restrict"),
    unique("asset_telemetry_event_unique").on(table.tenantId, table.assetId, table.eventId),
    index("asset_telemetry_tenant_asset_occurred_idx").on(table.tenantId, table.assetId, table.occurredAt),
  ],
);
