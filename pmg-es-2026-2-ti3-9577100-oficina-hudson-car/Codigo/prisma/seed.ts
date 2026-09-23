// Seed do banco (Sprint 1). Popula usuários dos 3 papéis, fornecedores, peças
// (com chassis compatíveis) e estoque inicial. Baseado nos dados fictícios do
// protótipo anterior (src/data/mock.ts).
//
// Rodar: npm run db:seed   (ou npm run setup, que migra e semeia)
//
// Credenciais criadas (protótipo — senha única para facilitar a demo):
//   charlles@hudsoncar.local  (ADMIN)       senha: oficina123
//   ronaldo@hudsoncar.local   (GESTOR)      senha: oficina123
//   vitor@hudsoncar.local     (OPERACIONAL) senha: oficina123

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const SENHA_PADRAO = 'oficina123'

async function main() {
  console.log('› Limpando dados existentes…')
  await prisma.movimentacaoEstoque.deleteMany()
  await prisma.chassiCompativel.deleteMany()
  await prisma.peca.deleteMany()
  await prisma.fornecedor.deleteMany()
  await prisma.usuario.deleteMany()

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10)

  console.log('› Criando usuários (3 papéis)…')
  const charlles = await prisma.usuario.create({
    data: { nome: 'Charlles Hudson', email: 'charlles@hudsoncar.local', senhaHash, papel: 'ADMIN', cargo: 'Dono / Administrador' },
  })
  await prisma.usuario.create({
    data: { nome: 'Ronaldo Hudson', email: 'ronaldo@hudsoncar.local', senhaHash, papel: 'GESTOR', cargo: 'Sócio / Comprador' },
  })
  await prisma.usuario.create({
    data: { nome: 'Vitor Almeida', email: 'vitor@hudsoncar.local', senhaHash, papel: 'OPERACIONAL', cargo: 'Secretário' },
  })

  console.log('› Criando fornecedores…')
  const f = {
    f1: await prisma.fornecedor.create({ data: { nome: 'Auto Peças São Carlos', categoria: 'Peças gerais', telefone: '(16) 3361-1000' } }),
    f2: await prisma.fornecedor.create({ data: { nome: 'Distribuidora Central de Óleos', categoria: 'Lubrificantes', telefone: '(16) 3372-2020' } }),
    f3: await prisma.fornecedor.create({ data: { nome: 'FreioMax Componentes', categoria: 'Freios', telefone: '(16) 3383-3030' } }),
    f4: await prisma.fornecedor.create({ data: { nome: 'Elétrica Bosch Represent.', categoria: 'Elétrica', telefone: '(16) 3394-4040' } }),
    f5: await prisma.fornecedor.create({ data: { nome: 'Presilhas & Fixadores Ltda', categoria: 'Fixação', telefone: '(16) 3305-5050' } }),
  }

  console.log('› Criando peças + chassis + estoque…')
  const pecas: Array<{
    codigo: string; nome: string; categoria: string; subcategoria: string; unidade: string
    fornecedorId: string; precoDia: number; quantidade: number; minimo: number; chassis: string[]
  }> = [
    { codigo: 'OL-5W30-1L', nome: 'Óleo motor 5W30 sintético (1L)', categoria: 'Lubrificantes', subcategoria: 'Óleo motor', unidade: 'L', fornecedorId: f.f2.id, precoDia: 42.9, quantidade: 210, minimo: 200, chassis: ['9BWZZZ377VT004251', '93HGD56209Z100882', '9BD17164G74112905'] },
    { codigo: 'FR-PAST-D', nome: 'Pastilha de freio dianteira', categoria: 'Freios', subcategoria: 'Pastilhas', unidade: 'JOGO', fornecedorId: f.f3.id, precoDia: 138.0, quantidade: 6, minimo: 8, chassis: ['93HGD56209Z100882', '9BGKS48T0PC201336'] },
    { codigo: 'FI-OLEO-01', nome: 'Filtro de óleo', categoria: 'Filtros', subcategoria: 'Óleo', unidade: 'UN', fornecedorId: f.f1.id, precoDia: 28.5, quantidade: 24, minimo: 10, chassis: ['9BWZZZ377VT004251', '8AFAR52U9DJ501774'] },
    { codigo: 'CO-DENT-16', nome: 'Correia dentada 1.6', categoria: 'Motor', subcategoria: 'Correias', unidade: 'UN', fornecedorId: f.f1.id, precoDia: 189.9, quantidade: 3, minimo: 4, chassis: ['9BWZZZ377VT004251', '9BWZZZ377VT109887'] },
    { codigo: 'VE-IGN-04', nome: 'Vela de ignição (jogo 4)', categoria: 'Elétrica', subcategoria: 'Ignição', unidade: 'JOGO', fornecedorId: f.f4.id, precoDia: 96.0, quantidade: 12, minimo: 6, chassis: ['9BGKS48T0PC201336', '9BD17164G74112905'] },
    { codigo: 'PR-CLIP-150', nome: 'Presilha de painel (modelo 150)', categoria: 'Fixação', subcategoria: 'Presilhas', unidade: 'UN', fornecedorId: f.f5.id, precoDia: 1.9, quantidade: 40, minimo: 100, chassis: [] },
    { codigo: 'BW-AGUA-01', nome: "Bomba d'água", categoria: 'Arrefecimento', subcategoria: 'Bombas', unidade: 'UN', fornecedorId: f.f1.id, precoDia: 214.0, quantidade: 2, minimo: 2, chassis: ['9BD17164G74112905'] },
  ]

  for (const p of pecas) {
    const peca = await prisma.peca.create({
      data: {
        codigo: p.codigo,
        nome: p.nome,
        categoria: p.categoria,
        subcategoria: p.subcategoria,
        unidade: p.unidade,
        fornecedorId: p.fornecedorId,
        precoDia: p.precoDia,
        precoDiaAtualizadoPorId: charlles.id,
        estoqueMinimo: p.minimo,
        quantidadeAtual: p.quantidade,
        chassisCompativeis: {
          create: p.chassis.map((chassi) => ({ chassi })),
        },
      },
    })
    // Movimentação de ENTRADA inicial (rastreabilidade do saldo inicial).
    if (p.quantidade > 0) {
      await prisma.movimentacaoEstoque.create({
        data: {
          pecaId: peca.id,
          tipo: 'ENTRADA',
          quantidade: p.quantidade,
          saldoResultante: p.quantidade,
          motivo: 'Saldo inicial (seed)',
          usuarioId: charlles.id,
        },
      })
    }
  }

  console.log('✓ Seed concluído.')
  console.log(`  Usuários: charlles@ / ronaldo@ / vitor@ hudsoncar.local — senha: ${SENHA_PADRAO}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
