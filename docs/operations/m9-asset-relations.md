# M9 — Relacionamentos entre Ativos

A M9 registra vínculos explícitos entre ativos pertencentes ao mesmo tenant. O Motor de Ativos mantém apenas a relação e seus metadados; não cria dependência SQL com produtos externos.

## Contrato

- `POST /api/v1/assets/:id/relations`
- `GET /api/v1/assets/:id/relations`

Entrada de criação: `relatedAssetId`, `relationType` e `source`.

## Regras

- ativo de origem e ativo relacionado devem existir no mesmo tenant;
- auto-vínculo é inválido;
- o tipo do relacionamento é explícito e auditável;
- a relação é histórica/aditiva;
- a criação publica `asset.relation.added` na timeline do ativo de origem;
- nenhuma consulta ou gravação cruza bancos de produtos.

## Persistência

A tabela `asset_relations` contém somente IDs internos, tenant, tipo, origem, autoria, instante e correlação. A migration versionada é `drizzle/0006_m9_asset_relations.sql`.

## Validação

Executar TypeScript, testes unitários, HTTP, PostgreSQL, build e Reprodutibilidade. Nenhuma migration real, grant ou deploy produtivo faz parte desta microentrega.

## Rollback

Reverter o commit/PR da M9 antes de aplicar a migration em qualquer ambiente persistente. Caso uma migration de teste tenha sido aplicada, remover `asset_relations` apenas no ambiente controlado correspondente.
