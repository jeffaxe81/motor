# M12 — Indicadores do Inventário

## Objetivo

Expor indicadores derivados exclusivamente dos registros já persistidos no prontuário do Motor de Ativos, sempre no escopo do tenant autorizado.

## Endpoint

`GET /api/v1/inventory/indicators`

Requer permissão `assets:read`.

## Indicadores

- `totalAssets`: quantidade de ativos do tenant;
- `assetsByStatus`: distribuição dos ativos pelo status registrado no cadastro técnico;
- `maintenanceRecords`: quantidade de registros históricos de manutenção;
- `maintenanceTotalCost`: soma dos `totalCost` dos registros de manutenção;
- `finalizedInspections`: quantidade de inspeções finalizadas.

## Regras

- Nenhum indicador consulta dados de outro tenant.
- Nenhuma métrica é estimada ou inventada fora dos dados já registrados.
- O custo agregado é derivado dos mesmos `totalCost` já gravados em cada manutenção.
- A implementação não cria tabela ou projeção materializada nesta microentrega; os indicadores são derivados das fontes já aprovadas do prontuário.

## Validação

A suíte M12 cobre cálculo, isolamento por tenant e exposição HTTP.

## Operação e rollback

Não há migration real ou grant adicional. Rollback consiste em remover o endpoint e o método de agregação da M12. A remoção não altera os registros históricos de ativos, inspeções ou manutenções.
