// Regras de negócio de ORDEM DE SERVIÇO (camada de serviço, testável).
//
// Regras centrais (Sprint 2):
//  - Só orçamento AUTORIZADO gera OS; cada orçamento gera no máximo uma OS
//    (orcamentoId é único no banco; aqui damos a mensagem amigável).
//  - Mecânico é obrigatório e precisa estar ativo.
//  - Número (OS-AAAA-NNNN) gerado dentro da transação para não repetir.
//  - Troca de status respeita transições válidas; ENTREGUE grava a data.
//  - Controle otimista por `version` (409 em caso de edição concorrente).
//
// Sprint 3:
//  - atualizarOS recebe usuarioId (para auditoria futura).
//  - marcarPronta: PRONTA + baixa automática numa única transação.
//  - entregarOS: ENTREGUE + gera garantias.
//  - resolverPendencia: resolve item que não baixou (COMPRA_AVULSA ou AJUSTE_ESTOQUE).

import { prisma } from '@/lib/db'
import { ApiError } from '@/lib/http'
import { TRANSICOES_OS, type StatusOS } from '@/lib/constants'
import { gerarGarantiasDaOS } from '@/server/garantia'
import type { Prisma } from '@prisma/client'
import type { AlertaCompraApi, BaixaItemApi, PendenciaBaixaApi } from '@/lib/api'

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
/// NÃO trata PRONTA/ENTREGUE — essas são operações dedicadas (marcarPronta/entregarOS).
export async function atualizarOS(
  id: string,
  dados: { status?: StatusOS; mecanicoId?: string; previsaoEntrega?: string; version: number },
  _usuarioId?: string,
) {
  const atual = await prisma.ordemServico.findUnique({ where: { id } })
  if (!atual) throw new ApiError('NAO_ENCONTRADO', 'Ordem de serviço não encontrada.')

  const data: Prisma.OrdemServicoUncheckedUpdateManyInput = {}

  if (dados.status && dados.status !== atual.status) {
    // PRONTA e ENTREGUE têm endpoints dedicados
    if (dados.status === 'PRONTA' || dados.status === 'ENTREGUE') {
      throw new ApiError(
        'DADOS_INVALIDOS',
        `Use o endpoint dedicado para marcar a OS como ${dados.status}.`,
      )
    }
    const permitidas = TRANSICOES_OS[atual.status as StatusOS] ?? []
    if (!permitidas.includes(dados.status)) {
      throw new ApiError(
        'DADOS_INVALIDOS',
        `Transição de status inválida (${atual.status} → ${dados.status}).`,
      )
    }
    data.status = dados.status
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

/// Itens efetivos: do orçamento base (aditivoId IS NULL) + de aditivos AUTORIZADOS.
export async function itensEfetivosDeOS(
  tx: Prisma.TransactionClient,
  ordemServicoId: string,
) {
  const os = await tx.ordemServico.findUnique({
    where: { id: ordemServicoId },
    select: { orcamentoId: true },
  })
  if (!os) return []

  return tx.itemOrcamento.findMany({
    where: {
      orcamentoId: os.orcamentoId,
      OR: [
        { aditivoId: null },
        { aditivo: { status: 'AUTORIZADO' } },
      ],
    },
    include: { peca: true },
  })
}

/// Marca a OS como PRONTA e executa a baixa automática de estoque.
/// Tudo numa única $transaction para garantir atomicidade.
/// Retorna { os, baixados[], pendencias[], alertas[] }.
export async function marcarPronta(
  id: string,
  version: number,
  usuarioId: string,
): Promise<{
  os: Awaited<ReturnType<typeof prisma.ordemServico.findUnique>>
  baixados: BaixaItemApi[]
  pendencias: PendenciaBaixaApi[]
  alertas: AlertaCompraApi[]
}> {
  return prisma.$transaction(async (tx) => {
    const os = await tx.ordemServico.findUnique({ where: { id } })
    if (!os) throw new ApiError('NAO_ENCONTRADO', 'Ordem de serviço não encontrada.')

    const permitidas = TRANSICOES_OS[os.status as StatusOS] ?? []
    if (!permitidas.includes('PRONTA')) {
      throw new ApiError(
        'DADOS_INVALIDOS',
        `Não é possível marcar como PRONTA a partir do status ${os.status}.`,
      )
    }

    // Controle otimista
    const r = await tx.ordemServico.updateMany({
      where: { id, version },
      data: { status: 'PRONTA', version: { increment: 1 } },
    })
    if (r.count === 0) {
      const estado = await tx.ordemServico.findUnique({ where: { id }, include: OS_INCLUDE })
      throw new ApiError(
        'CONFLITO',
        'Esta OS foi alterada por outra pessoa. Recarregue para ver o estado atual.',
        estado,
      )
    }

    // Busca itens efetivos para baixa
    const itens = await itensEfetivosDeOS(tx, id)
    const itensPecaEstoque = itens.filter(
      (it) =>
        it.tipo === 'PECA' &&
        it.origemPeca === 'ESTOQUE' &&
        it.baixaEstoqueEm === null &&
        it.peca !== null,
    )

    const baixados: BaixaItemApi[] = []
    const pendencias: PendenciaBaixaApi[] = []

    for (const item of itensPecaEstoque) {
      const peca = item.peca!
      const novoSaldo = peca.quantidadeAtual - item.quantidade

      if (novoSaldo >= 0) {
        // Saldo suficiente: gera movimentação e atualiza item + peça
        await tx.movimentacaoEstoque.create({
          data: {
            pecaId: peca.id,
            ordemServicoId: id,
            tipo: 'SAIDA',
            quantidade: item.quantidade,
            saldoResultante: novoSaldo,
            motivo: `OS ${os.numero}`,
            usuarioId,
          },
        })

        await tx.peca.update({
          where: { id: peca.id },
          data: { quantidadeAtual: novoSaldo, version: { increment: 1 } },
        })

        await tx.itemOrcamento.update({
          where: { id: item.id },
          data: { baixaEstoqueEm: new Date() },
        })

        baixados.push({
          itemId: item.id,
          pecaId: peca.id,
          pecaNome: peca.nome,
          quantidade: item.quantidade,
          saldoResultante: novoSaldo,
          unidade: peca.unidade,
        })
      } else {
        // Saldo insuficiente: registra pendência sem lançar erro
        const itemAtual = await tx.itemOrcamento.findUnique({ where: { id: item.id } })
        pendencias.push({
          itemId: item.id,
          pecaId: peca.id,
          pecaNome: peca.nome,
          unidade: peca.unidade,
          quantidadeNecessaria: item.quantidade,
          saldoAtual: peca.quantidadeAtual,
          faltam: item.quantidade - peca.quantidadeAtual,
          version: itemAtual?.version ?? item.version,
        })
      }
    }

    // Alertas: peças cujo saldo pós-baixa <= estoqueMinimo
    const alertas: AlertaCompraApi[] = []
    for (const b of baixados) {
      const peca = await tx.peca.findUnique({
        where: { id: b.pecaId },
        include: { fornecedor: { select: { id: true, nome: true } } },
      })
      if (peca && peca.estoqueMinimo > 0 && peca.quantidadeAtual <= peca.estoqueMinimo) {
        alertas.push({
          id: peca.id,
          nome: peca.nome,
          codigo: peca.codigo,
          unidade: peca.unidade,
          quantidadeAtual: peca.quantidadeAtual,
          estoqueMinimo: peca.estoqueMinimo,
          faltam: Math.max(0, peca.estoqueMinimo - peca.quantidadeAtual),
          fornecedor: peca.fornecedor,
        })
      }
    }

    const osAtualizada = await tx.ordemServico.findUnique({ where: { id }, include: OS_INCLUDE })
    return { os: osAtualizada, baixados, pendencias, alertas }
  })
}

/// Marca a OS como ENTREGUE e gera as garantias. Atomicamente.
export async function entregarOS(id: string, version: number) {
  return prisma.$transaction(async (tx) => {
    const os = await tx.ordemServico.findUnique({ where: { id } })
    if (!os) throw new ApiError('NAO_ENCONTRADO', 'Ordem de serviço não encontrada.')

    const permitidas = TRANSICOES_OS[os.status as StatusOS] ?? []
    if (!permitidas.includes('ENTREGUE')) {
      throw new ApiError(
        'DADOS_INVALIDOS',
        `Não é possível entregar a OS a partir do status ${os.status}.`,
      )
    }

    const entregueEm = new Date()

    const r = await tx.ordemServico.updateMany({
      where: { id, version },
      data: { status: 'ENTREGUE', entregueEm, version: { increment: 1 } },
    })
    if (r.count === 0) {
      const estado = await tx.ordemServico.findUnique({ where: { id }, include: OS_INCLUDE })
      throw new ApiError(
        'CONFLITO',
        'Esta OS foi alterada por outra pessoa. Recarregue para ver o estado atual.',
        estado,
      )
    }

    const garantias = await gerarGarantiasDaOS(tx, id, entregueEm)
    const osAtualizada = await tx.ordemServico.findUnique({ where: { id }, include: OS_INCLUDE })

    return { os: osAtualizada, garantias }
  })
}

/// Resolve um item pendente de baixa (saldo insuficiente na transição PRONTA).
/// COMPRA_AVULSA: muda origemPeca, nunca baixa.
/// AJUSTE_ESTOQUE: adiciona saldo (ENTRADA) e, se OS PRONTA, baixa (SAIDA + baixaEstoqueEm).
export async function resolverPendencia(
  osId: string,
  itemId: string,
  dados: { acao: 'COMPRA_AVULSA' | 'AJUSTE_ESTOQUE'; quantidade?: number; version: number },
  usuarioId: string,
) {
  return prisma.$transaction(async (tx) => {
    const os = await tx.ordemServico.findUnique({
      where: { id: osId },
      select: { id: true, numero: true, status: true, orcamentoId: true },
    })
    if (!os) throw new ApiError('NAO_ENCONTRADO', 'Ordem de serviço não encontrada.')

    const item = await tx.itemOrcamento.findUnique({
      where: { id: itemId },
      include: { peca: true },
    })
    if (!item) throw new ApiError('NAO_ENCONTRADO', 'Item não encontrado.')
    if (item.orcamentoId !== os.orcamentoId) {
      throw new ApiError('DADOS_INVALIDOS', 'Item não pertence a esta OS.')
    }
    if (item.tipo !== 'PECA' || !item.pecaId) {
      throw new ApiError('DADOS_INVALIDOS', 'Este item não é uma peça.')
    }

    // Controle otimista por item
    if (item.version !== dados.version) {
      const atual = await tx.itemOrcamento.findUnique({ where: { id: itemId } })
      throw new ApiError(
        'CONFLITO',
        'Este item foi alterado por outra pessoa. Veja o valor salvo e escolha o que manter.',
        atual,
      )
    }

    if (dados.acao === 'COMPRA_AVULSA') {
      const r = await tx.itemOrcamento.updateMany({
        where: { id: itemId, version: dados.version },
        data: { origemPeca: 'COMPRA_AVULSA', version: { increment: 1 } },
      })
      if (r.count === 0) {
        const atual = await tx.itemOrcamento.findUnique({ where: { id: itemId } })
        throw new ApiError('CONFLITO', 'Item alterado por outra pessoa.', atual)
      }
      const itemAtualizado = await tx.itemOrcamento.findUnique({ where: { id: itemId } })
      return { item: itemAtualizado, peca: null, baixado: null }
    }

    // AJUSTE_ESTOQUE
    if (!dados.quantidade || dados.quantidade <= 0) {
      throw new ApiError('DADOS_INVALIDOS', 'Informe a quantidade para o ajuste de estoque.')
    }

    const peca = item.peca!
    const novoSaldo = peca.quantidadeAtual + dados.quantidade

    // Movimentação de ENTRADA
    await tx.movimentacaoEstoque.create({
      data: {
        pecaId: peca.id,
        ordemServicoId: os.id,
        tipo: 'ENTRADA',
        quantidade: dados.quantidade,
        saldoResultante: novoSaldo,
        motivo: `Ajuste p/ OS ${os.numero}`,
        usuarioId,
      },
    })

    await tx.peca.update({
      where: { id: peca.id },
      data: { quantidadeAtual: novoSaldo, version: { increment: 1 } },
    })

    let baixado: BaixaItemApi | null = null
    let itemAtualizado = null

    if (os.status === 'PRONTA' && novoSaldo >= item.quantidade) {
      // Baixa automática pois agora tem saldo
      const saldoAposBaixa = novoSaldo - item.quantidade

      await tx.movimentacaoEstoque.create({
        data: {
          pecaId: peca.id,
          ordemServicoId: os.id,
          tipo: 'SAIDA',
          quantidade: item.quantidade,
          saldoResultante: saldoAposBaixa,
          motivo: `OS ${os.numero}`,
          usuarioId,
        },
      })

      await tx.peca.update({
        where: { id: peca.id },
        data: { quantidadeAtual: saldoAposBaixa, version: { increment: 1 } },
      })

      const r = await tx.itemOrcamento.updateMany({
        where: { id: itemId, version: dados.version },
        data: { baixaEstoqueEm: new Date(), version: { increment: 1 } },
      })
      if (r.count === 0) {
        const atual = await tx.itemOrcamento.findUnique({ where: { id: itemId } })
        throw new ApiError('CONFLITO', 'Item alterado por outra pessoa.', atual)
      }

      itemAtualizado = await tx.itemOrcamento.findUnique({ where: { id: itemId } })

      baixado = {
        itemId: item.id,
        pecaId: peca.id,
        pecaNome: peca.nome,
        quantidade: item.quantidade,
        saldoResultante: saldoAposBaixa,
        unidade: peca.unidade,
      }
    } else {
      // Só incrementa versão do item
      const r = await tx.itemOrcamento.updateMany({
        where: { id: itemId, version: dados.version },
        data: { version: { increment: 1 } },
      })
      if (r.count === 0) {
        const atual = await tx.itemOrcamento.findUnique({ where: { id: itemId } })
        throw new ApiError('CONFLITO', 'Item alterado por outra pessoa.', atual)
      }
      itemAtualizado = await tx.itemOrcamento.findUnique({ where: { id: itemId } })
    }

    const pecaAtualizada = await tx.peca.findUnique({
      where: { id: peca.id },
      include: { fornecedor: true, chassisCompativeis: true },
    })

    return { item: itemAtualizado, peca: pecaAtualizada, baixado }
  })
}
