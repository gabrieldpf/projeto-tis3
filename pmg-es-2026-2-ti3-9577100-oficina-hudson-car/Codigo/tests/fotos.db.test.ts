// Q1 — API de fotos do veículo (RF10): upload, listagem por momento, remoção e
// autorização. O Supabase Storage é mockado (não toca a nuvem); o banco é o
// Postgres de teste. A sessão é mockada para exercitar o RBAC das rotas.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { SessaoPayload } from '@/lib/session'

// --- Mocks -------------------------------------------------------------------
// Storage: caminho determinístico + espiões nos efeitos (upload/remoção/URL).
vi.mock('@/lib/storage', () => ({
  montarPathFoto: (veiculoId: string, momento: string, nome: string) =>
    `${veiculoId}/${momento.toLowerCase()}/mock-${nome}`,
  enviarArquivo: vi.fn(async () => {}),
  removerArquivos: vi.fn(async () => {}),
  urlsAssinadas: vi.fn(async (paths: string[]) =>
    Object.fromEntries(paths.map((p) => [p, `https://signed.test/${p}`])),
  ),
}))

// Sessão: controla quem está autenticado nas rotas.
const lerSessaoMock = vi.fn<() => Promise<SessaoPayload | null>>()
vi.mock('@/lib/auth', () => ({ lerSessao: () => lerSessaoMock() }))

import { prisma } from '@/lib/db'
import * as storage from '@/lib/storage'
import { registrarFoto, listarFotosVeiculo, removerFoto } from '@/server/fotos'
import { GET, POST } from '@/app/api/veiculos/[id]/fotos/route'
import { DELETE } from '@/app/api/fotos/[id]/route'
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

beforeEach(async () => {
  await limparTudo()
  vi.clearAllMocks()
  lerSessaoMock.mockReset()
  usuarioId = (await criarUsuario()).id
  clienteId = (await criarCliente()).id
  veiculoId = (await criarVeiculo(clienteId)).id
})

function arquivoFake(over: Partial<{ nome: string; contentType: string; tamanho: number }> = {}) {
  return {
    nome: over.nome ?? 'foto.jpg',
    contentType: over.contentType ?? 'image/jpeg',
    tamanho: over.tamanho ?? 1234,
    dados: Buffer.from('bytes-da-foto'),
  }
}

function sessao(papel: SessaoPayload['papel'], sub = usuarioId): SessaoPayload {
  return { sub, nome: 'Fulano', cargo: 'x', papel }
}

