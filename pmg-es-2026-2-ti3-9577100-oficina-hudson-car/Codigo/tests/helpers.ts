// Utilitários compartilhados pelos testes de integração (banco Postgres de teste).
import { prisma } from '@/lib/db'
import { criarOrcamento, executarAcao } from '@/server/orcamento'
import { criarOS } from '@/server/os'

/// Limpa todas as tabelas de domínio em ordem segura de FK.
/// Ordem: registros dependentes primeiro, entidades raiz por último.
export async function limparTudo() {
  // Dependentes de GarantiaServico e PresencaEdicao primeiro
  await prisma.garantiaServico.deleteMany()
  await prisma.presencaEdicao.deleteMany()
  // Movimentacoes antes de OS (FK ordemServicoId)
  await prisma.movimentacaoEstoque.deleteMany()
  // OS antes de OrçamentoItens/Aditivo (FK orcamentoId)
  await prisma.ordemServico.deleteMany()
  // Itens antes de Aditivo e Orçamento (FK dupla)
  await prisma.itemOrcamento.deleteMany()
  // Aditivo antes de Orçamento
  await prisma.aditivoOrcamento.deleteMany()
  await prisma.orcamento.deleteMany()
  await prisma.chassiCompativel.deleteMany()
  await prisma.peca.deleteMany()
  await prisma.mecanico.deleteMany()
  await prisma.veiculo.deleteMany()
  await prisma.cliente.deleteMany()
  await prisma.usuario.deleteMany()
}

export function criarUsuario(over: Partial<{ nome: string; email: string; papel: string }> = {}) {
  return prisma.usuario.create({
    data: {
      nome: over.nome ?? 'Admin',
      email: over.email ?? 'admin@test.local',
      senhaHash: 'x',
      papel: over.papel ?? 'ADMIN',
      cargo: 'x',
    },
  })
}

export function criarCliente(nome = 'Cliente Teste') {
  return prisma.cliente.create({ data: { nome } })
}

export function criarVeiculo(
  clienteId: string,
  over: Partial<{ placa: string; chassi: string; marca: string; modelo: string }> = {},
) {
  return prisma.veiculo.create({
    data: {
      clienteId,
      placa: over.placa ?? 'ABC-1234',
      chassi: over.chassi ?? '9BWZZZ377VT004251',
      marca: over.marca ?? 'VW',
      modelo: over.modelo ?? 'Gol',
    },
  })
}

export function criarMecanico(nome = 'José') {
  return prisma.mecanico.create({ data: { nome } })
}

export function criarPeca(over: Partial<{ nome: string; precoDia: number; codigo: string; quantidadeAtual: number; estoqueMinimo: number }> = {}) {
  return prisma.peca.create({
    data: {
      nome: over.nome ?? 'Óleo 5W30',
      codigo: over.codigo,
      categoria: 'Lubrificantes',
      unidade: 'L',
      precoDia: over.precoDia ?? 42.9,
      quantidadeAtual: over.quantidadeAtual ?? 0,
      estoqueMinimo: over.estoqueMinimo ?? 0,
    },
  })
}

/// Cria uma peça já com saldo em estoque (via MovimentacaoEstoque) e com
/// a quantidade refletida em quantidadeAtual.
export async function criarPecaComSaldo(
  usuarioId: string,
  over: Partial<{ nome: string; precoDia: number; quantidadeAtual: number; estoqueMinimo: number }> = {},
) {
  const qtd = over.quantidadeAtual ?? 10
  const peca = await prisma.peca.create({
    data: {
      nome: over.nome ?? 'Filtro de Óleo',
      categoria: 'Filtros',
      unidade: 'UN',
      precoDia: over.precoDia ?? 25.0,
      quantidadeAtual: qtd,
      estoqueMinimo: over.estoqueMinimo ?? 0,
    },
  })
  // Registra a entrada inicial para manter o histórico consistente
  await prisma.movimentacaoEstoque.create({
    data: {
      pecaId: peca.id,
      tipo: 'ENTRADA',
      quantidade: qtd,
      saldoResultante: qtd,
      motivo: 'Estoque inicial (teste)',
      usuarioId,
    },
  })
  return peca
}

/// Cria orçamento, autoriza e gera a OS em sequência.
/// Retorna { orc, os } prontos para usar nos testes.
export async function criarOrcamentoAutorizadoComOS(
  usuarioId: string,
  clienteId: string,
  veiculoId: string,
  mecanicoId: string,
  itens: {
    tipo: 'PECA' | 'MAO_DE_OBRA'
    pecaId?: string
    descricao: string
    quantidade: number
    valorUnitario: number
    origemPeca?: 'ESTOQUE' | 'COMPRA_AVULSA'
    garantiaDias?: number
  }[] = [],
) {
  const orc = await criarOrcamento({ clienteId, veiculoId, itens }, usuarioId)
  await executarAcao(orc.id, { acao: 'AUTORIZAR', formaAutorizacao: 'PRESENCIAL', version: orc.version })
  const os = await criarOS({ orcamentoId: orc.id, mecanicoId })
  return { orc, os }
}
