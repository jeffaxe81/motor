CREATE TABLE "asset_versions" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" varchar(128) NOT NULL,
  "asset_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "code" varchar(100) NOT NULL,
  "name" varchar(200) NOT NULL,
  "asset_type" varchar(100) NOT NULL,
  "status" varchar(64) NOT NULL,
  "technical_data" jsonb NOT NULL,
  "changed_at" timestamptz NOT NULL,
  "changed_by" varchar(128) NOT NULL,
  "reason" varchar(200) NOT NULL,
  "origin" varchar(128) NOT NULL,
  "correlation_id" varchar(160) NOT NULL,
  CONSTRAINT "asset_versions_tenant_asset_version_unique" UNIQUE("tenant_id", "asset_id", "version"),
  CONSTRAINT "asset_versions_asset_tenant_fk"
    FOREIGN KEY ("asset_id", "tenant_id")
    REFERENCES "assets"("id", "tenant_id")
    ON DELETE RESTRICT
);

CREATE INDEX "asset_versions_tenant_asset_version_idx"
  ON "asset_versions" ("tenant_id", "asset_id", "version");

CREATE TABLE "asset_event_outbox" (
  "id" serial PRIMARY KEY NOT NULL,
  "event_id" varchar(300) NOT NULL,
  "event_type" varchar(64) NOT NULL,
  "event_version" varchar(16) NOT NULL,
  "tenant_id" varchar(128) NOT NULL,
  "asset_id" uuid NOT NULL,
  "asset_version" integer NOT NULL,
  "correlation_id" varchar(160) NOT NULL,
  "occurred_at" timestamptz NOT NULL,
  "payload" jsonb NOT NULL,
  "published_at" timestamptz,
  CONSTRAINT "asset_event_outbox_event_id_unique" UNIQUE("event_id"),
  CONSTRAINT "asset_event_outbox_asset_event_unique" UNIQUE("tenant_id", "asset_id", "asset_version", "event_type"),
  CONSTRAINT "asset_event_outbox_asset_tenant_fk"
    FOREIGN KEY ("asset_id", "tenant_id")
    REFERENCES "assets"("id", "tenant_id")
    ON DELETE RESTRICT
);

CREATE INDEX "asset_event_outbox_pending_idx"
  ON "asset_event_outbox" ("published_at", "id");

CREATE INDEX "asset_event_outbox_tenant_asset_idx"
  ON "asset_event_outbox" ("tenant_id", "asset_id", "asset_version");
