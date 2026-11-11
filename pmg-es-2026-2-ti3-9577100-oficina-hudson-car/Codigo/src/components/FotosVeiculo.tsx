'use client'
// R1/R2 (RF10) — Fotos do veículo: captura de ENTRADA (recepção) e SAÍDA
// (entrega), com galeria comparativa entrada × saída, ampliação (lightbox) e
// remoção. Pensado para o celular: o botão abre a câmera (input capture) e
// aceita várias fotos. Sem jargão.
//
// - `momentos`: quais colunas mostrar. Padrão = ambas (visão comparativa na
//   tela do veículo). No fluxo de entrega da OS usamos apenas ['SAIDA'].
// - Leitura por URL assinada temporária (bucket privado); se o storage estiver
//   indisponível, mostramos um espaço reservado em vez de quebrar.

import { useCallback, useEffect, useRef, useState } from 'react'
import { listarFotos, enviarFoto, removerFoto, type FotoApi, ApiClientError } from '@/lib/api'
import { IconeFoto } from '@/components/icons'
import { MOMENTOS_FOTO, ROTULO_MOMENTO_FOTO, type MomentoFoto } from '@/lib/constants'

interface Props {
  veiculoId: string
  /** Vincula as fotos enviadas a uma OS (opcional). */
  ordemServicoId?: string
  /** Momentos exibidos. Padrão: entrada e saída (comparativo). */
  momentos?: MomentoFoto[]
  titulo?: string
  descricao?: string
}

