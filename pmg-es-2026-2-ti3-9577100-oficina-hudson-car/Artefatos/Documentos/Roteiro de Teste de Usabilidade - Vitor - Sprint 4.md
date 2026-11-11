# Roteiro de Teste de Usabilidade — Vitor (Sprint 4)

**Requisito:** RNF01 — "um usuário leigo conclui as tarefas principais sem treinamento".
**Sistema:** Oficina Hudson Car. **Participante:** Vitor (secretário, usuário principal no dia a dia).
**Issue:** #46 (V4). **Responsáveis:** todos os 5 devs (facilitação + observação).

> Objetivo: validar, com o usuário real, se as tarefas centrais do sistema são
> concluídas **sem ajuda e sem treinamento**. O foco é observar **onde ele trava**,
> não "ensinar" a usar.

---

## 1. Preparação (antes da sessão)

- [ ] Ambiente de testes no ar, com dados realistas (clientes/veículos já cadastrados, algumas peças com estoque).
- [ ] Logar com um usuário de papel **OPERACIONAL** (é o papel do Vitor — valida também que ele **não** vê financeiro).
- [ ] Celular + computador disponíveis (as fotos são tiradas no celular).
- [ ] 1 facilitador (conduz) + 1 observador (anota e cronometra). Gravar a tela, se o Vitor autorizar.
- [ ] Explicar ao Vitor: "pense em voz alta; se travar, tudo bem — é o sistema que estamos testando, não você."

**Regra de ouro do teste:** o facilitador **não dá dicas** enquanto a tarefa não termina ou o Vitor desiste. Anote a primeira hesitação.

---

## 2. Roteiro de tarefas

Para cada tarefa: leia o **cenário** em voz alta, entregue o controle ao Vitor e observe. Marque o resultado.

### Tarefa 1 — Buscar uma peça (por chassi)
- **Cenário:** "Chegou um carro e você precisa saber se temos a peça X compatível com o chassi `9BWZZZ...`. Encontre essa peça no sistema."
- **Caminho esperado:** Peças & Fornecedores → busca por chassi/nome.
- **Sucesso:** encontra a peça certa e vê o preço do dia.
- Concluiu sozinho? ☐ Sim ☐ Com dica ☐ Não — Tempo: ____ — Onde travou: ___________________

### Tarefa 2 — Lançar entrada de estoque
- **Cenário:** "Chegou um fornecedor com 50 litros de óleo. Registre essa entrada no estoque."
- **Caminho esperado:** Estoque → movimentação de ENTRADA → peça + quantidade.
- **Sucesso:** o saldo da peça aumenta e a movimentação fica registrada.
- Concluiu sozinho? ☐ Sim ☐ Com dica ☐ Não — Tempo: ____ — Onde travou: ___________________

### Tarefa 3 — Criar um orçamento
- **Cenário:** "Um cliente quer um orçamento: troca de óleo (mão de obra) + um filtro (peça). Monte o orçamento para o veículo dele."
- **Caminho esperado:** Orçamentos → novo → escolher cliente/veículo → adicionar itens → salvar.
- **Sucesso:** orçamento criado com os dois itens e total correto.
- Concluiu sozinho? ☐ Sim ☐ Com dica ☐ Não — Tempo: ____ — Onde travou: ___________________

### Tarefa 4 — Tirar foto de entrada do veículo (celular)
- **Cenário:** "O carro acabou de chegar. Registre uma foto do estado de entrada dele."
- **Caminho esperado:** Veículos → selecionar o veículo → "Adicionar fotos de entrada" → câmera → foto aparece na lista.
- **Sucesso:** a foto é tirada pelo celular e aparece listada logo após o envio.
- Concluiu sozinho? ☐ Sim ☐ Com dica ☐ Não — Tempo: ____ — Onde travou: ___________________

### Tarefa 5 — Gerar a Ordem de Serviço
- **Cenário:** "O cliente autorizou o orçamento. Gere a ordem de serviço e defina o mecânico responsável."
- **Caminho esperado:** autorizar o orçamento → Ordens de Serviço → nova OS → escolher orçamento autorizado + mecânico.
- **Sucesso:** OS criada, vinculada ao orçamento, com mecânico definido.
- Concluiu sozinho? ☐ Sim ☐ Com dica ☐ Não — Tempo: ____ — Onde travou: ___________________

### Verificação de sigilo (regra de ouro nº 2)
- [ ] Confirmar que, logado como Vitor (OPERACIONAL), **não existe** menu/tela de **Relatórios/financeiro**.

---

## 3. Métricas da sessão

| Métrica | Como medir | Meta |
|---|---|---|
| Taxa de sucesso sem ajuda | tarefas concluídas sem dica / 5 | ≥ 4 de 5 |
| Tempo por tarefa | cronômetro por tarefa | sem travas longas |
| Nº de travamentos | pontos onde hesitou/pediu ajuda | o menor possível |
| Satisfação (1–5) | pergunta ao final: "quão fácil foi?" | ≥ 4 |

**Pergunta de fechamento:** "O que foi mais confuso? O que mudaria para ficar mais fácil?"

---

## 4. Registro de achados

Preencher durante/após a sessão. Severidade: **Crítico** (impede concluir) · **Médio** (atrapalha, mas conclui) · **Leve** (cosmético/sugestão).

| # | Tarefa | O que aconteceu (observado) | Severidade | Ação sugerida | Issue |
|---|--------|------------------------------|------------|----------------|-------|
| 1 |        |                              |            |                |       |
| 2 |        |                              |            |                |       |
| 3 |        |                              |            |                |       |
| 4 |        |                              |            |                |       |
| 5 |        |                              |            |                |       |

---

## 5. Próximos passos (pós-sessão)

- [ ] Consolidar os achados nesta tabela.
- [ ] Abrir uma **issue por achado** no board (#769), com label `usabilidade` e severidade.
- [ ] **Resolver os achados críticos ainda nesta sprint** (critério de aceite do #46).
- [ ] Anexar este roteiro preenchido + resumo à ata de validação.

**Critérios de aceite do #46:**
- [ ] Vitor completa as tarefas do roteiro sem ajuda.
- [ ] Achados registrados; ajustes críticos resolvidos.
