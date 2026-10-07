// Cliente fetch tipado para a API interna do Hudson Car.
// Usado exclusivamente por componentes client-side (Client Components).
// Todas as rotas exigem sessão — o cookie httpOnly é enviado automaticamente.
//
// Convenção de erros: a API retorna { code, message, detalhes? } com status 4xx/5xx.
// ApiClientError carrega essas informações para a UI tratar/exibir.

export class ApiClientError extends Error {
  code: string
  status: number
  detalhes?: unknown

  constructor(status: number, code: string, message: string, detalhes?: unknown) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = code
    this.detalhes = detalhes
  }
}

async function executar<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init })

  if (!res.ok) {
    let codigo = 'ERRO_DESCONHECIDO'
    let mensagem = `Erro HTTP ${res.status}`
    let detalhes: unknown

    try {
      const corpo = (await res.json()) as { code?: string; message?: string; detalhes?: unknown }
      codigo = corpo.code ?? codigo
      mensagem = corpo.message ?? mensagem
      detalhes = corpo.detalhes
    } catch {
      // Ignora JSON malformado; usa defaults acima.
    }

    throw new ApiClientError(res.status, codigo, mensagem, detalhes)
  }

  return res.json() as Promise<T>
}

// Tipos de resposta da API --------------------------------------------------------

export interface FornecedorApi {
  id: string
  nome: string
  documento: string | null
  telefone: string | null
  email: string | null
  categoria: string | null
  observacao: string | null
  ativo: boolean
  version: number
  createdAt: string
  updatedAt: string
}

export interface ChassisCompativel {
  id: string
  pecaId: string
  chassi: string
  modeloVeiculo: string | null
}

export interface PecaApi {
  id: string
  nome: string
  codigo: string | null
  categoria: string
  subcategoria: string | null
  unidade: string
  fornecedorId: string | null
  fornecedor: FornecedorApi | null
  precoDia: number
  precoDiaAtualizadoEm: string | null
  precoDiaAtualizadoPorId: string | null
  quantidadeAtual: number
  estoqueMinimo: number
  ativo: boolean
  version: number
  createdAt: string
  updatedAt: string
  chassisCompativeis?: ChassisCompativel[]
}

export interface ItemEstoqueApi {
  id: string
  nome: string
  codigo: string | null
  categoria: string
  subcategoria: string | null
  unidade: string
  quantidadeAtual: number
  estoqueMinimo: number
  fornecedor: { id: string; nome: string } | null
  emAlerta: boolean
}

export interface AlertaCompraApi {
  id: string
  nome: string
  codigo: string | null
  unidade: string
  quantidadeAtual: number
  estoqueMinimo: number
  faltam: number
  fornecedor: { id: string; nome: string } | null
}

export interface MovimentacaoApi {
  id: string
  pecaId: string
  tipo: 'ENTRADA' | 'SAIDA' | 'AJUSTE'
  quantidade: number
  saldoResultante: number
  motivo: string | null
  usuarioId: string
  createdAt: string
}

export interface ClienteApi {
  id: string
  nome: string
  telefone: string | null
  documento: string | null
  email: string | null
  observacao: string | null
  desde: string
  ativo: boolean
  version: number
  createdAt: string
  updatedAt: string
  _count?: { veiculos: number }
}

export interface VeiculoApi {
  id: string
  clienteId: string
  placa: string | null
  chassi: string | null
  marca: string | null
  modelo: string | null
  ano: number | null
  cor: string | null
  ativo: boolean
  version: number
  createdAt: string
  updatedAt: string
  cliente?: { id: string; nome: string; telefone: string | null }
}

export interface MecanicoApi {
  id: string
  nome: string
  ativo: boolean
  version: number
  createdAt: string
  updatedAt: string
}

export type StatusOrcamentoApi =
  | 'RASCUNHO'
  | 'AGUARDANDO_AUTORIZACAO'
  | 'AUTORIZADO'
  | 'RECUSADO'

