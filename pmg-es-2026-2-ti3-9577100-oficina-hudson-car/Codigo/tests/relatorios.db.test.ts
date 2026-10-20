// Relatórios financeiros (banco): faturamento soma OS ENTREGUE; OS não entregues
// não contam; série retorna últimos 6 meses.
import { describe, it, expect, beforeEach } from 'vitest'
import { marcarPronta, entregarOS, atualizarOS } from '@/server/os'
import { obterRelatorioFinanceiro } from '@/server/relatorios'
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
let veiculoId: string
let mecanicoId: string

beforeEach(async () => {
  await limparTudo()
  usuarioId = (await criarUsuario()).id
  clienteId = (await criarCliente()).id
  veiculoId = (await criarVeiculo(clienteId)).id
  mecanicoId = (await criarMecanico()).id
})

async function criarEEntregarOS(
  itens: Parameters<typeof criarOrcamentoAutorizadoComOS>[4],
) {
  const veiculo = await criarVeiculo(clienteId, { placa: `TST-${Math.floor(Math.random() * 9000) + 1000}` })
  const { os } = await criarOrcamentoAutorizadoComOS(
    usuarioId, clienteId, veiculo.id, mecanicoId, itens,
  )
  const osA = (await atualizarOS(os.id, { status: 'EM_ANDAMENTO', version: os.version }, usuarioId))!
  const { os: osPronta } = await marcarPronta(osA.id, osA.version, usuarioId)
  return entregarOS(osPronta!.id, osPronta!.version)
}

describe('obterRelatorioFinanceiro', () => {
  it('faturamentoMes soma apenas OS com status ENTREGUE no mês corrente', async () => {
    // Entrega uma OS com dois itens: total = 1*200 + 2*50 = 300
    await criarEEntregarOS([
      { tipo: 'MAO_DE_OBRA', descricao: 'Troca de correia', quantidade: 1, valorUnitario: 200 },
      { tipo: 'MAO_DE_OBRA', descricao: 'Alinhamento', quantidade: 2, valorUnitario: 50 },
    ])

    const relatorio = await obterRelatorioFinanceiro({})
    expect(relatorio.faturamentoMes).toBeCloseTo(300, 2)
  })

  it('OS PRONTA (não entregue) não conta no faturamentoMes', async () => {
    const { os } = await criarOrcamentoAutorizadoComOS(
      usuarioId, clienteId, veiculoId, mecanicoId,
      [{ tipo: 'MAO_DE_OBRA', descricao: 'Serviço', quantidade: 1, valorUnitario: 500 }],
    )
    const osA = (await atualizarOS(os.id, { status: 'EM_ANDAMENTO', version: os.version }, usuarioId))!
    // Apenas marca PRONTA, não entrega
    await marcarPronta(osA.id, osA.version, usuarioId)

    const relatorio = await obterRelatorioFinanceiro({})
    expect(relatorio.faturamentoMes).toBe(0)
    // Mas deve aparecer em aReceber
    expect(relatorio.aReceber).toBeCloseTo(500, 2)
  })

  it('OS ABERTA (não entregue, não pronta) não conta em nenhum lado', async () => {
    await criarOrcamentoAutorizadoComOS(
      usuarioId, clienteId, veiculoId, mecanicoId,
      [{ tipo: 'MAO_DE_OBRA', descricao: 'Serviço', quantidade: 1, valorUnitario: 300 }],
    )

    const relatorio = await obterRelatorioFinanceiro({})
    expect(relatorio.faturamentoMes).toBe(0)
    expect(relatorio.aReceber).toBe(0)
  })

  it('múltiplas OS ENTREGUE: faturamento é a soma de todas', async () => {
    await criarEEntregarOS([{ tipo: 'MAO_DE_OBRA', descricao: 'S1', quantidade: 1, valorUnitario: 100 }])
    await criarEEntregarOS([{ tipo: 'MAO_DE_OBRA', descricao: 'S2', quantidade: 1, valorUnitario: 250 }])

    const relatorio = await obterRelatorioFinanceiro({})
    expect(relatorio.faturamentoMes).toBeCloseTo(350, 2)
  })

  it('ticketMedio = faturamentoMes / número de OS entregues no mês', async () => {
    await criarEEntregarOS([{ tipo: 'MAO_DE_OBRA', descricao: 'S1', quantidade: 1, valorUnitario: 100 }])
    await criarEEntregarOS([{ tipo: 'MAO_DE_OBRA', descricao: 'S2', quantidade: 1, valorUnitario: 200 }])

    const relatorio = await obterRelatorioFinanceiro({})
    // ticket = 300 / 2 = 150
    expect(relatorio.ticketMedio).toBeCloseTo(150, 2)
  })

  it('ticketMedio é 0 quando não há OS entregues no mês', async () => {
    const relatorio = await obterRelatorioFinanceiro({})
    expect(relatorio.ticketMedio).toBe(0)
  })

  it('serie retorna 6 entradas (últimos 6 meses)', async () => {
    const relatorio = await obterRelatorioFinanceiro({})
    expect(relatorio.serie).toHaveLength(6)
  })

  it('aReceber soma OS PRONTA (não entregues) corretamente', async () => {
    // OS 1 PRONTA
    const { os: os1 } = await criarOrcamentoAutorizadoComOS(
      usuarioId, clienteId, veiculoId, mecanicoId,
      [{ tipo: 'MAO_DE_OBRA', descricao: 'Serv 1', quantidade: 1, valorUnitario: 400 }],
    )
    const os1A = (await atualizarOS(os1.id, { status: 'EM_ANDAMENTO', version: os1.version }, usuarioId))!
    await marcarPronta(os1A.id, os1A.version, usuarioId)

    // OS 2 também PRONTA (outro veículo)
    const v2 = await criarVeiculo(clienteId, { placa: 'REC-0002' })
    const { os: os2 } = await criarOrcamentoAutorizadoComOS(
      usuarioId, clienteId, v2.id, mecanicoId,
      [{ tipo: 'MAO_DE_OBRA', descricao: 'Serv 2', quantidade: 1, valorUnitario: 300 }],
    )
    const os2A = (await atualizarOS(os2.id, { status: 'EM_ANDAMENTO', version: os2.version }, usuarioId))!
    await marcarPronta(os2A.id, os2A.version, usuarioId)

    const relatorio = await obterRelatorioFinanceiro({})
    expect(relatorio.aReceber).toBeCloseTo(700, 2)
  })
})
