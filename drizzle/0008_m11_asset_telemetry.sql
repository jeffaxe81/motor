CREATE TABLE "asset_telemetry" (
  "id" uuid PRIMARY KEY NOT NULL,
  "tenant_id" varchar(128) NOT NULL,
  "asset_id" uuid NOT NULL,
  "event_id" varchar(300) NOT NULL,
  "event_version" varchar(32) NOT NULL,
  "event_type" varchar(160) NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL,
  "source" varchar(128) NOT NULL,
  "relevant" boolean NOT NULL,
  "payload" jsonb NOT NULL,
  "received_at" timestamp with time zone NOT NULL,
  "received_by" varchar(128) NOT NULL,
  "correlation_id" varchar(160) NOT NULL,
  CONSTRAINT "asset_telemetry_event_unique" UNIQUE("tenant_id","asset_id","event_id"),
  CONSTRAINT "asset_telemetry_asset_tenant_fk" FOREIGN KEY ("asset_id","tenant_id") REFERENCES "assets"("id","tenant_id") ON DELETE restrict
);
CREATE INDEX "asset_telemetry_tenant_asset_occurred_idx" ON "asset_telemetry" ("tenant_id","asset_id","occurred_at");
