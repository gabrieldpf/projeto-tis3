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
  aditivoId: string | null
  tipo: 'PECA' | 'MAO_DE_OBRA'
  pecaId: string | null
  descricao: string
  quantidade: number
  valorUnitario: number
  origemPeca: 'ESTOQUE' | 'COMPRA_AVULSA' | null
  garantiaDias: number | null
  baixaEstoqueEm: string | null
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

// --- Sprint 3: Aditivo, garantia, baixa, histórico, presença, relatórios -----

export type StatusAditivoApi = StatusOrcamentoApi

export interface AditivoApi {
  id: string
  orcamentoId: string
  numero: number
  status: StatusAditivoApi
  observacao: string | null
  criadoPorId: string | null
  autorizadoEm: string | null
  formaAutorizacao: 'PRESENCIAL' | 'TELEFONE' | 'WHATSAPP' | null
  registradoPorId: string | null
  version: number
  createdAt: string
  updatedAt: string
  itens: ItemOrcamentoApi[]
  // navegação opcional (p/ home/listagem): orçamento e sua OS, se houver.
  orcamento?: { id: string; numero: string; ordemServico: { id: string; numero: string } | null }
}

export interface GarantiaApi {
  id: string
  ordemServicoId: string
  itemOrcamentoId: string | null
  descricao: string
  prazoDias: number
  iniciaEm: string
  validaAte: string
  vigente: boolean
  version: number
  createdAt: string
  updatedAt: string
}

// OS detalhada: itens efetivos (orçamento + aditivos autorizados), aditivos,
// garantias e movimentações de estoque geradas.
export interface OrdemServicoDetalheApi extends OrdemServicoApi {
  itens: ItemOrcamentoApi[]
  aditivos: AditivoApi[]
  garantias: GarantiaApi[]
  movimentacoes: MovimentacaoApi[]
  totalServico: number
}

// Resultado de marcar a OS como PRONTA (baixa automática + pendências).
export interface BaixaItemApi {
  itemId: string
  pecaId: string
  pecaNome: string
  quantidade: number
  saldoResultante: number
  unidade: string
}
export interface PendenciaBaixaApi {
  itemId: string
  pecaId: string
  pecaNome: string
  unidade: string
  quantidadeNecessaria: number
  saldoAtual: number
  faltam: number
  version: number
}
export interface ResultadoBaixaApi {
  os: OrdemServicoApi
  baixados: BaixaItemApi[]
  pendencias: PendenciaBaixaApi[]
  alertas: AlertaCompraApi[]
}

// Prévia de entrega: garantias que serão geradas.
export interface PreviaEntregaApi {
  ordemServicoId: string
  itens: { itemId: string; descricao: string; tipo: 'PECA' | 'MAO_DE_OBRA'; prazoDias: number; validaAte: string }[]
}

// Histórico do veículo: OS entregues + garantias vigentes.
export interface OSHistoricoApi extends OrdemServicoApi {
  itens: ItemOrcamentoApi[]
  garantias: GarantiaApi[]
  totalServico: number
}
export interface HistoricoVeiculoApi {
  veiculo: VeiculoApi
  ordensEntregues: OSHistoricoApi[]
  garantiasVigentes: GarantiaApi[]
}

// Presença de edição (só informativo).
export interface PresencaApi {
  usuarioId: string
  nome: string
  atualizadoEm: string
}

