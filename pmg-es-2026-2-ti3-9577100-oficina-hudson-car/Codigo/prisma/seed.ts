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
  await prisma.ordemServico.deleteMany()
  await prisma.itemOrcamento.deleteMany()
  await prisma.orcamento.deleteMany()
  await prisma.mecanico.deleteMany()
  await prisma.veiculo.deleteMany()
  await prisma.cliente.deleteMany()
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

  console.log('› Criando clientes + veículos…')
  const clientesSeed = [
    { nome: 'Marcos Pereira', telefone: '(16) 99911-2233', documento: '123.456.789-01' },
    { nome: 'Ana Beatriz Souza', telefone: '(16) 98822-4455', documento: '234.567.890-12' },
    { nome: 'Rodrigo Nogueira', telefone: '(16) 99733-6677', documento: '345.678.901-23' },
    { nome: 'Juliana Martins', telefone: '(16) 98644-8899', documento: '456.789.012-34' },
    { nome: 'Fernando Lima', telefone: '(16) 99555-1010', documento: '567.890.123-45' },
  ]
  const clientesCriados = []
  for (const c of clientesSeed) {
    clientesCriados.push(await prisma.cliente.create({ data: c }))
  }

  const veiculosSeed: Array<{ idx: number; placa: string; chassi: string; marca: string; modelo: string; ano: number; cor: string }> = [
    { idx: 0, placa: 'FGH-1A23', chassi: '9BWZZZ377VT004251', marca: 'Volkswagen', modelo: 'Gol 1.6', ano: 2018, cor: 'Prata' },
    { idx: 1, placa: 'JKL-2B34', chassi: '93HGD56209Z100882', marca: 'Honda', modelo: 'Civic EXL', ano: 2020, cor: 'Preto' },
    { idx: 2, placa: 'MNP-3C45', chassi: '9BD17164G74112905', marca: 'Fiat', modelo: 'Argo Drive', ano: 2021, cor: 'Vermelho' },
    { idx: 3, placa: 'QRS-4D56', chassi: '8AFAR52U9DJ501774', marca: 'Ford', modelo: 'Ka SE', ano: 2019, cor: 'Branco' },
    { idx: 4, placa: 'TUV-5E67', chassi: '9BGKS48T0PC201336', marca: 'Chevrolet', modelo: 'Onix LT', ano: 2022, cor: 'Cinza' },
    { idx: 0, placa: 'WXY-6F78', chassi: '9BWZZZ377VT109887', marca: 'Volkswagen', modelo: 'Saveiro', ano: 2017, cor: 'Branco' },
  ]
  const veiculosCriados = []
  for (const v of veiculosSeed) {
    const { idx, ...dados } = v
    const dono = clientesCriados[idx]
    if (!dono) continue
    veiculosCriados.push(await prisma.veiculo.create({ data: { ...dados, clienteId: dono.id } }))
  }

  console.log('› Criando mecânicos…')
  await prisma.mecanico.createMany({
    data: [{ nome: 'José Carlos' }, { nome: 'Paulo Henrique' }, { nome: 'Anderson Silva' }],
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

  const pecasPorCodigo: Record<string, { id: string; nome: string; precoDia: number }> = {}
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
    pecasPorCodigo[p.codigo] = { id: peca.id, nome: peca.nome, precoDia: peca.precoDia }
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

  console.log('› Criando 1 orçamento de exemplo…')
  const veiculoGol = veiculosCriados[0]
  const oleo = pecasPorCodigo['OL-5W30-1L']
  const filtro = pecasPorCodigo['FI-OLEO-01']
  if (veiculoGol && oleo && filtro) {
    const ano = new Date().getFullYear()
    await prisma.orcamento.create({
      data: {
        numero: `ORC-${ano}-0001`,
        clienteId: veiculoGol.clienteId,
        veiculoId: veiculoGol.id,
        status: 'AGUARDANDO_AUTORIZACAO',
        responsavel: 'José Carlos',
        criadoPorId: charlles.id,
        itens: {
          create: [
            // Peça entra com o preço do dia COPIADO (regra de ouro nº 3).
            { tipo: 'PECA', pecaId: oleo.id, descricao: `${oleo.nome} (4L)`, quantidade: 4, valorUnitario: oleo.precoDia },
            { tipo: 'PECA', pecaId: filtro.id, descricao: filtro.nome, quantidade: 1, valorUnitario: filtro.precoDia },
            { tipo: 'MAO_DE_OBRA', descricao: 'Mão de obra: troca de óleo e revisão', quantidade: 1, valorUnitario: 120 },
          ],
        },
      },
    })
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
