# Sprint 1 — Planejamento (Fundação + Peças/Estoque)

> **Projeto:** Sistema de Gestão — Oficina Hudson Car (Charlles Hudson)
> **Duração:** 2 semanas (10 dias úteis)
> **Time:** 5 desenvolvedores
> **Stack:** Next.js (App Router) + TypeScript + PostgreSQL (Prisma) + Vitest/RTL/Playwright
> **Início:** a definir · **Documento vivo** — atualizar conforme a sprint avança

---

## 1. Objetivo da Sprint (Sprint Goal)

> **Ter a fundação do sistema no ar (auth + RBAC + design base + CI) e o módulo de maior dor do cliente funcionando de ponta a ponta: cadastro e busca de peças/fornecedores, controle de estoque com alertas de compra e "preço do dia".**

Ao final da sprint, um usuário operacional (papel Vitor) deve conseguir:
- Fazer login e navegar num layout consistente e simples.
- Cadastrar/editar peças e fornecedores.
- **Buscar peça por nome, código e chassi compatível.**
- Ver o estoque atualizado, dar entrada/baixa de peças e receber **alertas de compra** quando abaixo do mínimo.
- Atualizar manualmente o **preço do dia** de cada peça.

E o admin (Charlles) deve ver tudo isso **sem que dados financeiros vazem** para os demais papéis (regra de ouro nº 2).

**Fora do escopo desta sprint:** orçamento, ordem de serviço, relatórios, fotos de entrada/saída, migração real de dados (apenas *spike*), site institucional.

---

## 2. Princípios que guiam esta sprint (do CLAUDE.md)

1. **Usabilidade acima de tudo** — telas simples, sem jargão. Toda UI passa por um teste de "o Charlles conseguiria usar sozinho?".
2. **Financeiro é sigiloso** — RBAC desde o dia 1. Nenhum campo/rota financeira acessível fora do papel admin.
3. **Preço da peça = "preço do dia"** — campo editável manualmente, sem média nem trava; registrar quem alterou e quando.
4. **Concorrência não pode quebrar dados** — já nesta sprint o modelo de dados nasce com controle de versão otimista (`version`/`updatedAt`) para preparar o terreno de edição simultânea.
5. **Idioma do domínio em português** — `peca`, `estoque`, `fornecedor`, `veiculo`, `cliente`, `usuario`, `papel`.

---

## 3. Time e responsabilidades (5 devs)

| # | Papel na sprint | Foco principal | Agente/skill de apoio |
|---|---|---|---|
| **D1** | **Tech Lead / Plataforma** | Scaffold do projeto, Prisma+Postgres, migrations, CI, config de ambiente, code review | `backend-architect`, `code-reviewer` |
| **D2** | **Backend — Domínio Peças/Estoque** | API de peças, fornecedores, estoque, movimentações, preço do dia | `backend-architect`, `api-endpoint` |
| **D3** | **Backend — Auth & RBAC** | Autenticação, papéis, middleware de autorização, guarda de rotas financeiras | `backend-architect`, `security-auditor` |
| **D4** | **Frontend — Design System & Fundação** | Layout, navegação, design system (usabilidade), tela de login, telas de fornecedores | `frontend-architect`, `react-component` |
| **D5** | **Frontend/Full-stack — Peças & Estoque UI** | Busca de peças (inclui chassi), listagem, estoque, alertas de compra, preço do dia | `frontend-architect`, `react-component`, `test-engineer` |

> **Testes são responsabilidade de todos.** D1 configura o ferramental; cada dev entrega sua fatia com testes (unit + integração). D5 lidera os e2e do fluxo de peças/estoque.

---

## 4. Decisões técnicas assumidas (confirmar na 1ª daily)

| Área | Decisão | Observação |
|---|---|---|
| Framework | **Next.js 15 (App Router)** | Front + API (route handlers / server actions) no mesmo repo |
| Linguagem | **TypeScript** (strict) | `noUncheckedIndexedAccess` ligado |
| ORM/DB | **Prisma + PostgreSQL** | Postgres local via Docker Compose |
| Auth | **Auth.js (NextAuth) credenciais** ou Lucia | Sessão + RBAC por papel; senha com hash (argon2/bcrypt) |
| UI | **Tailwind + shadcn/ui** | Base acessível, acelera design system simples |
| Validação | **Zod** | Schemas compartilhados client/server |
| Testes | **Vitest + React Testing Library + Playwright** | Cobertura mínima nas regras de negócio |
| Lint/format | **ESLint + Prettier** | Gate no CI |
| CI | **GitHub Actions** | lint + typecheck + test em cada PR |

