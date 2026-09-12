CREATE TABLE IF NOT EXISTS asset_evidence (
  id uuid PRIMARY KEY,
  tenant_id varchar(128) NOT NULL,
  asset_id uuid NOT NULL,
  kind varchar(32) NOT NULL,
  file_name varchar(255) NOT NULL,
  media_type varchar(128) NOT NULL,
  size_bytes integer NOT NULL,
  storage_key varchar(500) NOT NULL,
  sha256 varchar(64) NOT NULL,
  source varchar(128) NOT NULL,
  signature_reference varchar(300),
  created_at timestamptz NOT NULL,
  created_by varchar(128) NOT NULL,
  correlation_id varchar(160) NOT NULL,
  valid boolean NOT NULL,
  CONSTRAINT asset_evidence_asset_tenant_fk
    FOREIGN KEY (asset_id, tenant_id)
    REFERENCES assets(id, tenant_id)
    ON DELETE RESTRICT,
  CONSTRAINT asset_evidence_tenant_storage_unique UNIQUE (tenant_id, storage_key)
);

CREATE INDEX IF NOT EXISTS asset_evidence_tenant_asset_created_idx
  ON asset_evidence (tenant_id, asset_id, created_at);
