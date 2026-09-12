CREATE TABLE "asset_dispatch_references" (
  "id" uuid PRIMARY KEY NOT NULL,
  "tenant_id" varchar(128) NOT NULL,
  "asset_id" uuid NOT NULL,
  "reference_type" varchar(32) NOT NULL,
  "reference_id" varchar(300) NOT NULL,
  "source" varchar(128) NOT NULL,
  "idempotency_key" varchar(300) NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "created_by" varchar(128) NOT NULL,
  "correlation_id" varchar(160) NOT NULL,
  CONSTRAINT "asset_dispatch_references_type_check" CHECK ("reference_type" IN ('occurrence','order','activity')),
  CONSTRAINT "asset_dispatch_references_idempotency_unique" UNIQUE("tenant_id","asset_id","idempotency_key"),
  CONSTRAINT "asset_dispatch_references_asset_tenant_fk" FOREIGN KEY ("asset_id","tenant_id") REFERENCES "assets"("id","tenant_id") ON DELETE restrict
);
CREATE INDEX "asset_dispatch_references_tenant_asset_idx" ON "asset_dispatch_references" ("tenant_id","asset_id","created_at");
