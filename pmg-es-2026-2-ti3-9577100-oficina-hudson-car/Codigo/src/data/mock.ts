// Dados mockados para o front-end inicial.
// Nenhuma chamada de API — tudo estático, em memória.

import type {
  Cliente,
  Fornecedor,
  ItemEstoque,
  Orcamento,
  OrdemServico,
  Peca,
  RegistroHistorico,
  Usuario,
  Veiculo,
} from '../types'

// --- Usuários (RBAC) ---------------------------------------------------------
// Somente 3 pessoas usam o sistema: Charlles (admin), o irmão e o Vitor.
export const usuarios: Usuario[] = [
  { id: 'u1', nome: 'Charlles Hudson', papel: 'admin', cargo: 'Dono / Administrador' },
  { id: 'u2', nome: 'Ronaldo Hudson', papel: 'operacional', cargo: 'Sócio / Comprador' },
  { id: 'u3', nome: 'Vitor Almeida', papel: 'operacional', cargo: 'Secretário' },
]

// --- Clientes ----------------------------------------------------------------
export const clientes: Cliente[] = [
  { id: 'c1', nome: 'Marcos Pereira', telefone: '(16) 99911-2233', documento: '123.456.789-01', desde: '2025-06-12' },
  { id: 'c2', nome: 'Ana Beatriz Souza', telefone: '(16) 98822-4455', documento: '234.567.890-12', desde: '2025-08-03' },
  { id: 'c3', nome: 'Rodrigo Nogueira', telefone: '(16) 99733-6677', documento: '345.678.901-23', desde: '2025-02-21' },
  { id: 'c4', nome: 'Juliana Martins', telefone: '(16) 98644-8899', documento: '456.789.012-34', desde: '2026-01-09' },
  { id: 'c5', nome: 'Fernando Lima', telefone: '(16) 99555-1010', documento: '567.890.123-45', desde: '2025-11-30' },
]

// --- Veículos ----------------------------------------------------------------
export const veiculos: Veiculo[] = [
  { id: 'v1', clienteId: 'c1', placa: 'FGH-1A23', chassi: '9BWZZZ377VT004251', marca: 'Volkswagen', modelo: 'Gol 1.6', ano: 2018, cor: 'Prata' },
  { id: 'v2', clienteId: 'c2', placa: 'JKL-2B34', chassi: '93HGD56209Z100882', marca: 'Honda', modelo: 'Civic EXL', ano: 2020, cor: 'Preto' },
  { id: 'v3', clienteId: 'c3', placa: 'MNP-3C45', chassi: '9BD17164G74112905', marca: 'Fiat', modelo: 'Argo Drive', ano: 2021, cor: 'Vermelho' },
  { id: 'v4', clienteId: 'c4', placa: 'QRS-4D56', chassi: '8AFAR52U9DJ501774', marca: 'Ford', modelo: 'Ka SE', ano: 2019, cor: 'Branco' },
  { id: 'v5', clienteId: 'c5', placa: 'TUV-5E67', chassi: '9BGKS48T0PC201336', marca: 'Chevrolet', modelo: 'Onix LT', ano: 2022, cor: 'Cinza' },
  { id: 'v6', clienteId: 'c1', placa: 'WXY-6F78', chassi: '9BWZZZ377VT109887', marca: 'Volkswagen', modelo: 'Saveiro', ano: 2017, cor: 'Branco' },
]

// --- Histórico por veículo ---------------------------------------------------
export const historico: RegistroHistorico[] = [
  { id: 'h1', veiculoId: 'v1', data: '2026-08-14', descricao: 'Troca de óleo e filtros; revisão de freios dianteiros.', responsavel: 'José (mecânico)', garantiaAte: '2026-11-14', temFotos: true },
  { id: 'h2', veiculoId: 'v1', data: '2026-03-02', descricao: 'Substituição da correia dentada.', responsavel: 'Paulo (mecânico)', garantiaAte: '2026-09-02', temFotos: true },
  { id: 'h3', veiculoId: 'v2', data: '2026-08-28', descricao: 'Alinhamento, balanceamento e troca de pastilhas.', responsavel: 'José (mecânico)', garantiaAte: '2027-02-28', temFotos: true },
  { id: 'h4', veiculoId: 'v3', data: '2026-07-19', descricao: 'Reparo no sistema de arrefecimento (troca da bomba d’água).', responsavel: 'Paulo (mecânico)', temFotos: false },
  { id: 'h5', veiculoId: 'v5', data: '2026-09-01', descricao: 'Diagnóstico eletrônico e troca de velas.', responsavel: 'José (mecânico)', garantiaAte: '2026-12-01', temFotos: true },
]

