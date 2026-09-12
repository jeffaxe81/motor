# M10 — Referências do Despacho no prontuário do ativo

## Objetivo
Relacionar ocorrências, ordens e atividades do Sistema de Despacho ao prontuário do ativo sem compartilhar banco de dados entre produtos.

## Ownership e integração
O Despacho continua proprietário da ocorrência, ordem ou atividade. O Motor de Ativos armazena somente uma referência externa estável: `referenceType`, `referenceId`, `source` e `idempotencyKey`, acompanhada de metadados de auditoria. Não existe consulta SQL cruzada entre Motor e Despacho.

## Endpoints
- `POST /api/v1/assets/:id/dispatch-references`: registra uma referência externa.
- `GET /api/v1/assets/:id/dispatch-references`: lista referências do ativo no tenant autorizado.

Tipos aceitos: `occurrence`, `order` e `activity`.

## Idempotência
A chave é única por `tenantId + assetId + idempotencyKey`. Repetir exatamente o mesmo comando retorna o registro já existente e não duplica a timeline. Reutilizar a mesma chave com payload semanticamente diferente é rejeitado como `validation.invalid`.

## Segurança e multi-tenant
Todas as operações exigem contexto autenticado, permissão de leitura/escrita e existência do ativo dentro do mesmo tenant. Referências de outro tenant não são expostas.

## Timeline
Cada vínculo novo aparece como `asset.dispatch.reference.linked`. O evento é derivado do registro persistido no Motor e não copia o estado operacional do Despacho.

## Persistência
A migration versionada é `drizzle/0007_m10_asset_dispatch_references.sql`. Ela cria apenas a estrutura do Motor. Esta microentrega não executa migration, grant ou deploy em ambiente real/produtivo.

## Validação e rollback
Validar TypeScript, testes unitários/HTTP/PostgreSQL e build. Em rollback de ambiente não produtivo, remover `asset_dispatch_references` após confirmar que nenhuma integração depende dos registros. Em produção, usar procedimento formal de migration reversa e retenção/auditoria aplicável.
