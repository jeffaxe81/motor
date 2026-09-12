# M4 — Busca e listagem operacional

## Objetivo

A M4 torna o Motor de Ativos pesquisável sem exigir conhecimento do identificador interno do ativo ou navegação exclusiva pelo mapa.

## API

`GET /api/v1/assets`

Parâmetros suportados:

- `page`: página iniciando em 1; padrão 1;
- `pageSize`: quantidade por página; padrão 25 e máximo 100;
- `query`: busca textual em código, nome, tipo, status e dados técnicos;
- `assetType`: filtro exato pelo tipo do ativo;
- `status`: filtro exato pelo estado do ativo.

A ordenação é estável por `code` e, em caso de empate, por `id`.

## Segurança e isolamento

A operação exige `assets:read`. O tenant é obtido do contexto autenticado e não pode ser informado pelo cliente na query. Toda busca em PostgreSQL inclui filtro obrigatório por `tenant_id`.

## Persistência

A M4 não cria nova tabela nem exige migration. A pesquisa opera sobre a tabela `assets`, que permanece como fonte do estado atual do cadastro técnico.

## Busca textual

A busca é case-insensitive e considera somente os campos já aprovados no prontuário atual:

- código;
- nome;
- tipo;
- status;
- conteúdo serializado de `technicalData`.

Não são inferidos campos ou métricas novos.

## Paginação

A resposta retorna:

- `items`;
- `page`;
- `pageSize`;
- `total`;
- `totalPages`.

Parâmetros inválidos resultam em `validation.invalid`.

## Experiência responsiva

Este repositório é atualmente responsável pelo backend/API do Motor de Ativos e não possui frontend próprio. A tela responsiva de pesquisa/listagem deve consumir este contrato REST, preservando os estados de carregamento, vazio, erro, filtros e paginação sem acessar o banco diretamente.

## Validação

Os testes cobrem paginação determinística, busca por cadastro técnico, filtros, isolamento entre tenants, resposta HTTP e rejeição de paginação inválida.

## Rollback

Como a M4 não possui migration, rollback consiste em reverter os commits desta microentrega. Não há alteração estrutural de banco a desfazer.
