# Hudson Car — Sistema de Gestão da Oficina

Sistema de gestão da oficina **Hudson Car** (cliente Charlles Hudson, São Carlos).
Este repositório contém o app **full-stack** (frontend + backend + banco) da **Sprint 1**.

## Stack

- **Next.js 14 (App Router)** + **React 18** + **TypeScript** (strict, `noUncheckedIndexedAccess`)
- **Prisma ORM** + **SQLite** (arquivo local, sem Docker)
- **Zod** para validação de entrada (client/server)
- **Auth própria**: senha com hash **bcrypt** + sessão em **JWT** (cookie httpOnly, via `jose`)
- **@mui/icons-material** para ícones; design system em CSS puro (`src/app/globals.css`)
- **Vitest** para testes (regras de negócio + RBAC)

> Nota: o rascunho da Sprint 1 citava "Next.js 15 + Postgres". Optou-se por **Next.js 14 + SQLite** para rodar sem Docker no Windows e por estabilidade com React 18/MUI. O Prisma facilita migrar para PostgreSQL depois (trocar `provider` e a `DATABASE_URL`).

## Como rodar

Pré-requisito: **Node.js 18+**.

```bash
cd Codigo
npm install
npm run setup     # cria o SQLite, aplica o schema e popula (seed)
npm run dev       # http://localhost:3000
```

`npm run setup` = `prisma migrate dev` + `npm run db:seed`. Se preferir, use `npm run db:migrate` e `npm run db:seed` separados.

### Credenciais de demonstração (criadas pelo seed)

| E-mail | Papel | Acesso |
|---|---|---|
| `charlles@hudsoncar.local` | **ADMIN** | vê tudo, inclusive Relatórios/financeiro |
| `ronaldo@hudsoncar.local` | GESTOR | operacional, **sem** financeiro |
| `vitor@hudsoncar.local` | OPERACIONAL | operacional, **sem** financeiro |

Senha (todos): **`oficina123`**.

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Sobe o app (Next dev) |
| `npm run build` / `start` | Build de produção / servir |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (next) |
| `npm run test` | Testes (Vitest) |
| `npm run db:migrate` | Cria/aplica migração de dev |
| `npm run db:seed` | Popula dados de demonstração |
| `npm run db:reset` | Reseta o banco (apaga e recria) |
| `npm run db:studio` | Abre o Prisma Studio |
| `npm run setup` | Migração + seed (atalho) |

## Escopo desta entrega (Sprint 1)

Fundação (auth + RBAC) e o módulo de maior dor do cliente: **peças/fornecedores**, **estoque** e **preço do dia**.

- **Autenticação + RBAC**: login por e-mail/senha, sessão em cookie; papéis ADMIN/GESTOR/OPERACIONAL. **Financeiro/relatórios/usuários só ADMIN** (regra de ouro nº 2), garantido no `middleware.ts` **e** nos handlers (`src/lib/rbac.ts`).
- **Fornecedores**: CRUD.
- **Peças**: CRUD + **busca por nome, código e chassi compatível** (prioridade do cliente).
- **Preço do dia**: endpoint dedicado com **auditoria** (quem/quando), sempre manual — nunca média/fixo (regra de ouro nº 3).
- **Estoque**: movimentações (ENTRADA/SAÍDA/AJUSTE) com saldo rastreável; **alertas de compra** abaixo do mínimo.
- Concorrência: entidades com `version` (controle otimista) — base para edição simultânea (regra de ouro nº 4).

Módulos ainda **mockados** (telas presentes, sem backend nesta sprint): orçamentos, ordens de serviço, veículos, clientes, relatórios.

## API (resumo)

Todas retornam JSON; erros no formato `{ code, message, detalhes? }`. Exigem sessão, exceto login/logout.

- `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me`
- `GET|POST /api/fornecedores` · `GET|PATCH|DELETE /api/fornecedores/:id`
- `GET|POST /api/pecas` (`?q=&chassi=&categoria=`) · `GET|PATCH|DELETE /api/pecas/:id`
- `PATCH /api/pecas/:id/preco-dia`
- `GET /api/estoque` · `GET /api/estoque/alertas`
- `GET|POST /api/estoque/movimentacoes`

## Estrutura

```
Codigo/
├── prisma/
│   ├── schema.prisma     # Usuario, Fornecedor, Peca, ChassiCompativel, MovimentacaoEstoque
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── api/          # route handlers (backend)
│   │   ├── (app)/        # área autenticada (UI)
│   │   └── login/
│   ├── lib/              # db, auth, session, rbac, http, validation, constants
│   ├── server/           # regras de negócio (estoque) — testáveis
│   ├── components/ · context/ · utils/ · data/(mock)
│   └── middleware.ts     # guarda de sessão + RBAC de rotas admin
└── tests/                # Vitest (unit + integração com SQLite de teste)
```

## Testes

```bash
npm run test
```

Cobrem: regra de saldo (entrada/saída/ajuste + bloqueio de negativo), alertas de compra, busca por chassi, auditoria do preço do dia e **RBAC** (financeiro/admin barrado para GESTOR/OPERACIONAL). Usam um banco `prisma/test.db` isolado.

---

> Protótipo acadêmico (TIS3 · PUC Minas · 2026). Dados fictícios. O financeiro real
> **não** migra do sistema legado nesta fase (regra de ouro nº 2).
