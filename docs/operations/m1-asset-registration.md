# Manual Operacional — M1 Cadastro Técnico de Ativos

## Escopo

A M1 disponibiliza o núcleo de cadastro técnico do Motor de Ativos / Inventário. O produto mantém banco próprio e não acessa o banco do Sistema de Despacho.

## API

Versão: `/api/v1`

- `POST /api/v1/assets` — cria um ativo;
- `GET /api/v1/assets/:id` — consulta um ativo do tenant autenticado;
- `PATCH /api/v1/assets/:id` — altera o cadastro usando concorrência otimista.

O contexto autenticado deve fornecer `tenantId`, `userId`, `correlationId` e permissões. O corpo da requisição não pode escolher ou alterar tenant/usuário.

Permissões mínimas:

- `assets:read` — consulta;
- `assets:write` — criação e alteração.

## Cadastro mínimo

- `code` — código operacional único dentro do tenant;
- `name` — nome do ativo;
- `assetType` — tipo lógico/técnico do ativo;
- `status` — estado atual do cadastro;
- `technicalData` — objeto JSON com atributos técnicos específicos.

A M1 não fixa ainda um catálogo universal de tipos/status. Catálogos específicos devem ser tratados em evolução controlada quando houver requisito funcional aprovado.

## Concorrência

Todo ativo inicia com `version = 1`. O PATCH exige `expectedVersion`.

Exemplo: se a versão atual é `2`, um comando com `expectedVersion = 1` falha com HTTP 409 / `asset.version_conflict`. A alteração vencedora permanece preservada.

## Isolamento por tenant

Todas as consultas e escritas do repositório PostgreSQL usam `tenantId`. Um ativo de outro tenant é tratado como inexistente (`asset.not_found`) para evitar vazamento de existência.

O banco reforça:

- unicidade de `(tenant_id, code)`;
- vínculo composto `(asset_id, tenant_id)` entre auditoria e ativo.

## Auditoria

Criações e alterações registram:

- tenant;
- ativo;
- ação (`created`/`updated`);
- usuário ator;
- versão resultante;
- `correlationId`;
- data/hora.

O estado do ativo e sua auditoria são gravados na mesma transação PostgreSQL.

## Erros

A API retorna envelope versionado:

```json
{
  "envelopeVersion": "1",
  "correlationId": "...",
  "error": {
    "code": "asset.version_conflict",
    "message": "Asset version is stale",
    "retryable": false
  }
}
```

Erros internos não expõem stack trace ou SQL ao consumidor.

## Banco de dados

Migration versionada: `drizzle/0000_m1_assets.sql`.

Nesta microentrega, a migration é executada automaticamente apenas no PostgreSQL efêmero dos testes de CI. Não existe autorização para aplicação automática em banco real, homologação ou produção.

Antes de qualquer ambiente persistente, devem ser definidos explicitamente:

1. banco/cluster de destino do Motor de Ativos;
2. credencial dedicada com privilégio mínimo;
3. backup/checkpoint;
4. janela de mudança;
5. execução controlada da migration;
6. smoke test;
7. plano de rollback.

## Rollback da M1

Enquanto não houver migration aplicada em ambiente persistente, rollback consiste em reverter o código/PR.

Após futura aplicação autorizada em banco persistente, o rollback deverá ser definido especificamente para aquele ambiente. Não apagar tabelas/dados automaticamente.

## Segurança

- autenticação real deve ser fornecida por um `AssetContextResolver` seguro no bootstrap do serviço;
- nunca confiar em headers de tenant/usuário vindos diretamente da Internet;
- os headers usados nos testes são apenas um adaptador de teste com `Fastify.inject`;
- segredos não entram no repositório;
- `DATABASE_URL` deve ser entregue por secret/env seguro;
- não compartilhar credenciais com o Sistema de Despacho.

## Verificação local

Com dependências instaladas e PostgreSQL de teste disponível:

```bash
pnpm check
pnpm test
pnpm build
```

A suíte PostgreSQL é executada quando `DATABASE_URL` está configurada. A CI oficial provisiona PostgreSQL 16 efêmero para esses testes.