export type StatusOSApi =
  | 'ABERTA'
  | 'EM_ANDAMENTO'
  | 'AGUARDANDO_PECA'
  | 'PRONTA'
  | 'ENTREGUE'

export interface ItemOrcamentoApi {
  id: string
  orcamentoId: string
  tipo: 'PECA' | 'MAO_DE_OBRA'
  pecaId: string | null
  descricao: string
  quantidade: number
  valorUnitario: number
  version: number
}

export interface OrcamentoApi {
  id: string
  numero: string
  clienteId: string
  veiculoId: string
  status: StatusOrcamentoApi
  observacao: string | null
  responsavel: string | null
  criadoPorId: string | null
  autorizadoEm: string | null
  formaAutorizacao: 'PRESENCIAL' | 'TELEFONE' | 'WHATSAPP' | null
  version: number
  createdAt: string
  updatedAt: string
  itens: ItemOrcamentoApi[]
  cliente?: { id: string; nome: string; telefone: string | null }
  veiculo?: { id: string; placa: string | null; marca: string | null; modelo: string | null; chassi: string | null }
}

export interface OrdemServicoApi {
  id: string
  numero: string
  orcamentoId: string
  clienteId: string
  veiculoId: string
  mecanicoId: string
  status: StatusOSApi
  aberturaEm: string
  previsaoEntrega: string | null
  entregueEm: string | null
  version: number
  createdAt: string
  updatedAt: string
  cliente?: { id: string; nome: string; telefone: string | null }
  veiculo?: { id: string; placa: string | null; marca: string | null; modelo: string | null }
  mecanico?: { id: string; nome: string }
  orcamento?: { id: string; numero: string }
}

// Veículo com seus orçamentos e OS (usado na tela de detalhe).
export interface VeiculoDetalheApi extends VeiculoApi {
  orcamentos: (OrcamentoApi & { itens: { quantidade: number; valorUnitario: number }[] })[]
  ordensServico: (OrdemServicoApi & { mecanico: { id: string; nome: string } })[]
}

// Funções de acesso à API --------------------------------------------------------

// --- Fornecedores ---

export function listarFornecedores(q?: string): Promise<FornecedorApi[]> {
  const params = q ? `?q=${encodeURIComponent(q)}` : ''
  return executar<FornecedorApi[]>(`/api/fornecedores${params}`)
}

