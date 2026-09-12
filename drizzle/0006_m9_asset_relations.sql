CREATE TABLE IF NOT EXISTS asset_relations (
  id uuid PRIMARY KEY,
  tenant_id varchar(128) NOT NULL,
  asset_id uuid NOT NULL,
  related_asset_id uuid NOT NULL,
  relation_type varchar(100) NOT NULL,
  source varchar(128) NOT NULL,
  created_at timestamptz NOT NULL,
  created_by varchar(128) NOT NULL,
  correlation_id varchar(160) NOT NULL,
  CONSTRAINT asset_relations_asset_tenant_fk FOREIGN KEY (asset_id, tenant_id) REFERENCES assets(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT asset_relations_related_tenant_fk FOREIGN KEY (related_asset_id, tenant_id) REFERENCES assets(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT asset_relations_unique UNIQUE (tenant_id, asset_id, related_asset_id, relation_type),
  CONSTRAINT asset_relations_no_self CHECK (asset_id <> related_asset_id)
);
CREATE INDEX IF NOT EXISTS asset_relations_tenant_asset_idx ON asset_relations(tenant_id, asset_id, created_at);
