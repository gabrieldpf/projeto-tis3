'use client'
// R1 (RF10) — Captura de fotos de ENTRADA do veículo. Pensado para o celular
// na recepção do carro: o botão abre a câmera (input capture) e aceita várias
// fotos. Sem jargão: "Adicionar fotos de entrada" → tira/escolhe → aparece.
//
// As fotos são lidas por URL assinada temporária (bucket privado); se o storage
// estiver indisponível, mostramos um espaço reservado em vez de quebrar.

import { useCallback, useEffect, useRef, useState } from 'react'
import { listarFotos, enviarFoto, type FotoApi, ApiClientError } from '@/lib/api'
import { IconeFoto } from '@/components/icons'

interface Props {
  veiculoId: string
  /** Vincula as fotos a uma OS (opcional). */
  ordemServicoId?: string
}

export function FotosVeiculo({ veiculoId, ordemServicoId }: Props) {
  const [fotos, setFotos] = useState<FotoApi[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const carregar = useCallback(() => {
    setCarregando(true)
    setErro(null)
    listarFotos(veiculoId, 'ENTRADA')
      .then(setFotos)
      .catch((e) => setErro(e instanceof ApiClientError ? e.message : 'Erro ao carregar fotos.'))
      .finally(() => setCarregando(false))
  }, [veiculoId])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function enviarSelecionadas(lista: FileList | null) {
    if (!lista || lista.length === 0) return
    setEnviando(true)
    setErro(null)
    try {
      for (const arquivo of Array.from(lista)) {
        await enviarFoto(veiculoId, arquivo, { momento: 'ENTRADA', ordemServicoId })
      }
      carregar()
    } catch (e) {
      setErro(e instanceof ApiClientError ? e.message : 'Não foi possível enviar a foto.')
    } finally {
      setEnviando(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>
            <IconeFoto sx={{ fontSize: 18, verticalAlign: '-3px' }} /> Fotos de entrada
          </h2>
          <p>Registre o estado do veículo na recepção (evita disputa de arranhão)</p>
        </div>
        <button className="btn" onClick={() => inputRef.current?.click()} disabled={enviando}>
          <IconeFoto sx={{ fontSize: 18 }} /> {enviando ? 'Enviando…' : 'Adicionar fotos de entrada'}
        </button>
      </div>
      <div className="card-body">
        {/* Abre a câmera traseira no celular; no desktop, o seletor de arquivos. */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => enviarSelecionadas(e.target.files)}
          aria-hidden="true"
          tabIndex={-1}
        />

        {erro && (
          <div className="aviso vermelho" role="alert" style={{ marginBottom: 14 }}>
            {erro}
          </div>
        )}

        {carregando ? (
          <div className="carregando">Carregando fotos…</div>
        ) : fotos.length === 0 ? (
          <p className="txt-suave">
            Nenhuma foto de entrada ainda. Use o botão acima para fotografar o veículo.
          </p>
        ) : (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {fotos.map((f) => (
              <figure key={f.id} style={{ width: 140, margin: 0 }}>
                {f.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL assinada do Supabase; next/image exigiria config de domínio (deploy/V3)
                  <img
                    src={f.url}
                    alt={f.legenda ?? 'Foto de entrada do veículo'}
                    style={{
                      width: 140,
                      height: 96,
                      objectFit: 'cover',
                      borderRadius: 8,
                      border: '1px solid var(--cinza-borda)',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 140,
                      height: 96,
                      borderRadius: 8,
                      display: 'grid',
                      placeItems: 'center',
                      background: '#eef1f5',
                      color: '#94a3b8',
                    }}
                  >
                    <IconeFoto sx={{ fontSize: 32 }} />
                  </div>
                )}
                <figcaption className="txt-suave" style={{ fontSize: 12, marginTop: 4 }}>
                  {new Date(f.createdAt).toLocaleDateString('pt-BR')}
                  {f.legenda ? ` · ${f.legenda}` : ''}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
