# M2 — Versionamento e histórico do cadastro

## Objetivo

A M2 torna a evolução do cadastro técnico de um ativo reconstruível sem depender de logs externos. O estado corrente permanece em `assets`; cada criação ou alteração válida gera um snapshot histórico imutável em `asset_versions` e um evento versionado em `asset_event_outbox`.

## Fronteira do produto

O Motor de Ativos continua sendo o proprietário do cadastro e do histórico dos ativos. O Sistema de Despacho não acessa estas tabelas diretamente. Integrações futuras devem consumir contratos REST e eventos versionados.

Não há SQL cruzado, credencial compartilhada de banco ou gravação direta entre produtos.

## Modelo de persistência

### `assets`

Mantém somente o estado corrente do ativo e sua versão atual.

### `asset_audit_log`

Mantém a trilha de auditoria já existente da M1: ação, usuário, versão, correlação e instante.

### `asset_versions`

Mantém um snapshot imutável por versão do ativo. Cada registro contém:

- `tenant_id` e `asset_id`;
- número da versão;
- código, nome, tipo, estado e dados técnicos;
- autor e instante da alteração;
- motivo (`reason`) e origem (`origin`);
- `correlation_id`.

A combinação `tenant_id + asset_id + version` é única. O vínculo com `assets` usa FK com `ON DELETE RESTRICT`.

### `asset_event_outbox`

Registra eventos de domínio na mesma transação da alteração do ativo. Nesta microentrega não existe publicação para broker.

Eventos produzidos:

- `asset.created`, versão de contrato `1`;
- `asset.updated`, versão de contrato `1`.

O evento possui identificador determinístico, tenant, ativo, versão do ativo, correlação, instante e payload do snapshot alterado. `published_at` permanece disponível para uma futura etapa de publicação/consumo.

## Atomicidade

Criação:

1. grava o estado em `assets`;
2. grava auditoria;
3. grava snapshot v1;
4. grava `asset.created` na outbox.

Alteração bem-sucedida:

1. atualiza o estado corrente com `expectedVersion`;
2. grava auditoria;
3. grava o novo snapshot;
4. grava `asset.updated` na outbox.

As quatro operações ocorrem na mesma transação PostgreSQL. Em caso de conflito de versão ou erro, a transação não deve produzir snapshot/evento parcial.

## Metadados de mudança

O PATCH continua aceitando os campos técnicos da M1 e passa a aceitar opcionalmente:

```json
{
  "change": {
    "reason": "preventive-inspection",
    "origin": "maintenance-api"
  }
}
```

`change` sozinho não caracteriza alteração de ativo: ao menos um campo técnico precisa ser modificado.

Valores padrão quando `change` não é informado:

- criação: `reason=initial-registration`, `origin=api`;
- alteração: `reason=technical-update`, `origin=api`.

## API REST

### Histórico

`GET /api/v1/assets/:id/history`

Requer `assets:read`. Retorna snapshots em ordem crescente de versão. A consulta é sempre filtrada por tenant. Um ativo de outro tenant é tratado como não encontrado.

### Comparação

`GET /api/v1/assets/:id/compare?fromVersion=1&toVersion=2`

Requer `assets:read`. Compara os campos `code`, `name`, `assetType`, `status` e `technicalData`, retornando somente diferenças.

Versões inexistentes resultam em `asset.not_found`. Números de versão inválidos resultam em `validation.invalid`.

## Segurança e isolamento

- Tenant e usuário continuam originados do contexto autenticado resolvido pela aplicação, nunca do corpo da requisição.
- Histórico e comparação exigem permissão de leitura.
- Toda consulta PostgreSQL do histórico inclui `tenant_id` e `asset_id`.
- Os erros públicos seguem o envelope correlacionado e não expõem SQL, stack ou segredos.
- A outbox não contém credenciais nem dados de outro produto.

## Migração

A migration M2 é `drizzle/0001_m2_asset_history.sql`.

Durante esta entrega ela é aplicada somente ao PostgreSQL efêmero dos testes/CI. Nenhuma migration foi aplicada automaticamente em homologação ou produção.

Para uma implantação futura, a execução da migration deverá passar por autorização explícita, backup/rollback e janela operacional apropriada.

## Validação

A suíte cobre:

- imutabilidade da v1 após criação da v2;
- comparação de versões;
- isolamento entre tenants;
- motivo/origem/autoria/correlação;
- persistência PostgreSQL de snapshots;
- criação de eventos versionados na outbox;
- rotas HTTP de histórico e comparação;
- regressão completa da M1.

## Rollback

Antes de qualquer implantação persistente, o rollback deve considerar que `asset_versions` e `asset_event_outbox` possuem FKs restritivas para `assets`.

Nesta fase, como não há migration real aplicada fora da CI, o rollback da entrega consiste em reverter os commits da M2. Não remover tabelas ou registros em ambiente persistente sem procedimento aprovado de preservação histórica.
