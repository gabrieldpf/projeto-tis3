// Tipos de domínio do sistema da oficina Hudson Car.
// Nomes em português seguindo a convenção do projeto.

export type Papel = 'admin' | 'operacional'

export interface Usuario {
  id: string
  nome: string
  papel: Papel
  cargo: string
}

export interface Cliente {
  id: string
  nome: string
  telefone: string
  documento: string // CPF
  desde: string // data ISO do 1º atendimento
}

export interface Veiculo {
  id: string
  clienteId: string
  placa: string
  chassi: string
  marca: string
  modelo: string
  ano: number
  cor: string
}

export interface RegistroHistorico {
  id: string
  veiculoId: string
  data: string
  descricao: string
  responsavel: string // mecânico principal
  garantiaAte?: string
  temFotos: boolean
}

export interface Fornecedor {
  id: string
  nome: string
  categoria: string
  telefone: string
}

export interface Peca {
  id: string
  codigo: string
  nome: string
  categoria: string
  subcategoria: string
  fornecedorId: string
  // "preço do dia" — atualizado manualmente pelo admin, nunca fixo
  precoDia: number
  atualizadoEm: string
  compativelChassi: string[] // chassis compatíveis para busca
}

export interface ItemEstoque {
  pecaId: string
  quantidade: number
  unidade: string // ex.: un, L
  minimo: number // gatilho de alerta de compra
}

export type StatusOrcamento =
  | 'rascunho'
  | 'aguardando_autorizacao'
  | 'autorizado'
  | 'recusado'

export type StatusOS =
  | 'aberta'
  | 'em_andamento'
  | 'aguardando_peca'
  | 'pronta'
  | 'entregue'

export interface ItemOrcamento {
  descricao: string
  tipo: 'peca' | 'mao_de_obra'
  quantidade: number
  valorUnitario: number
}

export interface Orcamento {
  id: string
  numero: string
  veiculoId: string
  clienteId: string
  status: StatusOrcamento
  itens: ItemOrcamento[]
  criadoEm: string
  responsavel: string
  // trava de edição simultânea (regra de ouro nº 4)
  editandoPor?: string
}

export interface OrdemServico {
  id: string
  numero: string
  orcamentoId: string
  veiculoId: string
  clienteId: string
  status: StatusOS
  responsavel: string // mecânico principal
  aberturaEm: string
  previsaoEntrega: string
}
