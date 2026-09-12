# M3 — Geolocalização e mapa

## Objetivo

A M3 associa uma posição geográfica ao ativo e disponibiliza consulta por área para consumo do mapa do Inventário e de integrações autorizadas. O Motor de Ativos continua sendo o proprietário dos dados de localização; o Sistema de Despacho apenas poderá consumi-los por contrato REST nas etapas de integração previstas.

## Modelo de dados

A tabela `asset_locations` mantém a posição geográfica atual do ativo:

- `tenant_id`;
- `asset_id`;
- `latitude`;
- `longitude`;
- `source`;
- `updated_at`;
- `updated_by`;
- `correlation_id`.

Existe no máximo uma posição corrente por `tenant_id + asset_id`. Atualizações usam upsert e não alteram o cadastro técnico/versionamento M2.

## Validação geográfica

- latitude: -90 a 90;
- longitude: -180 a 180;
- bounds exigem mínimo menor ou igual ao máximo;
- origem (`source`) é obrigatória;
- coordenadas inválidas retornam `validation.invalid`.

A migration PostgreSQL repete os limites por CHECK constraints para defesa em profundidade.

## API REST

### Atualizar posição

`PUT /api/v1/assets/:id/location`

Requer `assets:write`.

Exemplo de payload:

```json
{
  "latitude": -27.5945,
  "longitude": -48.5477,
  "source": "field-app"
}
```

### Consultar posição individual

`GET /api/v1/assets/:id/location`

Requer `assets:read` e respeita o tenant autenticado.

### Consultar ativos para mapa

`GET /api/v1/assets/map?minLatitude=-27.7&maxLatitude=-27.4&minLongitude=-48.7&maxLongitude=-48.4`

Requer `assets:read`. Retorna apenas localizações do tenant autenticado dentro do bounding box informado.

## Segurança e isolamento

- tenant e usuário são obtidos do contexto autenticado, nunca do payload;
- gravação de localização valida previamente a existência do ativo no tenant;
- consultas geográficas sempre filtram por `tenant_id`;
- um ativo de outro tenant não pode receber nem expor localização;
- não há SQL cruzado com o Sistema de Despacho;
- correlação, usuário e origem da posição permanecem registrados.

## Persistência e migration

A migration M3 é `drizzle/0002_m3_asset_locations.sql`.

Nesta entrega ela é executada somente no PostgreSQL efêmero do CI/testes. Nenhuma migration é aplicada automaticamente em homologação ou produção.

## Mapa

A M3 fornece o feed geográfico necessário para a camada de mapa. O Motor de Ativos não armazena disponibilidade de equipes, ocorrências, rotas operacionais ou estado de despacho. Esses dados continuam pertencendo ao Sistema de Despacho.

A implementação visual completa do Inventário poderá consumir o endpoint de bounds sem criar dependência SQL entre produtos.

## Validação

A suíte cobre:

- associação de posição válida;
- rejeição de latitude e longitude inválidas;
- consulta por bounding box;
- isolamento entre tenants;
- API REST para posição/mapa;
- persistência PostgreSQL;
- regressões M1 e M2 com coexistência do schema M3.

## Rollback

Antes de implantação persistente, registrar backup e janela operacional. `asset_locations` possui FK restritiva para `assets`.

Nesta fase, como nenhuma migration foi executada fora do CI, o rollback consiste em reverter os commits da M3. Não remover dados geográficos em ambiente persistente sem autorização e procedimento de preservação aprovado.
