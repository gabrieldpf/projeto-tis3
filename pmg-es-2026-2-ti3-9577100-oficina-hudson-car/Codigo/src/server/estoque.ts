// Regras de negócio de estoque (camada de serviço, isolada dos route handlers
// para poder ser testada diretamente pelo Vitest).
//
// Regras (do §5 do plano):
//  - Todo movimento de saldo gera uma MovimentacaoEstoque (rastreabilidade).
//  - SAÍDA não pode deixar o saldo negativo (peça instalada sem estoque exige
//    um AJUSTE explícito).
//  - AJUSTE define o saldo diretamente para o valor informado (correção de
//    inventário); ENTRADA soma; SAIDA subtrai.

import { prisma } from '@/lib/db'
import { ApiError } from '@/lib/http'
import type { TipoMovimentacao } from '@/lib/constants'

export interface EntradaMovimentacao {
  pecaId: string
  tipo: TipoMovimentacao
  quantidade: number
  motivo?: string
  usuarioId: string
}

/// Calcula o novo saldo dado o saldo atual, o tipo e a quantidade.
/// Exportada para teste unitário puro (sem banco).
export function calcularNovoSaldo(
  saldoAtual: number,
  tipo: TipoMovimentacao,
  quantidade: number,
): number {
  switch (tipo) {
    case 'ENTRADA':
      return saldoAtual + quantidade
    case 'SAIDA': {
      const novo = saldoAtual - quantidade
      if (novo < 0) {
        throw new ApiError(
          'CONFLITO',
          'Saldo insuficiente para a saída. Use um AJUSTE para corrigir o inventário.',
        )
      }
      return novo
    }
    case 'AJUSTE':
      // AJUSTE define o saldo para o valor informado (não soma/subtrai).
      return quantidade
  }
}

/// Registra a movimentação e atualiza o saldo da peça, atomicamente.
export async function registrarMovimentacao(entrada: EntradaMovimentacao) {
  const { pecaId, tipo, quantidade, motivo, usuarioId } = entrada

  return prisma.$transaction(async (tx) => {
    const peca = await tx.peca.findUnique({ where: { id: pecaId } })
    if (!peca) throw new ApiError('NAO_ENCONTRADO', 'Peça não encontrada.')

    const saldoResultante = calcularNovoSaldo(peca.quantidadeAtual, tipo, quantidade)

    const movimentacao = await tx.movimentacaoEstoque.create({
      data: { pecaId, tipo, quantidade, saldoResultante, motivo, usuarioId },
    })

    const pecaAtualizada = await tx.peca.update({
      where: { id: pecaId },
      data: { quantidadeAtual: saldoResultante, version: { increment: 1 } },
    })

    return { movimentacao, peca: pecaAtualizada }
  })
}

/// Lista peças em alerta de compra: saldo <= estoque mínimo (e mínimo > 0).
export async function listarAlertasCompra() {
  const pecas = await prisma.peca.findMany({
    where: { ativo: true },
    include: { fornecedor: true },
    orderBy: { nome: 'asc' },
  })
  return pecas
    .filter((p) => p.estoqueMinimo > 0 && p.quantidadeAtual <= p.estoqueMinimo)
    .map((p) => ({
      ...p,
      faltam: Math.max(0, p.estoqueMinimo - p.quantidadeAtual),
    }))
}
