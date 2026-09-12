# Axesistemas — Motor de Ativos / Inventário

Produto separado do Sistema de Despacho, responsável pelo cadastro, prontuário técnico e histórico auditável de ativos.

## Arquitetura

- banco próprio;
- integração com o Despacho somente por REST versionado e eventos versionados;
- isolamento obrigatório por tenant;
- autenticação, autorização, auditoria, correlação e idempotência nos contratos críticos;
- nenhuma gravação SQL cruzada entre produtos.

## Roadmap atual

- M0 — Fundação, contratos e isolamento: concluída no repositório `jeffaxe81/dispatch` como contrato de integração;
- M1 — Identidade e cadastro técnico do ativo: em execução neste repositório.

## Stack inicial

Node.js 24, TypeScript, Fastify, Zod, PostgreSQL com Drizzle ORM e Vitest.

Nenhuma migration real, deploy ou grant produtivo é executado automaticamente.