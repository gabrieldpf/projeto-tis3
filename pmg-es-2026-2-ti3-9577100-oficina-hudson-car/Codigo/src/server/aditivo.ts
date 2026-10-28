// Regras de negócio de ADITIVO (camada de serviço, espelho de orcamento.ts).
//
// Regras (Sprint 3):
//  - Aditivo só pode ser criado enquanto a OS NÃO está PRONTA ou ENTREGUE.
//  - Número sequencial por orçamento (@@unique orcamentoId+numero).
//  - Status: RASCUNHO → AGUARDANDO_AUTORIZACAO → AUTORIZADO|RECUSADO.
//  - AUTORIZADO/RECUSADO são imutáveis.
//  - Itens de aditivo seguem o mesmo padrão de resolução de preço dos itens
//    de orçamento (copia precoDia no momento da inserção — regra de ouro nº 3).
//  - Controle otimista por `version` em cabeçalho e por item.

import { prisma } from '@/lib/db'
import { ApiError } from '@/lib/http'
import type { FormaAutorizacao, StatusAditivo } from '@/lib/constants'
import type { Prisma } from '@prisma/client'

// Status editáveis (cabeçalho e itens).
const STATUS_EDITAVEL: StatusAditivo[] = ['RASCUNHO', 'AGUARDANDO_AUTORIZACAO']

export const ADITIVO_INCLUDE = {
  itens: { orderBy: { id: 'asc' } },
  orcamento: {
    select: {
      id: true,
      numero: true,
      ordemServico: { select: { id: true, numero: true } },
    },
  },
} satisfies Prisma.AditivoOrcamentoInclude

function garantirEditavel(status: string) {
  if (!STATUS_EDITAVEL.includes(status as StatusAditivo)) {
    throw new ApiError(
      'DADOS_INVALIDOS',
      'Aditivo autorizado ou recusado não pode mais ser editado.',
    )
  }
}

