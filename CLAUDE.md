# CLAUDE.md — Projeto TIS3: Sistema de Gestão para Oficina Mecânica

Contexto para qualquer pessoa (ou agente) que trabalhe neste repositório. Leia antes de começar.

## O que é este projeto

Um **novo sistema de gestão para uma oficina de mecânica geral** (a "Hudson Car", do cliente **Charlles Hudson**, em São Carlos). O sistema substitui um software pago que o cliente usa hoje e do qual aproveita pouco (~5 de ~20 funções, difícil de usar).

O objetivo central: um sistema **simples de usar**, que cubra **orçamento, ordem de serviço, histórico de veículos, controle de peças/estoque e relatórios**, respeitando a forma de trabalhar do cliente.

> Status: **greenfield** — em levantamento/definição. Ainda não há código nem stack fechada.

## O cliente e como a oficina opera

- Mecânica geral, no ramo desde 1992. Equipe: Charlles (dono, avalia e entrega **todos** os carros), o irmão (sócio/comprador), 1 secretário (**Vitor**) e operacionais (mecânicos, ajudantes, lavador).
- Só **3 pessoas usam o sistema**: Charlles, o irmão e o Vitor. Os demais são operacionais.
- ~12 carros/dia, rotatividade quase toda diária. ~95% pessoa física, captação por indicação.
- Trabalha com **agendamento** (agenda cheia ~20 dias à frente).
- Fluxo do serviço: avaliação inicial → desmonta o carro → **orçamento no sistema** → liga pro cliente autorizar → na entrega mostra as peças velhas + carro lavado.
- Pagamento: **PIX, cheque e dinheiro** (não aceita cartão hoje).
- **Vitor** é quem domina o sistema atual — referência técnica do lado do cliente.

## Regras de ouro (requisitos não-negociáveis)

1. **Usabilidade acima de tudo.** É o pedido nº 1 do cliente, que se considera leigo em TI. Interface simples, intuitiva, sem jargão. Um recurso que ele não consegue usar sozinho não resolve o problema dele.
2. **Financeiro é sigiloso — só o admin (Charlles) vê.** Faturamento, receita, salários e pagamentos **nunca** podem ser vistos por outros usuários (nem irmão, nem Vitor). Exige **controle de permissões por papel (RBAC)**: admin vê tudo; demais têm acesso operacional (orçamento, estoque, clientes) sem financeiro.
3. **Preço de peça é sempre o "preço do dia".** Os valores oscilam muito; **não** usar preço fixo nem média — o cliente atualiza manualmente. Só o Charlles define valores e mão de obra (não há tabela fixa; o mesmo serviço varia por carro).
4. **Concorrência de edição não pode quebrar dados.** No sistema atual, quando 2 pessoas editam o mesmo orçamento, ele trava e os valores digitados se perdem. O novo sistema **precisa** tratar edição simultânea sem perda de dados.

## Prioridades funcionais (em ordem de dor do cliente)

1. **Interface simples/intuitiva** — pré-requisito de tudo.
2. **Busca e controle de peças + fornecedores** — maior dor. ~80% das peças são compradas sob demanda; achar peça é difícil. Busca por **chassi** para não errar a peça. ~20–25 fornecedores.
3. **Estoque atualizado** com quantidade, subcategorias e **alertas de compra** (ex.: óleo — 200–250 L a cada 5 dias; ~150 modelos de presilha). Hoje peças instaladas às vezes não são baixadas do estoque.
4. **Histórico por veículo** (serviços, garantia) + **fotos de entrada/saída** (evita disputa de arranhão após a lavagem).
5. **Relatórios comparativos** por período (nº de carros × faturamento — não são proporcionais). **Restritos ao admin.**
6. **Responsável por cada serviço** (1 mecânico principal por carro).

Fora de escopo por ora: **site** apenas institucional/simples (endereço, localização, fotos, avaliações do Google), sem foco em captação. Aceitar **cartão** pode entrar no futuro.

## Migração de dados

- Trazer **clientes e veículos** do sistema atual (~1 ano e 3 meses de dados).
- **Financeiro NÃO migra** e, no início, o cliente continua controlando manualmente (ver regra de ouro nº 2).
- Depende de reunião técnica com o **Vitor** para acessar o sistema legado e entender os fluxos reais.

## Stack (planejada — confirmar antes de assumir)

Ainda **não decidida**. O ferramental configurado (`.gitignore`, agentes) aponta para um projeto **Node.js + TypeScript full-stack** (provavelmente **Next.js/React**). Confirme com o time antes de escrever código assumindo uma stack. Convenções esperadas: código tipado, testável e seguindo os padrões que forem estabelecidos nos primeiros módulos.

## Convenções de trabalho

- **Idioma:** código e docs deste projeto em **português** (nomes de domínio: `oficina`, `orcamento`, `ordemServico`, `peca`, `estoque`, `veiculo`, `cliente`).
- Ao implementar qualquer coisa que toque dados financeiros ou permissões, reveja a **regra de ouro nº 2**.
- Agentes/skills disponíveis no repo cobrem backend, frontend, testes, revisão e segurança — use-os conforme a tarefa.

## Referências

- **Ata + transcrição completa da reunião de levantamento** (23/08/2026):
  `C:\Users\iebt\Downloads\ata_reuniao_oficina_charlles_23-08-2026.md`
- Memória do projeto (Claude Code): resumos em
  `~/.claude/projects/C--Users-iebt-desktop-PUC-projeto-tis3/memory/`
