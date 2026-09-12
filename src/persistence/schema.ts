import {
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  timestamp,
  unique,
  varchar,
  uuid,
} from "drizzle-orm/pg-core";

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey(),
    tenantId: varchar("tenant_id", { length: 128 }).notNull(),
    code: varchar("code", { length: 100 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    assetType: varchar("asset_type", { length: 100 }).notNull(),
    status: varchar("status", { length: 64 }).notNull(),
    technicalData: jsonb("technical_data").$type<Record<string, unknown>>().notNull(),
    version: integer("version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    createdBy: varchar("created_by", { length: 128 }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedBy: varchar("updated_by", { length: 128 }).notNull(),
  },
  table => [
    unique("assets_tenant_code_unique").on(table.tenantId, table.code),
    unique("assets_id_tenant_unique").on(table.id, table.tenantId),
    index("assets_tenant_id_idx").on(table.tenantId, table.id),
  ],
);

export const assetAuditLog = pgTable(
  "asset_audit_log",
  {
    id: serial("id").primaryKey(),
    tenantId: varchar("tenant_id", { length: 128 }).notNull(),
    assetId: uuid("asset_id").notNull(),
    action: varchar("action", { length: 16 }).notNull(),
    actorUserId: varchar("actor_user_id", { length: 128 }).notNull(),
    version: integer("version").notNull(),
    correlationId: varchar("correlation_id", { length: 160 }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  table => [
    foreignKey({
      name: "asset_audit_asset_tenant_fk",
      columns: [table.assetId, table.tenantId],
      foreignColumns: [assets.id, assets.tenantId],
    }).onDelete("cascade"),
    index("asset_audit_tenant_asset_idx").on(table.tenantId, table.assetId, table.occurredAt),
  ],
);
