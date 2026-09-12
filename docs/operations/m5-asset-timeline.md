# M5 — Timeline e prontuário consolidado

## Objetivo

Disponibilizar uma visão cronológica canônica do ativo sem acesso direto às tabelas internas do Motor de Ativos.

## Contrato

A timeline é consultada por `GET /api/v1/assets/:id/timeline` e exige `assets:read`.

Cada item contém:
- `id` determinístico por ativo e versão;
- `tenantId` e `assetId`;
- `type` (`asset.created` ou `asset.updated` nesta microentrega);
- `occurredAt`;
- `authorUserId`;
- `source`;
- `reason`;
- `correlationId`;
- `version`;
- `data` com snapshot técnico correspondente.

## Origem dos dados

Na M5, a timeline é derivada do histórico imutável `asset_versions` criado na M2. Não há nova tabela nem migration para a timeline.

Isso mantém uma única fonte histórica para o cadastro técnico e evita duplicação de estado.

## Ordenação

A ordenação é cronológica crescente por `occurredAt`, usando `version` como desempate determinístico.

## Segurança e Multi-Tenant

Antes de montar a timeline, o serviço confirma a existência do ativo dentro do tenant do contexto autenticado. Um ativo de outro tenant é tratado como não encontrado.

## Evolução do prontuário

As próximas microentregas poderão adicionar novas origens canônicas à timeline, como evidências, inspeções, manutenção e relações com ordens, preservando o mesmo contrato agregado.

## Validação

A M5 possui testes para:
- criação e alteração;
- autoria/origem/motivo;
- ordenação determinística;
- histórico com volume maior;
- isolamento por tenant;
- exposição via HTTP.

## Rollback

Como a M5 não cria schema, o rollback consiste em reverter o código da API/serviço. O histórico de versões da M2 permanece intacto.

Nenhuma migration real, deploy ou grant produtivo é executado por esta microentrega.
