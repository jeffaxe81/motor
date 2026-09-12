CREATE TABLE "asset_locations" (
  "tenant_id" varchar(128) NOT NULL,
  "asset_id" uuid NOT NULL,
  "latitude" double precision NOT NULL,
  "longitude" double precision NOT NULL,
  "source" varchar(128) NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "updated_by" varchar(128) NOT NULL,
  "correlation_id" varchar(160) NOT NULL,
  CONSTRAINT "asset_locations_tenant_asset_unique" UNIQUE("tenant_id", "asset_id"),
  CONSTRAINT "asset_locations_latitude_check" CHECK ("latitude" >= -90 AND "latitude" <= 90),
  CONSTRAINT "asset_locations_longitude_check" CHECK ("longitude" >= -180 AND "longitude" <= 180),
  CONSTRAINT "asset_locations_asset_tenant_fk"
    FOREIGN KEY ("asset_id", "tenant_id")
    REFERENCES "assets"("id", "tenant_id")
    ON DELETE RESTRICT
);

CREATE INDEX "asset_locations_tenant_geo_idx"
  ON "asset_locations" ("tenant_id", "latitude", "longitude");