// --- Fornecedores ------------------------------------------------------------
export const fornecedores: Fornecedor[] = [
  { id: 'f1', nome: 'Auto Peças São Carlos', categoria: 'Peças gerais', telefone: '(16) 3361-1000' },
  { id: 'f2', nome: 'Distribuidora Central de Óleos', categoria: 'Lubrificantes', telefone: '(16) 3372-2020' },
  { id: 'f3', nome: 'FreioMax Componentes', categoria: 'Freios', telefone: '(16) 3383-3030' },
  { id: 'f4', nome: 'Elétrica Bosch Represent.', categoria: 'Elétrica', telefone: '(16) 3394-4040' },
  { id: 'f5', nome: 'Presilhas & Fixadores Ltda', categoria: 'Fixação', telefone: '(16) 3305-5050' },
]

// --- Peças (preço do dia, atualizado manualmente) ----------------------------
export const pecas: Peca[] = [
  { id: 'p1', codigo: 'OL-5W30-1L', nome: 'Óleo motor 5W30 sintético (1L)', categoria: 'Lubrificantes', subcategoria: 'Óleo motor', fornecedorId: 'f2', precoDia: 42.9, atualizadoEm: '2026-09-08', compativelChassi: ['9BWZZZ377VT004251', '93HGD56209Z100882', '9BD17164G74112905'] },
  { id: 'p2', codigo: 'FR-PAST-D', nome: 'Pastilha de freio dianteira', categoria: 'Freios', subcategoria: 'Pastilhas', fornecedorId: 'f3', precoDia: 138.0, atualizadoEm: '2026-09-07', compativelChassi: ['93HGD56209Z100882', '9BGKS48T0PC201336'] },
  { id: 'p3', codigo: 'FI-OLEO-01', nome: 'Filtro de óleo', categoria: 'Filtros', subcategoria: 'Óleo', fornecedorId: 'f1', precoDia: 28.5, atualizadoEm: '2026-09-08', compativelChassi: ['9BWZZZ377VT004251', '8AFAR52U9DJ501774'] },
  { id: 'p4', codigo: 'CO-DENT-16', nome: 'Correia dentada 1.6', categoria: 'Motor', subcategoria: 'Correias', fornecedorId: 'f1', precoDia: 189.9, atualizadoEm: '2026-09-05', compativelChassi: ['9BWZZZ377VT004251', '9BWZZZ377VT109887'] },
  { id: 'p5', codigo: 'VE-IGN-04', nome: 'Vela de ignição (jogo 4)', categoria: 'Elétrica', subcategoria: 'Ignição', fornecedorId: 'f4', precoDia: 96.0, atualizadoEm: '2026-09-06', compativelChassi: ['9BGKS48T0PC201336', '9BD17164G74112905'] },
  { id: 'p6', codigo: 'PR-CLIP-150', nome: 'Presilha de painel (modelo 150)', categoria: 'Fixação', subcategoria: 'Presilhas', fornecedorId: 'f5', precoDia: 1.9, atualizadoEm: '2026-09-08', compativelChassi: [] },
  { id: 'p7', codigo: 'BW-AGUA-01', nome: 'Bomba d’água', categoria: 'Arrefecimento', subcategoria: 'Bombas', fornecedorId: 'f1', precoDia: 214.0, atualizadoEm: '2026-09-04', compativelChassi: ['9BD17164G74112905'] },
]

// --- Estoque -----------------------------------------------------------------
export const estoque: ItemEstoque[] = [
  { pecaId: 'p1', quantidade: 210, unidade: 'L', minimo: 200 },
  { pecaId: 'p2', quantidade: 6, unidade: 'un', minimo: 8 },
  { pecaId: 'p3', quantidade: 24, unidade: 'un', minimo: 10 },
  { pecaId: 'p4', quantidade: 3, unidade: 'un', minimo: 4 },
  { pecaId: 'p5', quantidade: 12, unidade: 'un', minimo: 6 },
  { pecaId: 'p6', quantidade: 40, unidade: 'un', minimo: 100 },
  { pecaId: 'p7', quantidade: 2, unidade: 'un', minimo: 2 },
]