/// Resolve item do aditivo: copia precoDia para itens tipo PECA.
async function resolverItemAditivo(
  tx: Prisma.TransactionClient,
  input: {
    tipo: 'PECA' | 'MAO_DE_OBRA'
    pecaId?: string
    descricao: string
    quantidade: number
    valorUnitario: number
    origemPeca?: 'ESTOQUE' | 'COMPRA_AVULSA'
    garantiaDias?: number
  },
) {
  let { descricao, valorUnitario } = input
  let pecaId: string | null = input.pecaId ?? null

  if (input.tipo === 'PECA' && pecaId) {
    const peca = await tx.peca.findUnique({ where: { id: pecaId } })
    if (!peca) throw new ApiError('NAO_ENCONTRADO', 'Peça informada não existe.')
    if (!valorUnitario || valorUnitario <= 0) valorUnitario = peca.precoDia
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

/// Cria um aditivo em RASCUNHO para um orçamento que já tem OS ativa (não PRONTA/ENTREGUE).
export async function criarAditivo(
  input: { orcamentoId: string; observacao?: string },
  usuarioId: string,
) {
  return prisma.$transaction(async (tx) => {
    const orc = await tx.orcamento.findUnique({
      where: { id: input.orcamentoId },
      include: { ordemServico: { select: { id: true, status: true } } },
    })
    if (!orc) throw new ApiError('NAO_ENCONTRADO', 'Orçamento não encontrado.')
    if (!orc.ordemServico) {
      throw new ApiError('DADOS_INVALIDOS', 'Só é possível criar aditivo em um orçamento com OS em andamento.')
    }
    if (['PRONTA', 'ENTREGUE'].includes(orc.ordemServico.status)) {
      throw new ApiError('DADOS_INVALIDOS', 'Não é possível criar aditivo para uma OS já pronta ou entregue.')
    }

    // Número sequencial por orçamento
    const totalAditivos = await tx.aditivoOrcamento.count({
      where: { orcamentoId: input.orcamentoId },
    })
    const numero = totalAditivos + 1

    return tx.aditivoOrcamento.create({
      data: {
        orcamentoId: input.orcamentoId,
        numero,
        observacao: input.observacao ?? null,
        criadoPorId: usuarioId,
      },
      include: ADITIVO_INCLUDE,
    })
  })
}

/// Atualiza o cabeçalho do aditivo com controle otimista.
export async function atualizarCabecalhoAditivo(
  id: string,
  dados: { observacao?: string; version: number },
) {
  const atual = await prisma.aditivoOrcamento.findUnique({ where: { id } })
  if (!atual) throw new ApiError('NAO_ENCONTRADO', 'Aditivo não encontrado.')
  garantirEditavel(atual.status)

  const { version, ...campos } = dados
  const r = await prisma.aditivoOrcamento.updateMany({
    where: { id, version },
    data: {
      observacao: campos.observacao ?? undefined,
      version: { increment: 1 },
    },
  })
  if (r.count === 0) await conflitoAditivo(id)
  return prisma.aditivoOrcamento.findUnique({ where: { id }, include: ADITIVO_INCLUDE })
}

/// Adiciona um item ao aditivo.
export async function adicionarItemAditivo(
  aditivoId: string,
  input: {
    tipo: 'PECA' | 'MAO_DE_OBRA'
    pecaId?: string
    descricao: string
    quantidade: number
    valorUnitario: number
    origemPeca?: 'ESTOQUE' | 'COMPRA_AVULSA'
    garantiaDias?: number
  },
) {
  const aditivo = await prisma.aditivoOrcamento.findUnique({ where: { id: aditivoId } })
  if (!aditivo) throw new ApiError('NAO_ENCONTRADO', 'Aditivo não encontrado.')
  garantirEditavel(aditivo.status)

  const dados = await prisma.$transaction((tx) => resolverItemAditivo(tx, input))
  return prisma.itemOrcamento.create({
    data: {
      orcamentoId: aditivo.orcamentoId,
      aditivoId,
      ...dados,
    },
  })
}

/// Edita um item do aditivo com controle otimista por item.
export async function atualizarItemAditivo(
  itemId: string,
  dados: {
    descricao?: string
    quantidade?: number
    valorUnitario?: number
    origemPeca?: 'ESTOQUE' | 'COMPRA_AVULSA'
    garantiaDias?: number | null
    version: number
  },
) {
  const item = await prisma.itemOrcamento.findUnique({
    where: { id: itemId },
    include: { aditivo: { select: { status: true } } },
  })
  if (!item || !item.aditivoId) throw new ApiError('NAO_ENCONTRADO', 'Item de aditivo não encontrado.')
  garantirEditavel(item.aditivo!.status)

  const { version, ...campos } = dados
  const r = await prisma.itemOrcamento.updateMany({
    where: { id: itemId, version },
    data: {
      descricao: campos.descricao ?? undefined,
      quantidade: campos.quantidade ?? undefined,
      valorUnitario: campos.valorUnitario ?? undefined,
      origemPeca: campos.origemPeca ?? undefined,
      garantiaDias: campos.garantiaDias !== undefined ? campos.garantiaDias : undefined,
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

/// Remove um item de um aditivo editável.
export async function removerItemAditivo(itemId: string) {
  const item = await prisma.itemOrcamento.findUnique({
    where: { id: itemId },
    include: { aditivo: { select: { status: true } } },
  })
  if (!item || !item.aditivoId) throw new ApiError('NAO_ENCONTRADO', 'Item de aditivo não encontrado.')
  garantirEditavel(item.aditivo!.status)
  await prisma.itemOrcamento.delete({ where: { id: itemId } })
}

/// Executa ação de status (ENVIAR/AUTORIZAR/RECUSAR) com controle otimista.
export async function executarAcaoAditivo(
  id: string,
  dados: {
    acao: 'ENVIAR' | 'AUTORIZAR' | 'RECUSAR'
    formaAutorizacao?: FormaAutorizacao
    version: number
  },
  usuarioId: string,
) {
  const atual = await prisma.aditivoOrcamento.findUnique({ where: { id } })
  if (!atual) throw new ApiError('NAO_ENCONTRADO', 'Aditivo não encontrado.')

  // AUTORIZADO/RECUSADO são imutáveis
  if (['AUTORIZADO', 'RECUSADO'].includes(atual.status)) {
    throw new ApiError('DADOS_INVALIDOS', 'Aditivo já finalizado não pode mais ser alterado.')
  }

  let novoStatus: StatusAditivo
  const extra: Prisma.AditivoOrcamentoUncheckedUpdateManyInput = {}

  if (dados.acao === 'ENVIAR') {
    if (atual.status !== 'RASCUNHO') {
      throw new ApiError('DADOS_INVALIDOS', 'Só um rascunho pode ser enviado para autorização.')
    }
    novoStatus = 'AGUARDANDO_AUTORIZACAO'
  } else if (dados.acao === 'AUTORIZAR') {
    if (!STATUS_EDITAVEL.includes(atual.status as StatusAditivo)) {
      throw new ApiError('DADOS_INVALIDOS', 'Este aditivo não pode ser autorizado.')
    }
    if (!dados.formaAutorizacao) {
      throw new ApiError('DADOS_INVALIDOS', 'Informe como o cliente autorizou (presencial, telefone ou WhatsApp).')
    }
    novoStatus = 'AUTORIZADO'
    extra.autorizadoEm = new Date()
    extra.formaAutorizacao = dados.formaAutorizacao
    extra.registradoPorId = usuarioId
  } else {
    if (!STATUS_EDITAVEL.includes(atual.status as StatusAditivo)) {
      throw new ApiError('DADOS_INVALIDOS', 'Este aditivo não pode ser recusado.')
    }
    novoStatus = 'RECUSADO'
    extra.registradoPorId = usuarioId
  }

  const r = await prisma.aditivoOrcamento.updateMany({
    where: { id, version: dados.version },
    data: { status: novoStatus, ...extra, version: { increment: 1 } },
  })
  if (r.count === 0) await conflitoAditivo(id)
  return prisma.aditivoOrcamento.findUnique({ where: { id }, include: ADITIVO_INCLUDE })
}

/// Lança 409 com estado atual do aditivo.
async function conflitoAditivo(id: string): Promise<never> {
  const atual = await prisma.aditivoOrcamento.findUnique({ where: { id }, include: ADITIVO_INCLUDE })
  throw new ApiError(
    'CONFLITO',
    'Este aditivo foi alterado por outra pessoa. Recarregue para ver o que mudou — nada do que você digitou foi perdido.',
    atual,
  )
}