// --- Camada de serviço -------------------------------------------------------
describe('registrarFoto', () => {
  it('envia ao storage e cria o registro com momento, path e autor', async () => {
    const foto = await registrarFoto({
      veiculoId,
      momento: 'ENTRADA',
      arquivo: arquivoFake(),
      criadoPorId: usuarioId,
    })

    expect(foto.momento).toBe('ENTRADA')
    expect(foto.criadoPorId).toBe(usuarioId)
    expect(foto.path).toBe(`${veiculoId}/entrada/mock-foto.jpg`)
    expect(storage.enviarArquivo).toHaveBeenCalledOnce()
    expect(await prisma.foto.count({ where: { veiculoId } })).toBe(1)
  })

  it('aceita vínculo com OS do próprio veículo e aplica trim na legenda', async () => {
    const mecanicoId = (await criarMecanico()).id
    const { os } = await criarOrcamentoAutorizadoComOS(usuarioId, clienteId, veiculoId, mecanicoId, [
      { tipo: 'MAO_DE_OBRA', descricao: 'Serviço', quantidade: 1, valorUnitario: 10 },
    ])

    const foto = await registrarFoto({
      veiculoId,
      momento: 'SAIDA',
      ordemServicoId: os.id,
      legenda: '  lataria traseira  ',
      arquivo: arquivoFake({ nome: 'traseira.png', contentType: 'image/png' }),
      criadoPorId: usuarioId,
    })
    expect(foto.momento).toBe('SAIDA')
    expect(foto.ordemServicoId).toBe(os.id)
    expect(foto.legenda).toBe('lataria traseira') // trim aplicado
  })

  it('veículo inexistente → NAO_ENCONTRADO (não envia ao storage)', async () => {
    await expect(
      registrarFoto({ veiculoId: 'nao-existe', momento: 'ENTRADA', arquivo: arquivoFake(), criadoPorId: usuarioId }),
    ).rejects.toMatchObject({ code: 'NAO_ENCONTRADO' })
    expect(storage.enviarArquivo).not.toHaveBeenCalled()
  })

  it('OS inexistente → NAO_ENCONTRADO', async () => {
    await expect(
      registrarFoto({
        veiculoId,
        momento: 'ENTRADA',
        ordemServicoId: 'os-inexistente',
        arquivo: arquivoFake(),
        criadoPorId: usuarioId,
      }),
    ).rejects.toMatchObject({ code: 'NAO_ENCONTRADO' })
  })

  it('OS de OUTRO veículo → DADOS_INVALIDOS', async () => {
    const mecanicoId = (await criarMecanico()).id
    const outroCliente = await criarCliente('Outro')
    const outroVeiculo = await criarVeiculo(outroCliente.id, { placa: 'OUT-0001', chassi: 'OUTRO123' })
    const { os } = await criarOrcamentoAutorizadoComOS(usuarioId, outroCliente.id, outroVeiculo.id, mecanicoId, [
      { tipo: 'MAO_DE_OBRA', descricao: 'Serviço', quantidade: 1, valorUnitario: 10 },
    ])

    await expect(
      registrarFoto({
        veiculoId, // foto para ESTE veículo, mas OS é de outro
        momento: 'ENTRADA',
        ordemServicoId: os.id,
        arquivo: arquivoFake(),
        criadoPorId: usuarioId,
      }),
    ).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' })
  })

  it('mime não suportado → DADOS_INVALIDOS (nada é enviado nem gravado)', async () => {
    await expect(
      registrarFoto({
        veiculoId,
        momento: 'ENTRADA',
        arquivo: arquivoFake({ contentType: 'application/pdf' }),
        criadoPorId: usuarioId,
      }),
    ).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' })
    expect(storage.enviarArquivo).not.toHaveBeenCalled()
    expect(await prisma.foto.count()).toBe(0)
  })

  it('arquivo acima de 10 MB → DADOS_INVALIDOS', async () => {
    await expect(
      registrarFoto({
        veiculoId,
        momento: 'ENTRADA',
        arquivo: arquivoFake({ tamanho: 11 * 1024 * 1024 }),
        criadoPorId: usuarioId,
      }),
    ).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' })
  })
})

