// Regras de negócio de ORÇAMENTO (camada de serviço, testável pelo Vitest).
//
// Regras centrais (Sprint 2):
//  - Preço da peça = preço do dia COPIADO no momento em que o item entra; mudar
//    o preço depois não altera orçamentos já montados (regra de ouro nº 3).
//  - Controle otimista por cabeçalho E por item (regra de ouro nº 4): salvar
//    com uma versão antiga devolve 409 CONFLITO e NUNCA sobrescreve — a resposta
//    carrega o estado atual para a tela mostrar o que a outra pessoa salvou.
//  - Duas pessoas editando itens diferentes não conflitam (versão é por item).
//  - Orçamento AUTORIZADO ou RECUSADO não é mais editado.

import { prisma } from '@/lib/db'
import { ApiError } from '@/lib/http'
import type { FormaAutorizacao, StatusOrcamento } from '@/lib/constants'
import type { Prisma } from '@prisma/client'

// Status em que o orçamento ainda pode ser editado (itens e cabeçalho).
const STATUS_EDITAVEL: StatusOrcamento[] = ['RASCUNHO', 'AGUARDANDO_AUTORIZACAO']

export const ORCAMENTO_INCLUDE = {
  cliente: { select: { id: true, nome: true, telefone: true } },
  veiculo: { select: { id: true, placa: true, marca: true, modelo: true, chassi: true } },
  itens: { orderBy: { id: 'asc' } },
} satisfies Prisma.OrcamentoInclude

function garantirEditavel(status: string) {
  if (!STATUS_EDITAVEL.includes(status as StatusOrcamento)) {
    throw new ApiError(
      'DADOS_INVALIDOS',
      'Orçamento autorizado ou recusado não pode mais ser editado.',
    )
  }
}

/// Soma do orçamento (itens × quantidade). Calculado — nunca armazenado.
export function totalOrcamento(
  itens: { quantidade: number; valorUnitario: number }[],
): number {
  return itens.reduce((s, it) => s + it.quantidade * it.valorUnitario, 0)
}

interface ItemEntrada {
  tipo: 'PECA' | 'MAO_DE_OBRA'
  pecaId?: string
  descricao: string
  quantidade: number
  valorUnitario: number
  // Sprint 3: origem da peça e garantia em dias (opcionais para retrocompatibilidade)
  origemPeca?: 'ESTOQUE' | 'COMPRA_AVULSA'
  garantiaDias?: number
}

/// Resolve descrição/valor de um item: se for peça com `pecaId`, COPIA o preço
/// do dia e o nome quando não foram informados à mão.
async function resolverItem(
  tx: Prisma.TransactionClient,
  input: ItemEntrada,
): Promise<{ tipo: string; pecaId: string | null; descricao: string; quantidade: number; valorUnitario: number; origemPeca: string | null; garantiaDias: number | null }> {
  let { descricao, valorUnitario } = input
  let pecaId: string | null = input.pecaId ?? null

  if (input.tipo === 'PECA' && pecaId) {
    const peca = await tx.peca.findUnique({ where: { id: pecaId } })
    if (!peca) throw new ApiError('NAO_ENCONTRADO', 'Peça informada não existe.')
    if (!valorUnitario || valorUnitario <= 0) valorUnitario = peca.precoDia // cópia do preço do dia
    if (!descricao) descricao = peca.nome
  } else {
    pecaId = null
  }

  return {
    tipo: input.tipo,
    pecaId,
    descricao,
    quantidade: input.quantidade,
    valorUnitario,
    origemPeca: input.origemPeca ?? null,
    garantiaDias: input.garantiaDias ?? null,
  }
}

/// Cria um orçamento (número sequencial gerado dentro da transação) com itens.
export async function criarOrcamento(
  input: {
    clienteId: string
    veiculoId: string
    observacao?: string
    responsavel?: string
    itens: ItemEntrada[]
  },
  usuarioId: string,
) {
  return prisma.$transaction(async (tx) => {
    const veiculo = await tx.veiculo.findUnique({ where: { id: input.veiculoId } })
    if (!veiculo) throw new ApiError('NAO_ENCONTRADO', 'Veículo informado não existe.')
    if (veiculo.clienteId !== input.clienteId) {
      throw new ApiError('DADOS_INVALIDOS', 'O veículo não pertence ao cliente informado.')
    }

    const ano = new Date().getFullYear()
    const totalAno = await tx.orcamento.count({ where: { numero: { startsWith: `ORC-${ano}-` } } })
    const numero = `ORC-${ano}-${String(totalAno + 1).padStart(4, '0')}`

    const itens = []
    for (const it of input.itens) itens.push(await resolverItem(tx, it))

    return tx.orcamento.create({
      data: {
        numero,
        clienteId: input.clienteId,
        veiculoId: input.veiculoId,
        observacao: input.observacao || null,
        responsavel: input.responsavel || null,
        criadoPorId: usuarioId,
        itens: itens.length ? { create: itens } : undefined,
      },
      include: ORCAMENTO_INCLUDE,
    })
  })
}

