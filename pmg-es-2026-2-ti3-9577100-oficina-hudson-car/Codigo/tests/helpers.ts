// Utilitários compartilhados pelos testes de integração (banco Postgres de teste).
import { prisma } from '@/lib/db'

/// Limpa todas as tabelas de domínio em ordem segura de FK.
export async function limparTudo() {
  await prisma.ordemServico.deleteMany()
  await prisma.itemOrcamento.deleteMany()
  await prisma.orcamento.deleteMany()
  await prisma.movimentacaoEstoque.deleteMany()
  await prisma.chassiCompativel.deleteMany()
  await prisma.peca.deleteMany()
  await prisma.mecanico.deleteMany()
  await prisma.veiculo.deleteMany()
  await prisma.cliente.deleteMany()
  await prisma.usuario.deleteMany()
}

export function criarUsuario() {
  return prisma.usuario.create({
    data: { nome: 'Admin', email: 'admin@test.local', senhaHash: 'x', papel: 'ADMIN', cargo: 'x' },
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

export function criarPeca(over: Partial<{ nome: string; precoDia: number; codigo: string }> = {}) {
  return prisma.peca.create({
    data: {
      nome: over.nome ?? 'Óleo 5W30',
      codigo: over.codigo,
      categoria: 'Lubrificantes',
      unidade: 'L',
      precoDia: over.precoDia ?? 42.9,
    },
  })
}
