# M6 — Fotos, documentos, laudos e assinaturas

## Objetivo

Registrar evidências documentais relacionadas ao ativo sem armazenar conteúdo binário no prontuário principal.

## Modelo

A tabela `asset_evidence` armazena somente metadados:

- identificador da evidência;
- tenant e ativo;
- tipo da evidência;
- nome e tipo de mídia;
- tamanho em bytes;
- referência externa de storage (`storageKey`);
- hash SHA-256;
- origem;
- autor, correlação e data/hora;
- referência opcional a assinatura externa;
- estado de validade.

O conteúdo binário permanece fora do banco do Motor de Ativos.

## Tipos aceitos nesta microentrega

- `photo-before`;
- `photo-after`;
- `document`;
- `report`.

Tipos de mídia aceitos:

- `image/jpeg`;
- `image/png`;
- `application/pdf`.

O limite de tamanho definido no contrato é 25 MiB por evidência.

## Assinaturas

O campo `signatureReference` contém apenas uma referência para o módulo externo de assinatura. O Motor de Ativos não implementa ICP-Brasil, não guarda certificado e não executa assinatura digital nesta microentrega.

## REST

- `POST /api/v1/assets/:id/evidence`: registra metadados da evidência;
- `GET /api/v1/assets/:id/evidence`: lista evidências do ativo;
- `GET /api/v1/assets/:id/timeline`: inclui itens `asset.evidence.added` junto à timeline técnica.

Todas as operações usam o tenant obtido do contexto autenticado. O tenant não é aceito do payload como substituto do contexto.

## Segurança

- hash SHA-256 deve possuir 64 caracteres hexadecimais;
- binários não são aceitos por este contrato;
- tipo e tamanho são validados antes da persistência;
- leitura/escrita exige as permissões de ativos já usadas pelo produto;
- evidências não podem ser consultadas por outro tenant.

## Persistência

A migration desta etapa é `drizzle/0003_m6_asset_evidence.sql`.

Nesta entrega a migration é apenas versionada e aplicada nos bancos efêmeros de teste/CI. Não há autorização automática para aplicar migration em produção.

## Validação

O gate da M6 exige:

1. TypeScript GREEN;
2. testes unitários de validação e isolamento;
3. teste HTTP;
4. teste PostgreSQL;
5. build GREEN;
6. reprodutibilidade GREEN.

## Rollback

Antes de produção, o rollback deve ser planejado junto da migration real. Nenhum `DROP TABLE` produtivo é executado automaticamente. Como os binários ficam em storage externo, o rollback do banco não deve excluir objetos de storage sem procedimento explícito e auditável.