> ⚠️ Se o time discordar de alguma escolha, decidir **na daily 1** e registrar aqui — não bloquear o resto da sprint.

---

## 5. Modelo de dados (rascunho para esta sprint)

Entidades que nascem nesta sprint. Todas com `id`, `createdAt`, `updatedAt` e `version` (int, controle otimista).

```
Usuario
  id, nome, email (único), senhaHash, papel (enum: ADMIN | GESTOR | OPERACIONAL), ativo

Fornecedor
  id, nome, cnpjOuDoc?, telefone?, email?, observacao?

Peca
  id, nome, codigo? (SKU/interno), categoria, subcategoria?,
  fornecedorId (fk, opcional), unidade (enum: UN | L | KG | ...),
  precoDia (decimal, editável manual), precoDiaAtualizadoEm, precoDiaAtualizadoPor (fk Usuario),
  quantidadeAtual (decimal), estoqueMinimo (decimal)

ChassiCompativel        // busca por chassi (prioridade do cliente)
  id, pecaId (fk), chassi (string), modeloVeiculo?

MovimentacaoEstoque
  id, pecaId (fk), tipo (enum: ENTRADA | SAIDA | AJUSTE),
  quantidade (decimal), motivo?, usuarioId (fk), data
```

**Regras de negócio embutidas:**
- Toda alteração de `quantidadeAtual` passa por uma `MovimentacaoEstoque` (rastreabilidade — hoje peças instaladas somem do estoque sem baixa).
- `precoDia` **nunca** é calculado/mediado — só sobrescrito manualmente, com auditoria de quem/quando.
- Campos financeiros de fato (faturamento, salários, pagamentos) **não entram nesta sprint**; quando entrarem, ficam em entidade/rota separada, protegida por RBAC ADMIN.

### Matriz de permissões (RBAC) — vigente nesta sprint

| Recurso | ADMIN (Charlles) | GESTOR (irmão) | OPERACIONAL (Vitor) |
|---|---|---|---|
| Peças (CRUD) | ✅ | ✅ | ✅ |
| Fornecedores (CRUD) | ✅ | ✅ | ✅ |
| Estoque / movimentações | ✅ | ✅ | ✅ |
| Preço do dia (editar) | ✅ | ✅ | ✅ |
| **Qualquer dado financeiro** | ✅ | ❌ | ❌ |
| Gestão de usuários/papéis | ✅ | ❌ | ❌ |

> Nesta sprint não há tela financeira ainda — mas o **middleware de autorização e o padrão de guarda já nascem prontos** e testados, para nenhum módulo futuro nascer sem RBAC.

---

## 6. Backlog da Sprint (épicos → histórias)

Estimativa em **story points (SP)** (escala Fibonacci). Total planejado: **~62 SP**.

### ÉPICO A — Fundação da Plataforma  *(D1, apoio D3)*

| ID | História | Critérios de aceite | SP | Dono |
|---|---|---|---|---|
| A1 | Scaffold Next.js + TS + estrutura de pastas por domínio | `pnpm dev` sobe; estrutura `src/(app|server|domain)` documentada; strict mode | 3 | D1 |
| A2 | Postgres via Docker Compose + Prisma + migration inicial | `docker compose up` sobe DB; `prisma migrate` cria as tabelas do §5 | 3 | D1 |
| A3 | Seed de dados de teste (usuários dos 3 papéis, fornecedores, peças) | `pnpm seed` popula base navegável | 2 | D1 |
| A4 | CI (GitHub Actions): lint + typecheck + test | PR bloqueia merge se falhar | 3 | D1 |
| A5 | Convenções: ESLint/Prettier, README de setup, padrão de erro/resposta da API | Doc no repo; erro padronizado `{ code, message }` | 2 | D1 |

### ÉPICO B — Autenticação & RBAC  *(D3, apoio D1)*

| ID | História | Critérios de aceite | SP | Dono |
|---|---|---|---|---|
| B1 | Login/logout com sessão + senha com hash | Usuário inválido é rejeitado; sessão persiste; senha nunca em texto plano | 5 | D3 |
| B2 | Modelo de papéis (ADMIN/GESTOR/OPERACIONAL) + middleware de autorização | Rota protegida por papel; teste garante 403 para papel sem acesso | 5 | D3 |
| B3 | Guarda de rotas/campos financeiros (regra de ouro nº 2) | Teste automatizado prova que GESTOR/OPERACIONAL não acessam recurso marcado como financeiro | 3 | D3 |
| B4 | Auditoria mínima (quem alterou preço/estoque) | `precoDiaAtualizadoPor` e `usuarioId` de movimentação preenchidos e testados | 2 | D3 |