export function criarFornecedor(dados: {
  nome: string
  documento?: string
  telefone?: string
  email?: string
  categoria?: string
  observacao?: string
}): Promise<FornecedorApi> {
  return executar<FornecedorApi>('/api/fornecedores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  })
}

export function atualizarFornecedor(
  id: string,
  dados: Partial<{
    nome: string
    documento: string
    telefone: string
    email: string
    categoria: string
    observacao: string
    ativo: boolean
    version: number
  }>,
): Promise<FornecedorApi> {
  return executar<FornecedorApi>(`/api/fornecedores/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  })
}

// --- Peças ---

export function listarPecas(params?: {
  q?: string
  chassi?: string
  categoria?: string
}): Promise<PecaApi[]> {
  const sp = new URLSearchParams()
  if (params?.q) sp.set('q', params.q)
  if (params?.chassi) sp.set('chassi', params.chassi)
  if (params?.categoria) sp.set('categoria', params.categoria)
  const qs = sp.toString()
  return executar<PecaApi[]>(`/api/pecas${qs ? `?${qs}` : ''}`)
}

export function criarPeca(dados: {
  nome: string
  codigo?: string
  categoria: string
  subcategoria?: string
  unidade?: string
  fornecedorId?: string
  precoDia?: number
  estoqueMinimo?: number
  quantidadeInicial?: number
  chassisCompativeis?: { chassi: string; modeloVeiculo?: string }[]
}): Promise<PecaApi> {
  return executar<PecaApi>('/api/pecas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  })
}

export function atualizarPrecoDia(id: string, precoDia: number): Promise<PecaApi> {
  return executar<PecaApi>(`/api/pecas/${id}/preco-dia`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ precoDia }),
  })
}

// --- Estoque ---

export function listarEstoque(q?: string): Promise<ItemEstoqueApi[]> {
  const params = q ? `?q=${encodeURIComponent(q)}` : ''
  return executar<ItemEstoqueApi[]>(`/api/estoque${params}`)
}

export function listarAlertas(): Promise<AlertaCompraApi[]> {
  return executar<AlertaCompraApi[]>('/api/estoque/alertas')
}

export function registrarMovimentacao(dados: {
  pecaId: string
  tipo: 'ENTRADA' | 'SAIDA' | 'AJUSTE'
  quantidade: number
  motivo?: string
}): Promise<{ movimentacao: MovimentacaoApi; peca: PecaApi }> {
  return executar<{ movimentacao: MovimentacaoApi; peca: PecaApi }>(
    '/api/estoque/movimentacoes',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    },
  )
}

function post<T>(url: string, body: unknown): Promise<T> {
  return executar<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
function patch<T>(url: string, body: unknown): Promise<T> {
  return executar<T>(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// --- Clientes ---

export function listarClientes(q?: string): Promise<ClienteApi[]> {
  const params = q ? `?q=${encodeURIComponent(q)}` : ''
  return executar<ClienteApi[]>(`/api/clientes${params}`)
}

export function criarCliente(dados: {
  nome: string
  telefone?: string
  documento?: string
  email?: string
  observacao?: string
}): Promise<ClienteApi> {
  return post<ClienteApi>('/api/clientes', dados)
}

export function atualizarCliente(
  id: string,
  dados: Partial<{ nome: string; telefone: string; documento: string; email: string; observacao: string }> & {
    version: number
  },
): Promise<ClienteApi> {
  return patch<ClienteApi>(`/api/clientes/${id}`, dados)
}

export function excluirCliente(id: string): Promise<{ ok: boolean }> {
  return executar<{ ok: boolean }>(`/api/clientes/${id}`, { method: 'DELETE' })
}

// --- Veículos ---

export function listarVeiculos(params?: { q?: string; clienteId?: string }): Promise<VeiculoApi[]> {
  const sp = new URLSearchParams()
  if (params?.q) sp.set('q', params.q)
  if (params?.clienteId) sp.set('clienteId', params.clienteId)
  const qs = sp.toString()
  return executar<VeiculoApi[]>(`/api/veiculos${qs ? `?${qs}` : ''}`)
}

export function obterVeiculo(id: string): Promise<VeiculoDetalheApi> {
  return executar<VeiculoDetalheApi>(`/api/veiculos/${id}`)
}

export function criarVeiculo(dados: {
  clienteId: string
  placa?: string
  chassi?: string
  marca?: string
  modelo?: string
  ano?: number
  cor?: string
}): Promise<VeiculoApi> {
  return post<VeiculoApi>('/api/veiculos', dados)
}

export function atualizarVeiculo(
  id: string,
  dados: Partial<{ placa: string; chassi: string; marca: string; modelo: string; ano: number; cor: string }> & {
    version: number
  },
): Promise<VeiculoApi> {
  return patch<VeiculoApi>(`/api/veiculos/${id}`, dados)
}

export function excluirVeiculo(id: string): Promise<{ ok: boolean }> {
  return executar<{ ok: boolean }>(`/api/veiculos/${id}`, { method: 'DELETE' })
}

// --- Mecânicos ---

export function listarMecanicos(todos = false): Promise<MecanicoApi[]> {
  return executar<MecanicoApi[]>(`/api/mecanicos${todos ? '?todos=1' : ''}`)
}

export function criarMecanico(nome: string): Promise<MecanicoApi> {
  return post<MecanicoApi>('/api/mecanicos', { nome })
}

export function atualizarMecanico(
  id: string,
  dados: Partial<{ nome: string; ativo: boolean }> & { version: number },
): Promise<MecanicoApi> {
  return patch<MecanicoApi>(`/api/mecanicos/${id}`, dados)
}

// --- Orçamentos ---

export interface ItemEntradaApi {
  tipo: 'PECA' | 'MAO_DE_OBRA'
  pecaId?: string
  descricao: string
  quantidade: number
  valorUnitario: number
}

export function listarOrcamentos(params?: { q?: string; status?: string }): Promise<OrcamentoApi[]> {
  const sp = new URLSearchParams()
  if (params?.q) sp.set('q', params.q)
  if (params?.status) sp.set('status', params.status)
  const qs = sp.toString()
  return executar<OrcamentoApi[]>(`/api/orcamentos${qs ? `?${qs}` : ''}`)
}

export function obterOrcamento(id: string): Promise<OrcamentoApi> {
  return executar<OrcamentoApi>(`/api/orcamentos/${id}`)
}

export function criarOrcamento(dados: {
  clienteId: string
  veiculoId: string
  observacao?: string
  responsavel?: string
  itens?: ItemEntradaApi[]
}): Promise<OrcamentoApi> {
  return post<OrcamentoApi>('/api/orcamentos', dados)
}

export function atualizarOrcamento(
  id: string,
  dados: { observacao?: string; responsavel?: string; version: number },
): Promise<OrcamentoApi> {
  return patch<OrcamentoApi>(`/api/orcamentos/${id}`, dados)
}

export function adicionarItemOrcamento(orcamentoId: string, item: ItemEntradaApi): Promise<ItemOrcamentoApi> {
  return post<ItemOrcamentoApi>(`/api/orcamentos/${orcamentoId}/itens`, item)
}

export function atualizarItemOrcamento(
  orcamentoId: string,
  itemId: string,
  dados: Partial<{ descricao: string; quantidade: number; valorUnitario: number }> & { version: number },
): Promise<ItemOrcamentoApi> {
  return patch<ItemOrcamentoApi>(`/api/orcamentos/${orcamentoId}/itens/${itemId}`, dados)
}

export function removerItemOrcamento(orcamentoId: string, itemId: string): Promise<{ ok: boolean }> {
  return executar<{ ok: boolean }>(`/api/orcamentos/${orcamentoId}/itens/${itemId}`, { method: 'DELETE' })
}

export function acaoOrcamento(
  id: string,
  dados: {
    acao: 'ENVIAR' | 'AUTORIZAR' | 'RECUSAR'
    formaAutorizacao?: 'PRESENCIAL' | 'TELEFONE' | 'WHATSAPP'
    version: number
  },
): Promise<OrcamentoApi> {
  return post<OrcamentoApi>(`/api/orcamentos/${id}/acao`, dados)
}

// --- Ordens de serviço ---

export function listarOrdensServico(params?: { q?: string; status?: string }): Promise<OrdemServicoApi[]> {
  const sp = new URLSearchParams()
  if (params?.q) sp.set('q', params.q)
  if (params?.status) sp.set('status', params.status)
  const qs = sp.toString()
  return executar<OrdemServicoApi[]>(`/api/ordens-servico${qs ? `?${qs}` : ''}`)
}

export function criarOrdemServico(dados: {
  orcamentoId: string
  mecanicoId: string
  previsaoEntrega?: string
}): Promise<OrdemServicoApi> {
  return post<OrdemServicoApi>('/api/ordens-servico', dados)
}

export function atualizarOrdemServico(
  id: string,
  dados: { status?: StatusOSApi; mecanicoId?: string; previsaoEntrega?: string; version: number },
): Promise<OrdemServicoApi> {
  return patch<OrdemServicoApi>(`/api/ordens-servico/${id}`, dados)
}
