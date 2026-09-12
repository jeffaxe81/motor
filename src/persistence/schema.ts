import {
  boolean,
  doublePrecision,
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
    }).onDelete("restrict"),
    index("asset_audit_tenant_asset_idx").on(table.tenantId, table.assetId, table.occurredAt),
  ],
);

export const assetVersions = pgTable(
  "asset_versions",
  {
    id: serial("id").primaryKey(),
    tenantId: varchar("tenant_id", { length: 128 }).notNull(),
    assetId: uuid("asset_id").notNull(),
    version: integer("version").notNull(),
    code: varchar("code", { length: 100 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    assetType: varchar("asset_type", { length: 100 }).notNull(),
    status: varchar("status", { length: 64 }).notNull(),
    technicalData: jsonb("technical_data").$type<Record<string, unknown>>().notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true, mode: "date" }).notNull(),
    changedBy: varchar("changed_by", { length: 128 }).notNull(),
    reason: varchar("reason", { length: 200 }).notNull(),
    origin: varchar("origin", { length: 128 }).notNull(),
    correlationId: varchar("correlation_id", { length: 160 }).notNull(),
  },
  table => [
    unique("asset_versions_tenant_asset_version_unique").on(table.tenantId, table.assetId, table.version),
    foreignKey({
      name: "asset_versions_asset_tenant_fk",
      columns: [table.assetId, table.tenantId],
      foreignColumns: [assets.id, assets.tenantId],
    }).onDelete("restrict"),
    index("asset_versions_tenant_asset_version_idx").on(table.tenantId, table.assetId, table.version),
  ],
);

export const assetEventOutbox = pgTable(
  "asset_event_outbox",
  {
    id: serial("id").primaryKey(),
    eventId: varchar("event_id", { length: 300 }).notNull(),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    eventVersion: varchar("event_version", { length: 16 }).notNull(),
    tenantId: varchar("tenant_id", { length: 128 }).notNull(),
    assetId: uuid("asset_id").notNull(),
    assetVersion: integer("asset_version").notNull(),
    correlationId: varchar("correlation_id", { length: 160 }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
  },
  table => [
    unique("asset_event_outbox_event_id_unique").on(table.eventId),
    unique("asset_event_outbox_asset_event_unique").on(table.tenantId, table.assetId, table.assetVersion, table.eventType),
    foreignKey({
      name: "asset_event_outbox_asset_tenant_fk",
      columns: [table.assetId, table.tenantId],
      foreignColumns: [assets.id, assets.tenantId],
    }).onDelete("restrict"),
    index("asset_event_outbox_pending_idx").on(table.publishedAt, table.id),
    index("asset_event_outbox_tenant_asset_idx").on(table.tenantId, table.assetId, table.assetVersion),
  ],
);

export const assetLocations = pgTable(
  "asset_locations",
  {
    tenantId: varchar("tenant_id", { length: 128 }).notNull(),
    assetId: uuid("asset_id").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    source: varchar("source", { length: 128 }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedBy: varchar("updated_by", { length: 128 }).notNull(),
    correlationId: varchar("correlation_id", { length: 160 }).notNull(),
  },
  table => [
    unique("asset_locations_tenant_asset_unique").on(table.tenantId, table.assetId),
    foreignKey({
      name: "asset_locations_asset_tenant_fk",
      columns: [table.assetId, table.tenantId],
      foreignColumns: [assets.id, assets.tenantId],
    }).onDelete("restrict"),
    index("asset_locations_tenant_geo_idx").on(table.tenantId, table.latitude, table.longitude),
  ],
);

export const assetEvidence = pgTable(
  "asset_evidence",
  {
    id: uuid("id").primaryKey(),
    tenantId: varchar("tenant_id", { length: 128 }).notNull(),
    assetId: uuid("asset_id").notNull(),
    kind: varchar("kind", { length: 32 }).notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    mediaType: varchar("media_type", { length: 128 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: varchar("storage_key", { length: 500 }).notNull(),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    source: varchar("source", { length: 128 }).notNull(),
    signatureReference: varchar("signature_reference", { length: 300 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    createdBy: varchar("created_by", { length: 128 }).notNull(),
    correlationId: varchar("correlation_id", { length: 160 }).notNull(),
    valid: boolean("valid").notNull(),
  },
  table => [
    foreignKey({
      name: "asset_evidence_asset_tenant_fk",
      columns: [table.assetId, table.tenantId],
      foreignColumns: [assets.id, assets.tenantId],
    }).onDelete("restrict"),
    index("asset_evidence_tenant_asset_created_idx").on(table.tenantId, table.assetId, table.createdAt),
    unique("asset_evidence_tenant_storage_unique").on(table.tenantId, table.storageKey),
  ],
);
