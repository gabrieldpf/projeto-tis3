// Regras de negócio de ORDEM DE SERVIÇO (camada de serviço, testável).
//
// Regras centrais (Sprint 2):
//  - Só orçamento AUTORIZADO gera OS; cada orçamento gera no máximo uma OS
//    (orcamentoId é único no banco; aqui damos a mensagem amigável).
//  - Mecânico é obrigatório e precisa estar ativo.
//  - Número (OS-AAAA-NNNN) gerado dentro da transação para não repetir.
//  - Troca de status respeita transições válidas; ENTREGUE grava a data.
//  - Controle otimista por `version` (409 em caso de edição concorrente).

import { prisma } from '@/lib/db'
import { ApiError } from '@/lib/http'
import { TRANSICOES_OS, type StatusOS } from '@/lib/constants'
import type { Prisma } from '@prisma/client'

export const OS_INCLUDE = {
  cliente: { select: { id: true, nome: true, telefone: true } },
  veiculo: { select: { id: true, placa: true, marca: true, modelo: true } },
  mecanico: { select: { id: true, nome: true } },
  orcamento: { select: { id: true, numero: true } },
} satisfies Prisma.OrdemServicoInclude

/// Cria a OS a partir de um orçamento AUTORIZADO, com mecânico obrigatório.
export async function criarOS(input: {
  orcamentoId: string
  mecanicoId: string
  previsaoEntrega?: string
}) {
  return prisma.$transaction(async (tx) => {
    const orc = await tx.orcamento.findUnique({ where: { id: input.orcamentoId } })
    if (!orc) throw new ApiError('NAO_ENCONTRADO', 'Orçamento informado não existe.')
    if (orc.status !== 'AUTORIZADO') {
      throw new ApiError('DADOS_INVALIDOS', 'Só é possível gerar OS de um orçamento autorizado.')
    }

    const jaExiste = await tx.ordemServico.findUnique({ where: { orcamentoId: input.orcamentoId } })
    if (jaExiste) {
      throw new ApiError('CONFLITO', 'Este orçamento já gerou uma ordem de serviço.')
    }

    const mecanico = await tx.mecanico.findUnique({ where: { id: input.mecanicoId } })
    if (!mecanico || !mecanico.ativo) {
      throw new ApiError('DADOS_INVALIDOS', 'Selecione um mecânico válido e ativo.')
    }

    const ano = new Date().getFullYear()
    const totalAno = await tx.ordemServico.count({ where: { numero: { startsWith: `OS-${ano}-` } } })
    const numero = `OS-${ano}-${String(totalAno + 1).padStart(4, '0')}`

    return tx.ordemServico.create({
      data: {
        numero,
        orcamentoId: input.orcamentoId,
        clienteId: orc.clienteId,
        veiculoId: orc.veiculoId,
        mecanicoId: input.mecanicoId,
        previsaoEntrega: input.previsaoEntrega ? new Date(input.previsaoEntrega) : null,
      },
      include: OS_INCLUDE,
    })
  })
}

/// Atualiza a OS: troca de status (transição validada), mecânico e/ou previsão.
export async function atualizarOS(
  id: string,
  dados: { status?: StatusOS; mecanicoId?: string; previsaoEntrega?: string; version: number },
) {
  const atual = await prisma.ordemServico.findUnique({ where: { id } })
  if (!atual) throw new ApiError('NAO_ENCONTRADO', 'Ordem de serviço não encontrada.')

  const data: Prisma.OrdemServicoUncheckedUpdateManyInput = {}

  if (dados.status && dados.status !== atual.status) {
    const permitidas = TRANSICOES_OS[atual.status as StatusOS] ?? []
    if (!permitidas.includes(dados.status)) {
      throw new ApiError(
        'DADOS_INVALIDOS',
        `Transição de status inválida (${atual.status} → ${dados.status}).`,
      )
    }
    data.status = dados.status
    if (dados.status === 'ENTREGUE') data.entregueEm = new Date()
  }

  if (dados.mecanicoId && dados.mecanicoId !== atual.mecanicoId) {
    const mecanico = await prisma.mecanico.findUnique({ where: { id: dados.mecanicoId } })
    if (!mecanico || !mecanico.ativo) {
      throw new ApiError('DADOS_INVALIDOS', 'Selecione um mecânico válido e ativo.')
    }
    data.mecanicoId = dados.mecanicoId
  }

  if (dados.previsaoEntrega !== undefined) {
    data.previsaoEntrega = dados.previsaoEntrega ? new Date(dados.previsaoEntrega) : null
  }

  const r = await prisma.ordemServico.updateMany({
    where: { id, version: dados.version },
    data: { ...data, version: { increment: 1 } },
  })
  if (r.count === 0) {
    const estado = await prisma.ordemServico.findUnique({ where: { id }, include: OS_INCLUDE })
    throw new ApiError(
      'CONFLITO',
      'Esta OS foi alterada por outra pessoa. Recarregue para ver o estado atual.',
      estado,
    )
  }
  return prisma.ordemServico.findUnique({ where: { id }, include: OS_INCLUDE })
}