export function FotosVeiculo({
  veiculoId,
  ordemServicoId,
  momentos = [...MOMENTOS_FOTO],
  titulo = 'Fotos de entrada / saída',
  descricao = 'Registro do estado do veículo (evita disputa de arranhão)',
}: Props) {
  const [fotos, setFotos] = useState<FotoApi[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [enviandoMomento, setEnviandoMomento] = useState<MomentoFoto | null>(null)
  const [ampliada, setAmpliada] = useState<FotoApi | null>(null)
  const [removendoId, setRemovendoId] = useState<string | null>(null)

  const inputs = useRef<Partial<Record<MomentoFoto, HTMLInputElement | null>>>({})

  const carregar = useCallback(() => {
    setCarregando(true)
    setErro(null)
    listarFotos(veiculoId)
      .then(setFotos)
      .catch((e) => setErro(e instanceof ApiClientError ? e.message : 'Erro ao carregar fotos.'))
      .finally(() => setCarregando(false))
  }, [veiculoId])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function enviarSelecionadas(momento: MomentoFoto, lista: FileList | null) {
    if (!lista || lista.length === 0) return
    setEnviandoMomento(momento)
    setErro(null)
    try {
      for (const arquivo of Array.from(lista)) {
        await enviarFoto(veiculoId, arquivo, { momento, ordemServicoId })
      }
      carregar()
    } catch (e) {
      setErro(e instanceof ApiClientError ? e.message : 'Não foi possível enviar a foto.')
    } finally {
      setEnviandoMomento(null)
      const input = inputs.current[momento]
      if (input) input.value = ''
    }
  }

  async function remover(foto: FotoApi) {
    if (!window.confirm('Remover esta foto? Esta ação não pode ser desfeita.')) return
    setRemovendoId(foto.id)
    setErro(null)
    try {
      await removerFoto(foto.id)
      setAmpliada((a) => (a?.id === foto.id ? null : a))
      setFotos((prev) => prev.filter((f) => f.id !== foto.id))
    } catch (e) {
      setErro(e instanceof ApiClientError ? e.message : 'Não foi possível remover a foto.')
    } finally {
      setRemovendoId(null)
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>
            <IconeFoto sx={{ fontSize: 18, verticalAlign: '-3px' }} /> {titulo}
          </h2>
          <p>{descricao}</p>
        </div>
      </div>
      <div className="card-body">
        {erro && (
          <div className="aviso vermelho" role="alert" style={{ marginBottom: 14 }}>
            {erro}
          </div>
        )}

        {carregando ? (
          <div className="carregando">Carregando fotos…</div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: momentos.length > 1 ? 'repeat(auto-fit, minmax(240px, 1fr))' : '1fr',
              gap: 20,
            }}
          >
            {momentos.map((momento) => {
              const doMomento = fotos.filter((f) => f.momento === momento)
              const rotulo = ROTULO_MOMENTO_FOTO[momento]
              return (
                <section key={momento} aria-label={`Fotos de ${rotulo.toLowerCase()}`}>
                  <div
                    className="flex entre"
                    style={{ marginBottom: 10, gap: 8, flexWrap: 'wrap' }}
                  >
                    <strong className="forte">{rotulo}</strong>
                    <button
                      className="btn secundario"
                      style={{ fontSize: 13 }}
                      onClick={() => inputs.current[momento]?.click()}
                      disabled={enviandoMomento !== null}
                    >
                      <IconeFoto sx={{ fontSize: 16 }} />{' '}
                      {enviandoMomento === momento ? 'Enviando…' : `Adicionar fotos de ${rotulo.toLowerCase()}`}
                    </button>
                  </div>

                  {/* Abre a câmera traseira no celular; no desktop, o seletor de arquivos. */}
                  <input
                    ref={(el) => {
                      inputs.current[momento] = el
                    }}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => enviarSelecionadas(momento, e.target.files)}
                    aria-hidden="true"
                    tabIndex={-1}
                  />

                  {doMomento.length === 0 ? (
                    <p className="txt-suave">Nenhuma foto de {rotulo.toLowerCase()} ainda.</p>
                  ) : (
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {doMomento.map((f) => (
                        <figure key={f.id} style={{ width: 132, margin: 0 }}>
                          <button
                            type="button"
                            onClick={() => setAmpliada(f)}
                            style={{
                              padding: 0,
                              border: 'none',
                              background: 'none',
                              width: 132,
                              height: 92,
                              display: 'block',
                            }}
                            aria-label={`Ampliar foto de ${rotulo.toLowerCase()}`}
                          >
                            {f.url ? (
                              // eslint-disable-next-line @next/next/no-img-element -- URL assinada do Supabase; next/image exigiria config de domínio (deploy/V3)
                              <img
                                src={f.url}
                                alt={f.legenda ?? `Foto de ${rotulo.toLowerCase()} do veículo`}
                                style={{
                                  width: 132,
                                  height: 92,
                                  objectFit: 'cover',
                                  borderRadius: 8,
                                  border: '1px solid var(--cinza-borda)',
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: 132,
                                  height: 92,
                                  borderRadius: 8,
                                  display: 'grid',
                                  placeItems: 'center',
                                  background: '#eef1f5',
                                  color: '#94a3b8',
                                }}
                              >
                                <IconeFoto sx={{ fontSize: 30 }} />
                              </div>
                            )}
                          </button>
                          <figcaption
                            className="flex entre"
                            style={{ fontSize: 12, marginTop: 4, gap: 6 }}
                          >
                            <span className="txt-suave">
                              {new Date(f.createdAt).toLocaleDateString('pt-BR')}
                            </span>
                            <button
                              type="button"
                              className="btn-fechar"
                              style={{ fontSize: 13, color: 'var(--vermelho)' }}
                              onClick={() => remover(f)}
                              disabled={removendoId === f.id}
                              aria-label="Remover foto"
                            >
                              {removendoId === f.id ? '…' : 'Remover'}
                            </button>
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </div>

      {/* Lightbox — ampliação da foto */}
      {ampliada && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Foto ampliada"
          onClick={() => setAmpliada(null)}
        >
          <div
            className="modal-box"
            style={{ maxWidth: 820, background: '#000' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head" style={{ background: '#fff' }}>
              <h2>
                {ROTULO_MOMENTO_FOTO[ampliada.momento as MomentoFoto]}
                {ampliada.legenda ? ` · ${ampliada.legenda}` : ''}
              </h2>
              <button className="btn-fechar" onClick={() => setAmpliada(null)} aria-label="Fechar">
                ×
              </button>
            </div>
            <div style={{ padding: 0, display: 'grid', placeItems: 'center' }}>
              {ampliada.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL assinada do Supabase
                <img
                  src={ampliada.url}
                  alt={ampliada.legenda ?? 'Foto do veículo ampliada'}
                  style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
                />
              ) : (
                <div className="carregando" style={{ color: '#fff' }}>
                  Imagem indisponível (storage).
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
