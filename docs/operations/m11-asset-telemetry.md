# M11 — Telemetria e eventos do ativo

## Objetivo
Registrar telemetria correlacionada ao ativo com contrato versionado, isolamento por tenant e idempotência, sem transformar o prontuário em depósito indiscriminado de eventos.

## Contrato
`POST /api/v1/assets/:id/telemetry`

Campos:
- `eventId`: identificador estável/idempotente do evento;
- `eventVersion`: versão do contrato recebido;
- `eventType`: tipo semântico do evento;
- `occurredAt`: instante original do evento;
- `source`: sistema/origem;
- `relevant`: indica se deve compor o histórico/timeline;
- `payload`: dados versionados do evento.

Consulta: `GET /api/v1/assets/:id/telemetry`.

## Regras
- A chave de idempotência é `tenant + asset + eventId`.
- Reenvio do mesmo evento com o mesmo conteúdo retorna o registro existente.
- Reutilização do mesmo `eventId` com conteúdo semanticamente diferente é rejeitada como `validation.invalid`.
- O Motor registra todas as telemetrias aceitas na tabela própria `asset_telemetry`.
- Apenas registros `relevant=true` são projetados na timeline como `asset.telemetry.recorded`.
- Não há acesso ao banco do Despacho nem cópia de seu estado operacional.
- `tenantId`, autorização e correlação continuam obrigatórios pelas regras gerais do Motor.

## Persistência
Migration versionada: `drizzle/0008_m11_asset_telemetry.sql`.

A migration é somente artefato de código desta microentrega; nenhum banco produtivo é alterado automaticamente.

## Diagnóstico
Para investigar duplicidade ou falha, correlacionar por `eventId`, `assetId`, `tenantId` e `correlationId`. O payload inválido deve ser rejeitado antes da persistência.

## Rollback
Reverter o código da M11 e, em ambiente controlado, remover a tabela `asset_telemetry` somente após validar retenção/auditoria dos dados. Não executar rollback destrutivo automaticamente em produção.
