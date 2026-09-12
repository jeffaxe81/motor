# M8 — Peças, custos e garantias

## Objetivo
Registrar histórico de manutenção do ativo com peças/componentes, custos, garantias e referências operacionais sem transformar o Motor de Ativos em ERP financeiro.

## Contrato
- `POST /api/v1/assets/:id/maintenance` registra um evento histórico imutável de manutenção.
- `GET /api/v1/assets/:id/maintenance` lista os registros históricos do ativo.
- O tenant vem exclusivamente do contexto autenticado.
- O ativo deve pertencer ao tenant autenticado.

## Dados
Cada registro armazena tipo, descrição, peças, custos adicionais, custo total calculado, garantia opcional, vínculos opcionais com inspeção/ordem/evento, origem, autor, correlação e data/hora.

O total é calculado como soma de `quantity * unitCost` das peças mais os custos adicionais. Valores negativos são rejeitados. A moeda é mantida nos itens de custo; a M8 não implementa contas a pagar, faturamento, conciliação ou contabilidade.

## Timeline
Cada registro aparece como `asset.maintenance.recorded` no prontuário canônico do ativo.

## Persistência
A migration versionada é `drizzle/0005_m8_asset_maintenance.sql`. Ela não é aplicada automaticamente em produção por esta microentrega.

## Segurança e isolamento
Consultas e comandos exigem as permissões já existentes `assets:read` e `assets:write`. Nenhum registro é consultável através de outro tenant.

## Rollback
Antes de qualquer aplicação real, validar backup e janela de mudança. Em rollback de ambiente ainda não produtivo, remover `asset_maintenance` após garantir que nenhum dado válido precise ser preservado.
