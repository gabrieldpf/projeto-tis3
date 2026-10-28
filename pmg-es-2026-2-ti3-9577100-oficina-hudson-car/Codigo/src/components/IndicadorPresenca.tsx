'use client'
// Indicador O3: mostra quem mais está editando o mesmo recurso.
// Aviso discreto — nunca bloqueia salvar.

import { type PresencaApi } from '@/lib/api'
import { IconeMecanico } from '@/components/icons'

interface IndicadorPresencaProps {
  outros: PresencaApi[]
}

export function IndicadorPresenca({ outros }: IndicadorPresencaProps) {
  if (outros.length === 0) return null

  const nomes = outros.map((p) => p.nome).join(', ')

  return (
    <div className="aviso azul" style={{ marginBottom: 12 }} aria-live="polite">
      <IconeMecanico sx={{ fontSize: 16, verticalAlign: '-2px' }} />{' '}
      <span>
        <strong>Editando agora:</strong> {nomes}
      </span>
    </div>
  )
}