/// Atualiza o cabeçalho com controle otimista. 409 se a versão estiver velha.
export async function atualizarCabecalho(
  id: string,
  dados: { observacao?: string; responsavel?: string; version: number },
) {
  const atual = await prisma.orcamento.findUnique({ where: { id } })
  if (!atual) throw new ApiError('NAO_ENCONTRADO', 'Orçamento não encontrado.')
  garantirEditavel(atual.status)

  const { version, ...campos } = dados
  const r = await prisma.orcamento.updateMany({
    where: { id, version },
    data: {
      observacao: campos.observacao ?? undefined,
      responsavel: campos.responsavel ?? undefined,
      version: { increment: 1 },
    },
  })
  if (r.count === 0) await conflitoOrcamento(id)
  return prisma.orcamento.findUnique({ where: { id }, include: ORCAMENTO_INCLUDE })
}

/// Adiciona um item a um orçamento editável. NÃO mexe na versão do cabeçalho
/// (2 pessoas adicionando itens diferentes não devem conflitar).
export async function adicionarItem(orcamentoId: string, input: ItemEntrada) {
  const orc = await prisma.orcamento.findUnique({ where: { id: orcamentoId } })
  if (!orc) throw new ApiError('NAO_ENCONTRADO', 'Orçamento não encontrado.')
  garantirEditavel(orc.status)

  const dados = await prisma.$transaction((tx) => resolverItem(tx, input))
  return prisma.itemOrcamento.create({ data: { orcamentoId, ...dados } })
}

/// Edita um item com controle otimista POR ITEM. 409 se a versão estiver velha.
export async function atualizarItem(
  itemId: string,
  dados: { descricao?: string; quantidade?: number; valorUnitario?: number; version: number },
) {
  const item = await prisma.itemOrcamento.findUnique({
    where: { id: itemId },
    include: { orcamento: { select: { status: true } } },
  })
  if (!item) throw new ApiError('NAO_ENCONTRADO', 'Item não encontrado.')
  garantirEditavel(item.orcamento.status)

  const { version, ...campos } = dados
  const r = await prisma.itemOrcamento.updateMany({
    where: { id: itemId, version },
    data: {
      descricao: campos.descricao ?? undefined,
      quantidade: campos.quantidade ?? undefined,
      valorUnitario: campos.valorUnitario ?? undefined,
      version: { increment: 1 },
    },
  })
  if (r.count === 0) {
    const atual = await prisma.itemOrcamento.findUnique({ where: { id: itemId } })
    throw new ApiError(
      'CONFLITO',
      'Este item foi alterado por outra pessoa. Veja o valor salvo e escolha o que manter.',
      atual,
    )
  }
  return prisma.itemOrcamento.findUnique({ where: { id: itemId } })
}

/// Remove um item de um orçamento editável.
export async function removerItem(itemId: string) {
  const item = await prisma.itemOrcamento.findUnique({
    where: { id: itemId },
    include: { orcamento: { select: { status: true } } },
  })
  if (!item) throw new ApiError('NAO_ENCONTRADO', 'Item não encontrado.')
  garantirEditavel(item.orcamento.status)
  await prisma.itemOrcamento.delete({ where: { id: itemId } })
}

/// Enviar / autorizar / recusar — transição de status com controle otimista.
/// Ao AUTORIZAR grava a forma e a data da autorização.
export async function executarAcao(
  id: string,
  dados: { acao: 'ENVIAR' | 'AUTORIZAR' | 'RECUSAR'; formaAutorizacao?: FormaAutorizacao; version: number },
) {
  const atual = await prisma.orcamento.findUnique({ where: { id } })
  if (!atual) throw new ApiError('NAO_ENCONTRADO', 'Orçamento não encontrado.')

  let novoStatus: StatusOrcamento
  const extra: Prisma.OrcamentoUpdateManyMutationInput = {}

  if (dados.acao === 'ENVIAR') {
    if (atual.status !== 'RASCUNHO') {
      throw new ApiError('DADOS_INVALIDOS', 'Só um rascunho pode ser enviado para autorização.')
    }
    novoStatus = 'AGUARDANDO_AUTORIZACAO'
  } else if (dados.acao === 'AUTORIZAR') {
    if (!STATUS_EDITAVEL.includes(atual.status as StatusOrcamento)) {
      throw new ApiError('DADOS_INVALIDOS', 'Este orçamento não pode ser autorizado.')
    }
    if (!dados.formaAutorizacao) {
      throw new ApiError('DADOS_INVALIDOS', 'Informe como o cliente autorizou (presencial, telefone ou WhatsApp).')
    }
    novoStatus = 'AUTORIZADO'
    extra.autorizadoEm = new Date()
    extra.formaAutorizacao = dados.formaAutorizacao
  } else {
    if (!STATUS_EDITAVEL.includes(atual.status as StatusOrcamento)) {
      throw new ApiError('DADOS_INVALIDOS', 'Este orçamento não pode ser recusado.')
    }
    novoStatus = 'RECUSADO'
  }

  const r = await prisma.orcamento.updateMany({
    where: { id, version: dados.version },
    data: { status: novoStatus, ...extra, version: { increment: 1 } },
  })
  if (r.count === 0) await conflitoOrcamento(id)
  return prisma.orcamento.findUnique({ where: { id }, include: ORCAMENTO_INCLUDE })
}

/// Lança 409 com o estado atual do orçamento (para a tela mostrar o conflito).
async function conflitoOrcamento(id: string): Promise<never> {
  const atual = await prisma.orcamento.findUnique({ where: { id }, include: ORCAMENTO_INCLUDE })
  throw new ApiError(
    'CONFLITO',
    'Este orçamento foi alterado por outra pessoa. Recarregue para ver o que mudou — nada do que você digitou foi perdido.',
    atual,
  )
}
