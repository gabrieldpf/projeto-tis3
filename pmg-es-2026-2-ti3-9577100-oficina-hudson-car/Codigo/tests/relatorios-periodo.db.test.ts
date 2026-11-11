// S1 — Relatório comparativo por período (RF11, ADMIN): filtro de/ate,
// agrupamento por mês, totais e variação vs. período anterior; e o acesso
// restrito a ADMIN na rota (regra de ouro nº 2).
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { SessaoPayload } from '@/lib/session'

// Sessão mockada (para os testes de RBAC da rota).
const lerSessaoMock = vi.fn<() => Promise<SessaoPayload | null>>()
vi.mock('@/lib/auth', () => ({ lerSessao: () => lerSessaoMock() }))

import { prisma } from '@/lib/db'
import { marcarPronta, entregarOS, atualizarOS } from '@/server/os'
import { obterRelatorioFinanceiro } from '@/server/relatorios'
import { GET } from '@/app/api/relatorios/route'
import {
  limparTudo,
  criarUsuario,
  criarCliente,
  criarVeiculo,
  criarMecanico,
  criarOrcamentoAutorizadoComOS,
} from './helpers'

let usuarioId: string
let clienteId: string
let mecanicoId: string

beforeEach(async () => {
  await limparTudo()
  vi.clearAllMocks()
  lerSessaoMock.mockReset()
  usuarioId = (await criarUsuario()).id
  clienteId = (await criarCliente()).id
  mecanicoId = (await criarMecanico()).id
})

/// Entrega uma OS e força a data de entrega para um mês específico.
async function entregarEm(valor: number, entregueEm: Date) {
  const veiculo = await criarVeiculo(clienteId, { placa: `P-${Math.floor(Math.random() * 9000) + 1000}` })
  const { os } = await criarOrcamentoAutorizadoComOS(usuarioId, clienteId, veiculo.id, mecanicoId, [
    { tipo: 'MAO_DE_OBRA', descricao: 'Serviço', quantidade: 1, valorUnitario: valor },
  ])
  const osA = (await atualizarOS(os.id, { status: 'EM_ANDAMENTO', version: os.version }, usuarioId))!
  const { os: osP } = await marcarPronta(osA.id, osA.version, usuarioId)
  await entregarOS(osP!.id, osP!.version)
  await prisma.ordemServico.update({ where: { id: osP!.id }, data: { entregueEm } })
}

describe('obterRelatorioFinanceiro — filtro por período', () => {
  it('agrupa por mês dentro do intervalo e ignora o que está fora', async () => {
    await entregarEm(100, new Date(2026, 0, 15)) // Jan (fora)
    await entregarEm(200, new Date(2026, 2, 10)) // Mar
    await entregarEm(300, new Date(2026, 4, 20)) // Mai

    const r = await obterRelatorioFinanceiro({ de: '2026-03-01', ate: '2026-05-31' })

    expect(r.serie).toHaveLength(3) // Mar, Abr, Mai
    expect(r.serie.map((s) => s.periodo)).toEqual(['Mar/26', 'Abr/26', 'Mai/26'])
    expect(r.serie[0]).toMatchObject({ carros: 1, faturamento: 200 }) // Mar
    expect(r.serie[1]).toMatchObject({ carros: 0, faturamento: 0 }) // Abr
    expect(r.serie[2]).toMatchObject({ carros: 1, faturamento: 300 }) // Mai
    expect(r.totalCarros).toBe(2)
    expect(r.totalFaturamento).toBeCloseTo(500, 2)
    expect(r.periodo).toEqual({ de: '2026-03-01', ate: '2026-05-31' })
  })

  it('ticketMedioPeriodo = totalFaturamento / totalCarros', async () => {
    await entregarEm(200, new Date(2026, 4, 5))
    await entregarEm(400, new Date(2026, 4, 25))
    const r = await obterRelatorioFinanceiro({ de: '2026-05-01', ate: '2026-05-31' })
    expect(r.totalCarros).toBe(2)
    expect(r.ticketMedioPeriodo).toBeCloseTo(300, 2) // 600/2
  })

  it('variação vs. período anterior de igual duração', async () => {
    await entregarEm(200, new Date(2026, 3, 10)) // Abr (período anterior)
    await entregarEm(500, new Date(2026, 4, 10)) // Mai (período atual)

    const r = await obterRelatorioFinanceiro({ de: '2026-05-01', ate: '2026-05-31' })
    // atual=500, anterior=200 → (500-200)/200*100 = 150%
    expect(r.variacao.faturamento).toBeCloseTo(150, 2)
    // carros: atual=1, anterior=1 → 0%
    expect(r.variacao.carros).toBeCloseTo(0, 2)
  })

  it('variação é null quando o período anterior é vazio (sem base)', async () => {
    await entregarEm(500, new Date(2026, 4, 10)) // só Mai; Abr vazio
    const r = await obterRelatorioFinanceiro({ de: '2026-05-01', ate: '2026-05-31' })
    expect(r.variacao.faturamento).toBeNull()
    expect(r.variacao.carros).toBeNull()
  })

  it('sem período continua retornando os últimos 6 meses', async () => {
    const r = await obterRelatorioFinanceiro({})
    expect(r.serie).toHaveLength(6)
    expect(r.periodo).toEqual({ de: null, ate: null })
  })

  it('de > ate → DADOS_INVALIDOS', async () => {
    await expect(
      obterRelatorioFinanceiro({ de: '2026-05-31', ate: '2026-05-01' }),
    ).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' })
  })

  it('data malformada → DADOS_INVALIDOS', async () => {
    await expect(
      obterRelatorioFinanceiro({ de: '31/05/2026', ate: '2026-05-31' }),
    ).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' })
  })
})

describe('rota /api/relatorios — acesso só ADMIN (regra de ouro nº 2)', () => {
  function req(qs = '') {
    return new Request(`http://localhost/api/relatorios${qs}`)
  }
  function sessao(papel: SessaoPayload['papel']): SessaoPayload {
    return { sub: usuarioId, nome: 'Fulano', cargo: 'x', papel }
  }

  it('ADMIN → 200', async () => {
    lerSessaoMock.mockResolvedValue(sessao('ADMIN'))
    const res = await GET(req())
    expect(res.status).toBe(200)
  })

  it('GESTOR → 403', async () => {
    lerSessaoMock.mockResolvedValue(sessao('GESTOR'))
    const res = await GET(req())
    expect(res.status).toBe(403)
  })

  it('OPERACIONAL → 403', async () => {
    lerSessaoMock.mockResolvedValue(sessao('OPERACIONAL'))
    const res = await GET(req())
    expect(res.status).toBe(403)
  })

  it('sem sessão → 401', async () => {
    lerSessaoMock.mockResolvedValue(null)
    const res = await GET(req())
    expect(res.status).toBe(401)
  })
})