// --- Orçamentos --------------------------------------------------------------
export const orcamentos: Orcamento[] = [
  {
    id: 'o1', numero: 'ORC-2026-0148', veiculoId: 'v1', clienteId: 'c1', status: 'aguardando_autorizacao',
    criadoEm: '2026-09-08', responsavel: 'José (mecânico)',
    itens: [
      { descricao: 'Óleo motor 5W30 (4L)', tipo: 'peca', quantidade: 4, valorUnitario: 42.9 },
      { descricao: 'Filtro de óleo', tipo: 'peca', quantidade: 1, valorUnitario: 28.5 },
      { descricao: 'Mão de obra — troca de óleo e revisão', tipo: 'mao_de_obra', quantidade: 1, valorUnitario: 120.0 },
    ],
  },
  {
    id: 'o2', numero: 'ORC-2026-0149', veiculoId: 'v2', clienteId: 'c2', status: 'autorizado',
    criadoEm: '2026-09-07', responsavel: 'José (mecânico)', editandoPor: 'Vitor Almeida',
    itens: [
      { descricao: 'Pastilha de freio dianteira', tipo: 'peca', quantidade: 1, valorUnitario: 138.0 },
      { descricao: 'Mão de obra — freios + alinhamento', tipo: 'mao_de_obra', quantidade: 1, valorUnitario: 260.0 },
    ],
  },
  {
    id: 'o3', numero: 'ORC-2026-0150', veiculoId: 'v3', clienteId: 'c3', status: 'rascunho',
    criadoEm: '2026-09-09', responsavel: 'Paulo (mecânico)',
    itens: [
      { descricao: 'Bomba d’água', tipo: 'peca', quantidade: 1, valorUnitario: 214.0 },
      { descricao: 'Mão de obra — arrefecimento', tipo: 'mao_de_obra', quantidade: 1, valorUnitario: 180.0 },
    ],
  },
  {
    id: 'o4', numero: 'ORC-2026-0151', veiculoId: 'v5', clienteId: 'c5', status: 'recusado',
    criadoEm: '2026-09-05', responsavel: 'José (mecânico)',
    itens: [
      { descricao: 'Vela de ignição (jogo 4)', tipo: 'peca', quantidade: 1, valorUnitario: 96.0 },
      { descricao: 'Mão de obra — diagnóstico', tipo: 'mao_de_obra', quantidade: 1, valorUnitario: 90.0 },
    ],
  },
]

// --- Ordens de serviço -------------------------------------------------------
export const ordensServico: OrdemServico[] = [
  { id: 'os1', numero: 'OS-2026-0092', orcamentoId: 'o2', veiculoId: 'v2', clienteId: 'c2', status: 'em_andamento', responsavel: 'José (mecânico)', aberturaEm: '2026-09-08', previsaoEntrega: '2026-09-10' },
  { id: 'os2', numero: 'OS-2026-0091', orcamentoId: 'o1', veiculoId: 'v1', clienteId: 'c1', status: 'aguardando_peca', responsavel: 'Paulo (mecânico)', aberturaEm: '2026-09-07', previsaoEntrega: '2026-09-11' },
  { id: 'os3', numero: 'OS-2026-0090', orcamentoId: 'o3', veiculoId: 'v5', clienteId: 'c5', status: 'pronta', responsavel: 'José (mecânico)', aberturaEm: '2026-09-06', previsaoEntrega: '2026-09-09' },
  { id: 'os4', numero: 'OS-2026-0089', orcamentoId: 'o4', veiculoId: 'v3', clienteId: 'c3', status: 'entregue', responsavel: 'Paulo (mecânico)', aberturaEm: '2026-09-03', previsaoEntrega: '2026-09-05' },
]

// --- Indicadores financeiros (SOMENTE ADMIN — regra de ouro nº 2) ------------
export const financeiro = {
  faturamentoMes: 48250.0,
  faturamentoMesAnterior: 41900.0,
  ticketMedio: 620.0,
  aReceber: 7300.0,
  // série de carros x faturamento por período (relatório restrito ao admin)
  serie: [
    { periodo: 'Mai', carros: 232, faturamento: 39800 },
    { periodo: 'Jun', carros: 248, faturamento: 43100 },
    { periodo: 'Jul', carros: 265, faturamento: 41900 },
    { periodo: 'Ago', carros: 258, faturamento: 45600 },
    { periodo: 'Set', carros: 96, faturamento: 48250 },
  ],
}

// --- Helpers -----------------------------------------------------------------
export function clientePorId(id: string): Cliente | undefined {
  return clientes.find((c) => c.id === id)
}

export function veiculoPorId(id: string): Veiculo | undefined {
  return veiculos.find((v) => v.id === id)
}

export function fornecedorPorId(id: string): Fornecedor | undefined {
  return fornecedores.find((f) => f.id === id)
}

export function pecaPorId(id: string): Peca | undefined {
  return pecas.find((p) => p.id === id)
}

export function totalOrcamento(orc: Orcamento): number {
  return orc.itens.reduce((soma, item) => soma + item.quantidade * item.valorUnitario, 0)
}

export function historicoDoVeiculo(veiculoId: string): RegistroHistorico[] {
  return historico
    .filter((h) => h.veiculoId === veiculoId)
    .sort((a, b) => (a.data < b.data ? 1 : -1))
}