### ÉPICO C — Peças & Fornecedores (Backend)  *(D2)*

| ID | História | Critérios de aceite | SP | Dono |
|---|---|---|---|---|
| C1 | API CRUD Fornecedor (Zod + validação + testes de integração) | Criar/editar/listar/remover; validação de entrada; 20–25 fornecedores suportados | 3 | D2 |
| C2 | API CRUD Peça (categoria/subcategoria, unidade, fornecedor) | CRUD completo com validação e testes | 5 | D2 |
| C3 | **Busca de peça** por nome, código e **chassi compatível** | Endpoint de busca com filtros combináveis; busca por chassi retorna peças corretas; testes cobrem | 5 | D2 |
| C4 | Atualização de **preço do dia** com auditoria | Endpoint dedicado; grava quem/quando; sem cálculo automático | 3 | D2 |

### ÉPICO D — Estoque & Alertas (Backend + Frontend)  *(D2 + D5)*

| ID | História | Critérios de aceite | SP | Dono |
|---|---|---|---|---|
| D1x | API de movimentação de estoque (entrada/saída/ajuste) | Toda mudança de saldo gera movimentação; saldo nunca negativo sem ajuste explícito; testes | 5 | D2 |
| D2x | **Alertas de compra** (peça abaixo do estoque mínimo) | Endpoint/lista de peças em alerta; regra testada (ex.: óleo, presilhas) | 3 | D2 |

### ÉPICO E — Frontend Fundação + Peças/Estoque  *(D4 + D5)*

| ID | História | Critérios de aceite | SP | Dono |
|---|---|---|---|---|
| E1 | Layout base + navegação + design system (foco usabilidade) | Header/menu, tema, componentes base (botão, input, tabela, modal, toast) acessíveis | 5 | D4 |
| E2 | Tela de login | Formulário simples, mensagens de erro claras, responsivo | 2 | D4 |
| E3 | Telas de Fornecedores (lista + form) | Lista, criar, editar; validação e feedback visível | 3 | D4 |
| E4 | **Tela de busca/listagem de Peças** (nome, código, chassi) | Busca rápida, resultados claros; busca por chassi em destaque | 5 | D5 |
| E5 | Tela de Peça (detalhe/edição + preço do dia) | Editar dados e preço do dia; mostra "atualizado por/em" | 3 | D5 |
| E6 | Tela de Estoque + movimentações + **painel de alertas de compra** | Ver saldo, dar entrada/baixa, lista de alertas destacada na home | 5 | D5 |
| E7 | Esconder tudo que é financeiro na UI conforme papel | Componentes financeiros não renderizam para GESTOR/OPERACIONAL (pareado com B3) | 2 | D4 |

**Total ≈ 62 SP.** Reservar ~15% de folga para imprevistos/revisões. Se estourar, **cortar por último**: E7 (não há financeiro visível ainda) e D2x (alerta pode virar consulta simples).

---

## 7. Dependências e ordem de execução

```
A1 ──> A2 ──> A3 ─────────────┐
       │                      │
       └─> B1 ─> B2 ─> B3/B4  │
       │                      ├─> C1 ─> C2 ─> C3/C4 ─> D1x ─> D2x
       └─> A4/A5              │
                              └─> E1 ─> E2/E3
                                   E1 ─> E4 ─> E5 ─> E6 ─> E7
```

**Caminho crítico:** A1 → A2 (schema Prisma) libera **todo** o backend de domínio (C*, D*) e o front que consome dados. Por isso A1/A2 têm que fechar **no dia 1–2**.

**Contrato de API primeiro:** D2 e D5 acordam os shapes de request/response (Zod) **no dia 2**, para o frontend trabalhar contra mock/tipos enquanto o backend real fica pronto — evita bloqueio serial.

---

## 8. Cronograma (2 semanas)

### Semana 1 — Fundação e contratos

| Dia | Foco | Entregáveis-chave |
|---|---|---|
| **D1** | Kickoff + setup | A1 iniciado; decisões técnicas confirmadas; repo com scaffold |
| **D2** | Fundação DB/CI + contratos de API | A2 (schema+migration), A4/A5; C*/D* e E* fecham contratos Zod |
| **D3** | Auth começa; domínio começa; design system | B1 em andamento; C1 (fornecedor); E1 (design system) |
| **D4** | Auth + RBAC; peças; UI fornecedor | B2; C2 (peça); E2/E3 |
| **D5** | RBAC financeiro; busca peça | B3/B4; C3 (busca+chassi) começa; E4 começa |

