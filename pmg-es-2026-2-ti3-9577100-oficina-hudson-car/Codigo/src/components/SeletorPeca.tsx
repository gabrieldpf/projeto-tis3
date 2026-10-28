'use client'
// Seletor de peça com autocomplete, filtrado opcionalmente pelo chassi do veículo.
// Extraído de orcamentos/page.tsx para reuso no PainelAditivo.

import { useEffect, useRef, useState } from 'react'
import { listarPecas, type PecaApi } from '@/lib/api'
import { moeda } from '@/utils/format'

interface SeletorPecaProps {
  chassi: string | null
  onEscolher: (p: PecaApi) => void
  disabled?: boolean
}

export function SeletorPeca({ chassi, onEscolher, disabled }: SeletorPecaProps) {
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<PecaApi[]>([])
  const [aberto, setAberto] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (!busca.trim()) {
      setResultados([])
      return
    }
    timer.current = setTimeout(async () => {
      try {
        const r = await listarPecas({ q: busca.trim(), chassi: chassi?.trim() || undefined })
        setResultados(r.slice(0, 8))
        setAberto(true)
      } catch {
        setResultados([])
      }
    }, 350)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [busca, chassi])

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="input"
        placeholder={chassi ? 'Buscar peça (filtra pelo chassi)…' : 'Buscar peça…'}
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        onFocus={() => resultados.length > 0 && setAberto(true)}
        disabled={disabled}
        aria-label="Buscar peça"
      />
      {aberto && resultados.length > 0 && (
        <div
          style={{
            position: 'absolute',
            zIndex: 20,
            top: '100%',
            left: 0,
            right: 0,
            background: '#fff',
            border: '1px solid #e3e8ef',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,.1)',
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {resultados.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onEscolher(p)
                setBusca('')
                setResultados([])
                setAberto(false)
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                border: 'none',
                borderBottom: '1px solid #f1f4f8',
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              <strong>{p.nome}</strong>{' '}
              <span className="txt-suave">· {moeda(p.precoDia)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
