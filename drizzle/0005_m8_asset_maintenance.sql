CREATE TABLE IF NOT EXISTS asset_maintenance (
  id uuid PRIMARY KEY,
  tenant_id varchar(128) NOT NULL,
  asset_id uuid NOT NULL,
  kind varchar(100) NOT NULL,
  description varchar(500) NOT NULL,
  parts jsonb NOT NULL,
  costs jsonb NOT NULL,
  total_cost double precision NOT NULL CHECK (total_cost >= 0),
  warranty jsonb,
  links jsonb,
  source varchar(128) NOT NULL,
  created_at timestamptz NOT NULL,
  created_by varchar(128) NOT NULL,
  correlation_id varchar(160) NOT NULL,
  CONSTRAINT asset_maintenance_asset_tenant_fk
    FOREIGN KEY (asset_id, tenant_id) REFERENCES assets(id, tenant_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS asset_maintenance_tenant_asset_created_idx
  ON asset_maintenance(tenant_id, asset_id, created_at);