describe('listarFotosVeiculo', () => {
  beforeEach(async () => {
    await registrarFoto({ veiculoId, momento: 'ENTRADA', arquivo: arquivoFake({ nome: 'e1.jpg' }), criadoPorId: usuarioId })
    await registrarFoto({ veiculoId, momento: 'ENTRADA', arquivo: arquivoFake({ nome: 'e2.jpg' }), criadoPorId: usuarioId })
    await registrarFoto({ veiculoId, momento: 'SAIDA', arquivo: arquivoFake({ nome: 's1.jpg' }), criadoPorId: usuarioId })
  })

  it('lista todas quando sem filtro, já com URL assinada', async () => {
    const fotos = await listarFotosVeiculo(veiculoId)
    expect(fotos).toHaveLength(3)
    expect(fotos[0]!.url).toMatch(/^https:\/\/signed\.test\//)
  })

  it('filtra por momento', async () => {
    const entrada = await listarFotosVeiculo(veiculoId, 'ENTRADA')
    const saida = await listarFotosVeiculo(veiculoId, 'SAIDA')
    expect(entrada).toHaveLength(2)
    expect(saida).toHaveLength(1)
    expect(entrada.every((f) => f.momento === 'ENTRADA')).toBe(true)
  })

  it('veículo inexistente → NAO_ENCONTRADO', async () => {
    await expect(listarFotosVeiculo('nao-existe')).rejects.toMatchObject({ code: 'NAO_ENCONTRADO' })
  })
})

describe('removerFoto', () => {
  it('apaga o registro e remove o arquivo do storage', async () => {
    const foto = await registrarFoto({ veiculoId, momento: 'ENTRADA', arquivo: arquivoFake(), criadoPorId: usuarioId })
    const res = await removerFoto(foto.id)
    expect(res).toEqual({ ok: true })
    expect(storage.removerArquivos).toHaveBeenCalledWith([foto.path])
    expect(await prisma.foto.findUnique({ where: { id: foto.id } })).toBeNull()
  })

  it('foto inexistente → NAO_ENCONTRADO', async () => {
    await expect(removerFoto('nao-existe')).rejects.toMatchObject({ code: 'NAO_ENCONTRADO' })
  })
})

// --- Rotas + RBAC ------------------------------------------------------------
describe('rotas de fotos (autorização)', () => {
  function postRequest(form: FormData) {
    return new Request(`http://localhost/api/veiculos/${veiculoId}/fotos`, { method: 'POST', body: form })
  }
  function formComArquivo() {
    const form = new FormData()
    form.append('arquivo', new File([Buffer.from('img')], 'foto.jpg', { type: 'image/jpeg' }))
    form.append('momento', 'ENTRADA')
    return form
  }

  it('POST sem sessão → 401', async () => {
    lerSessaoMock.mockResolvedValue(null)
    const res = await POST(postRequest(formComArquivo()), { params: { id: veiculoId } })
    expect(res.status).toBe(401)
    expect(await prisma.foto.count()).toBe(0)
  })

  it('POST autenticado (OPERACIONAL) → 201 e registra o autor', async () => {
    lerSessaoMock.mockResolvedValue(sessao('OPERACIONAL'))
    const res = await POST(postRequest(formComArquivo()), { params: { id: veiculoId } })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { id: string; criadoPorId: string; momento: string }
    expect(body.momento).toBe('ENTRADA')
    expect(body.criadoPorId).toBe(usuarioId)
    expect(storage.enviarArquivo).toHaveBeenCalledOnce()
  })

  it('POST sem o campo "arquivo" → 422', async () => {
    lerSessaoMock.mockResolvedValue(sessao('ADMIN'))
    const form = new FormData()
    form.append('momento', 'ENTRADA')
    const res = await POST(postRequest(form), { params: { id: veiculoId } })
    expect(res.status).toBe(422)
  })

  it('GET autenticado (GESTOR) lista as fotos', async () => {
    await registrarFoto({ veiculoId, momento: 'ENTRADA', arquivo: arquivoFake(), criadoPorId: usuarioId })
    lerSessaoMock.mockResolvedValue(sessao('GESTOR'))
    const res = await GET(new Request(`http://localhost/api/veiculos/${veiculoId}/fotos`), { params: { id: veiculoId } })
    expect(res.status).toBe(200)
    const body = (await res.json()) as unknown[]
    expect(body).toHaveLength(1)
  })

  it('GET sem sessão → 401', async () => {
    lerSessaoMock.mockResolvedValue(null)
    const res = await GET(new Request(`http://localhost/api/veiculos/${veiculoId}/fotos`), { params: { id: veiculoId } })
    expect(res.status).toBe(401)
  })

  it('DELETE autenticado remove a foto', async () => {
    const foto = await registrarFoto({ veiculoId, momento: 'ENTRADA', arquivo: arquivoFake(), criadoPorId: usuarioId })
    lerSessaoMock.mockResolvedValue(sessao('ADMIN'))
    const res = await DELETE(new Request(`http://localhost/api/fotos/${foto.id}`, { method: 'DELETE' }), {
      params: { id: foto.id },
    })
    expect(res.status).toBe(200)
    expect(await prisma.foto.findUnique({ where: { id: foto.id } })).toBeNull()
  })
})
