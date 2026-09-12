# M1 — Identidade e cadastro técnico do ativo

**Data:** 2026-09-12  
**Épico de origem:** `jeffaxe81/dispatch#66`  
**Branch:** `feat/m1-asset-registration-20260912`  
**Checkpoint:** `checkpoint/pre-m1-asset-registration-20260912`  
**Base inicial:** `8c6806e63aaf2685d28b4784d5844d62d549ca39`

## Objetivo

Criar o núcleo mínimo do Motor de Ativos para registrar, alterar e consultar um ativo dentro do tenant correto, com autorização, auditoria e concorrência otimista.

## Decisões da M1

- Produto separado do Sistema de Despacho e com banco PostgreSQL próprio.
- API REST versionada em `/api/v1`.
- Identidade interna do ativo em UUID.
- `tenantId` e `userId` são identidades opacas fornecidas pelo contexto autenticado; nunca vêm do corpo do comando.
- Cadastro mínimo: `code`, `name`, `assetType`, `status` e `technicalData`.
- `technicalData` é um objeto JSON para atributos técnicos específicos sem congelar um catálogo prematuramente.
- `version` inicia em `1` e é incrementada em toda alteração.
- Alteração exige `expectedVersion`; versão divergente retorna conflito e não grava.
- Código é único dentro do tenant, não globalmente.
- Leitura/escrita sempre inclui `tenantId`; busca fora do tenant retorna não encontrado para evitar vazamento de existência.
- Permissões mínimas: `assets:read` e `assets:write`.
- Auditoria registra criação/alteração, tenant, ativo, ator, versão e instante. A M1 não implementa ainda snapshots históricos completos; isso pertence à M2.
- Nenhuma migration é aplicada em banco real nesta entrega.

## Stack

- Node.js 24
- TypeScript
- Fastify
- Zod
- PostgreSQL + Drizzle ORM
- Vitest
- pnpm

## TDD

### RED 1 — domínio e isolamento

Testar antes da implementação:

1. criação válida gera UUID, versão 1 e auditoria;
2. entrada inválida falha sem persistir;
3. usuário sem `assets:write` não cria/altera;
4. usuário sem `assets:read` não consulta;
5. tenant A não consulta nem altera ativo do tenant B;
6. mesmo `code` pode existir em tenants diferentes, mas não duas vezes no mesmo tenant;
7. alteração válida incrementa a versão e registra auditoria;
8. `expectedVersion` obsoleta falha com conflito e não altera o ativo.

### RED 2 — API REST

Testar por `Fastify.inject`:

- `POST /api/v1/assets`;
- `GET /api/v1/assets/:id`;
- `PATCH /api/v1/assets/:id`;
- contexto autenticado injetado por adaptador;
- erros 400/403/404/409 com `correlationId`.

### GREEN

Implementar apenas o necessário para os testes:

- schemas Zod;
- serviço de aplicação;
- porta `AssetRepository`;
- repositório em memória para testes;
- schema Drizzle e repositório PostgreSQL escopado por tenant;
- app Fastify com resolver de autenticação injetável;
- envelope de erro versionado.

## Persistência planejada

Tabelas do banco próprio do Motor:

- `assets` — estado atual do cadastro técnico;
- `asset_audit_log` — trilha mínima de criação/alteração.

Nenhuma tabela é criada no banco do Sistema de Despacho.

## Gate

A M1 pode ser apresentada para aprovação quando:

- todos os testes estiverem GREEN;
- TypeScript e build estiverem GREEN;
- testes provarem isolamento por tenant e autorização negativa;
- concorrência otimista estiver coberta;
- diff não tocar o repositório `dispatch` nem criar integração SQL cruzada;
- migration existir apenas como artefato versionado e não tiver sido aplicada em ambiente real;
- PR permanecer sem merge até aprovação explícita.