**Marco fim da Semana 1:** login funciona, RBAC bloqueia financeiro, CRUD de fornecedor/peça no ar, design system pronto. **Demo interna sexta.**

### Semana 2 — Peças/Estoque de ponta a ponta

| Dia | Foco | Entregáveis-chave |
|---|---|---|
| **D6** | Busca + preço do dia | C3 finalizada; C4 (preço do dia); E4/E5 |
| **D7** | Estoque | D1x (movimentações); E6 começa |
| **D8** | Alertas + integração | D2x (alertas); E6 (painel de alertas); E7 |
| **D9** | Hardening | e2e do fluxo completo; correção de bugs; revisão de segurança (RBAC/financeiro) |
| **D10** | Fechamento | Regressão, polish de usabilidade, **demo + review + retro** |

---

## 9. Cerimônias

| Cerimônia | Quando | Duração | Objetivo |
|---|---|---|---|
| Sprint Planning | Dia 1 (manhã) | 1h30 | Confirmar goal, stack, distribuir histórias |
| Daily | Todos os dias | 15 min | Bloqueios e sincronização de contratos |
| Refinement | Dia 5 | 30 min | Ajustar backlog da semana 2 com o aprendido |
| Sprint Review / Demo | Dia 10 | 1h | Mostrar fluxo de peças/estoque funcionando |
| Retrospectiva | Dia 10 | 45 min | Melhorar processo para a Sprint 2 |

> **Sugestão:** convidar o **Vitor** (referência do cliente) para a demo — validar usabilidade cedo evita retrabalho.

---

## 10. Definition of Ready (DoR) e Definition of Done (DoD)

**DoR (para uma história entrar na sprint):**
- Critérios de aceite claros e testáveis.
- Dependências identificadas.
- Contrato de dados/API conhecido (ou acordado no dia 2).

**DoD (para uma história ser considerada pronta):**
- [ ] Código tipado (TS strict), sem `any` não justificado.
- [ ] Validação de entrada (Zod) no backend.
- [ ] Testes: unitário nas regras de negócio + integração nos endpoints; e2e no fluxo crítico.
- [ ] **RBAC respeitado** — nenhum dado financeiro exposto fora do ADMIN (com teste que prova).
- [ ] Lint + typecheck + testes verdes no CI.
- [ ] Revisado por outro dev (`code-reviewer` + humano) e mergeado via PR.
- [ ] Textos de UI em português, sem jargão; estados de erro/carregamento/vazio tratados.

---

## 11. Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Stack não confirmada / discordância | Bloqueia início | Decidir na daily 1; registrar neste doc; timebox de 30 min |
| Caminho crítico A1/A2 atrasa | Bloqueia todo o backend/front | Prioridade máxima do D1 nos 2 primeiros dias; par com D3 se preciso |
| RBAC/financeiro implementado tarde | Vaza regra de ouro nº 2 | RBAC entra na Semana 1; `security-auditor` roda no dia 9 |
| Busca por chassi mais complexa que o previsto | Atrasa a maior dor do cliente | Modelar `ChassiCompativel` desde A2; começar C3 no dia 5 |
| Escopo estoura (62 SP + fundação) | Sprint não fecha | Ordem de corte definida (§6); E7/D2x são os primeiros a virar simplificados |
| Concorrência de edição (regra nº 4) | Fora do escopo, mas modelo precisa suportar | Campo `version` nasce nesta sprint; implementação de lock/merge fica para a Sprint 2 |
| Migração de dados legada | Dependência externa (Vitor) | Apenas *spike* de investigação nesta sprint (sem código de migração real) |

---

## 12. Métricas de sucesso da sprint

- **Sprint Goal atingido:** fluxo de peças/estoque demonstrável de ponta a ponta.
- **0** rotas/campos financeiros acessíveis fora do ADMIN (validado por teste + `security-auditor`).
- **Busca por chassi** retorna a peça correta em < 1s no seed.
- CI verde em `main`; cobertura de testes nas regras de negócio de estoque/preço/ RBAC.
- Feedback de usabilidade do Vitor coletado na demo.

---

## 13. Preparação para a Sprint 2 (não fazer agora, só antecipar)

- Edição concorrente de orçamento (regra de ouro nº 4) — usar o `version` já criado.
- Módulo de **Orçamento → Ordem de Serviço**.
- **Histórico por veículo** + fotos de entrada/saída.
- **Relatórios comparativos** (restritos ao admin).
- Migração real de clientes/veículos após reunião técnica com o Vitor.

---

*Documento gerado como base de planejamento. Ajustar números e nomes de devs conforme o time real.*
