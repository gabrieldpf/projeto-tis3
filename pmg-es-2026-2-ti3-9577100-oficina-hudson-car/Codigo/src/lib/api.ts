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
