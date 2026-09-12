CREATE TABLE IF NOT EXISTS asset_inspections (
  id uuid PRIMARY KEY,
  tenant_id varchar(128) NOT NULL,
  asset_id uuid NOT NULL,
  checklist_reference varchar(300) NOT NULL,
  responses jsonb NOT NULL,
  result varchar(100) NOT NULL,
  status varchar(32) NOT NULL CHECK (status = 'finalized'),
  source varchar(128) NOT NULL,
  latitude double precision,
  longitude double precision,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL,
  created_by varchar(128) NOT NULL,
  correlation_id varchar(160) NOT NULL,
  CONSTRAINT asset_inspections_asset_tenant_fk
    FOREIGN KEY (asset_id, tenant_id) REFERENCES assets(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT asset_inspections_location_pair CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
  )
);

CREATE INDEX IF NOT EXISTS asset_inspections_tenant_asset_created_idx
  ON asset_inspections (tenant_id, asset_id, created_at);