// Relatório financeiro (ADMIN) — mesma forma do mock antigo.
export interface RelatorioFinanceiroApi {
  faturamentoMes: number
  faturamentoMesAnterior: number
  ticketMedio: number
  aReceber: number
  serie: { periodo: string; carros: number; faturamento: number }[]
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

// Edição dos dados cadastrais da peça. O `precoDia` NÃO entra aqui — tem
// endpoint próprio com auditoria (regra de ouro nº 3).
export function atualizarPeca(
  id: string,
  dados: Partial<{
    nome: string
    codigo: string
    categoria: string
    subcategoria: string
    unidade: string
    fornecedorId: string | null
    estoqueMinimo: number
    ativo: boolean
    chassisCompativeis: { chassi: string; modeloVeiculo?: string }[]
  }> & { version: number },
): Promise<PecaApi> {
  return patch<PecaApi>(`/api/pecas/${id}`, dados)
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

export function obterOrdemServico(id: string): Promise<OrdemServicoDetalheApi> {
  return executar<OrdemServicoDetalheApi>(`/api/ordens-servico/${id}`)
}

// N1: marcar PRONTA dispara a baixa automática e retorna o que baixou + pendências.
export function marcarOSPronta(id: string, version: number): Promise<ResultadoBaixaApi> {
  return post<ResultadoBaixaApi>(`/api/ordens-servico/${id}/pronta`, { version })
}

// L2: resolver uma pendência de baixa (compra avulsa ou ajuste de estoque).
export function resolverPendenciaBaixa(
  osId: string,
  itemId: string,
  dados: { acao: 'COMPRA_AVULSA' | 'AJUSTE_ESTOQUE'; quantidade?: number; version: number },
): Promise<{ item: ItemOrcamentoApi; peca: PecaApi | null; baixado: BaixaItemApi | null }> {
  return post(`/api/ordens-servico/${osId}/itens/${itemId}/pendencia`, dados)
}

// N3: prévia das garantias e entrega da OS.
export function obterPreviaEntrega(osId: string): Promise<PreviaEntregaApi> {
  return executar<PreviaEntregaApi>(`/api/ordens-servico/${osId}/previa-entrega`)
}
export function entregarOS(id: string, version: number): Promise<{ os: OrdemServicoApi; garantias: GarantiaApi[] }> {
  return post(`/api/ordens-servico/${id}/entregar`, { version })
}

// --- Histórico do veículo (M2/N2) ---

export function obterHistoricoVeiculo(veiculoId: string): Promise<HistoricoVeiculoApi> {
  return executar<HistoricoVeiculoApi>(`/api/veiculos/${veiculoId}/historico`)
}

// --- Aditivos (L3/L4 · O1/O2) ---

export function listarAditivos(params?: { orcamentoId?: string; status?: string }): Promise<AditivoApi[]> {
  const sp = new URLSearchParams()
  if (params?.orcamentoId) sp.set('orcamentoId', params.orcamentoId)
  if (params?.status) sp.set('status', params.status)
  const qs = sp.toString()
  return executar<AditivoApi[]>(`/api/aditivos${qs ? `?${qs}` : ''}`)
}

export function obterAditivo(id: string): Promise<AditivoApi> {
  return executar<AditivoApi>(`/api/aditivos/${id}`)
}

export function criarAditivo(dados: { orcamentoId: string; observacao?: string }): Promise<AditivoApi> {
  return post<AditivoApi>('/api/aditivos', dados)
}

export function atualizarAditivo(
  id: string,
  dados: { observacao?: string; version: number },
): Promise<AditivoApi> {
  return patch<AditivoApi>(`/api/aditivos/${id}`, dados)
}

export function adicionarItemAditivo(aditivoId: string, item: ItemEntradaApi): Promise<ItemOrcamentoApi> {
  return post<ItemOrcamentoApi>(`/api/aditivos/${aditivoId}/itens`, item)
}

export function atualizarItemAditivo(
  aditivoId: string,
  itemId: string,
  dados: Partial<{ descricao: string; quantidade: number; valorUnitario: number; origemPeca: 'ESTOQUE' | 'COMPRA_AVULSA'; garantiaDias: number | null }> & { version: number },
): Promise<ItemOrcamentoApi> {
  return patch<ItemOrcamentoApi>(`/api/aditivos/${aditivoId}/itens/${itemId}`, dados)
}

export function removerItemAditivo(aditivoId: string, itemId: string): Promise<{ ok: boolean }> {
  return executar<{ ok: boolean }>(`/api/aditivos/${aditivoId}/itens/${itemId}`, { method: 'DELETE' })
}

export function acaoAditivo(
  id: string,
  dados: {
    acao: 'ENVIAR' | 'AUTORIZAR' | 'RECUSAR'
    formaAutorizacao?: 'PRESENCIAL' | 'TELEFONE' | 'WHATSAPP'
    version: number
  },
): Promise<AditivoApi> {
  return post<AditivoApi>(`/api/aditivos/${id}/acao`, dados)
}

// --- Presença de edição (M3/O3) ---

export function registrarPresenca(recurso: 'ORCAMENTO' | 'ADITIVO', recursoId: string): Promise<PresencaApi[]> {
  return post<PresencaApi[]>('/api/presenca', { recurso, recursoId })
}

export function listarPresenca(recurso: 'ORCAMENTO' | 'ADITIVO', recursoId: string): Promise<PresencaApi[]> {
  const sp = new URLSearchParams({ recurso, recursoId })
  return executar<PresencaApi[]>(`/api/presenca?${sp.toString()}`)
}

// --- Relatórios financeiros (ADMIN · #22) ---

export function obterRelatorioFinanceiro(params?: { de?: string; ate?: string }): Promise<RelatorioFinanceiroApi> {
  const sp = new URLSearchParams()
  if (params?.de) sp.set('de', params.de)
  if (params?.ate) sp.set('ate', params.ate)
  const qs = sp.toString()
  return executar<RelatorioFinanceiroApi>(`/api/relatorios${qs ? `?${qs}` : ''}`)
}
