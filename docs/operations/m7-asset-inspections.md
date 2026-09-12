# M7 — Inspeções e Checklists

## Objetivo
Registrar inspeções finalizadas e auditáveis sobre um ativo, preservando histórico, tenant, autoria e vínculo opcional com evidências.

## Modelo
Cada inspeção registra: referência do checklist, respostas, resultado, status finalizado, origem, autor, data/hora, correlação, localização opcional e IDs de evidências do mesmo ativo/tenant.

As respostas são copiadas no momento da gravação e não são atualizadas posteriormente. Correções devem gerar nova inspeção, preservando o histórico anterior.

## API
- `POST /api/v1/assets/:id/inspections`: registra inspeção finalizada.
- `GET /api/v1/assets/:id/inspections`: lista inspeções do ativo em ordem cronológica.
- `GET /api/v1/assets/:id/timeline`: inclui itens `asset.inspection.finalized`.

## Segurança e multi-tenant
Todas as operações usam o tenant do contexto autenticado. Um ativo de outro tenant é tratado como não encontrado. Evidências só podem ser vinculadas quando pertencem ao mesmo ativo e tenant.

## Persistência
A migration `drizzle/0004_m7_asset_inspections.sql` cria `asset_inspections`. Respostas e IDs de evidências são armazenados como JSONB; binários continuam fora do banco.

## Operação
A migration é somente versionada e validada em ambiente efêmero de CI nesta microentrega. Nenhuma migration em produção/homologação, deploy ou grant é executado automaticamente.

## Rollback
Antes de produção, rollback exige janela e backup. Em ambiente efêmero, remover `asset_inspections` reverte apenas os dados da M7.
