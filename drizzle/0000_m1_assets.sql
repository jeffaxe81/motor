CREATE TABLE "assets" (
  "id" uuid PRIMARY KEY NOT NULL,
  "tenant_id" varchar(128) NOT NULL,
  "code" varchar(100) NOT NULL,
  "name" varchar(200) NOT NULL,
  "asset_type" varchar(100) NOT NULL,
  "status" varchar(64) NOT NULL,
  "technical_data" jsonb NOT NULL,
  "version" integer NOT NULL,
  "created_at" timestamptz NOT NULL,
  "created_by" varchar(128) NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "updated_by" varchar(128) NOT NULL,
  CONSTRAINT "assets_tenant_code_unique" UNIQUE("tenant_id", "code"),
  CONSTRAINT "assets_id_tenant_unique" UNIQUE("id", "tenant_id")
);

CREATE INDEX "assets_tenant_id_idx" ON "assets" ("tenant_id", "id");

CREATE TABLE "asset_audit_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" varchar(128) NOT NULL,
  "asset_id" uuid NOT NULL,
  "action" varchar(16) NOT NULL,
  "actor_user_id" varchar(128) NOT NULL,
  "version" integer NOT NULL,
  "correlation_id" varchar(160) NOT NULL,
  "occurred_at" timestamptz NOT NULL,
  CONSTRAINT "asset_audit_asset_tenant_fk"
    FOREIGN KEY ("asset_id", "tenant_id")
    REFERENCES "assets"("id", "tenant_id")
    ON DELETE CASCADE
);

CREATE INDEX "asset_audit_tenant_asset_idx"
  ON "asset_audit_log" ("tenant_id", "asset_id", "occurred_at");
