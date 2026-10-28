'use client'
// Hook O3: presença de edição simultânea.
// Registra heartbeat a cada 15s e lista quem mais está editando o mesmo recurso.
// Erros são silenciosos — nunca bloqueia a edição (NUNCA BLOQUEIA SALVAR).

import { useEffect, useRef, useState } from 'react'
import { registrarPresenca, listarPresenca, type PresencaApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

export function usePresenca(
  recurso: 'ORCAMENTO' | 'ADITIVO' | null,
  recursoId: string | null,
): { outros: PresencaApi[] } {
  const { usuario } = useAuth()
  const [outros, setOutros] = useState<PresencaApi[]>([])
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!recurso || !recursoId || !usuario) {
      setOutros([])
      return
    }

    async function heartbeat() {
      if (!recurso || !recursoId || !usuario) return
      try {
        // registrarPresenca retorna a lista atualizada de presenças.
        const lista = await registrarPresenca(recurso, recursoId)
        setOutros(lista.filter((p) => p.usuarioId !== usuario.id))
      } catch {
        // Silencioso — tenta listar diretamente como fallback.
        try {
          const lista = await listarPresenca(recurso, recursoId)
          setOutros(lista.filter((p) => p.usuarioId !== usuario.id))
        } catch {
          // Ignora totalmente.
        }
      }
    }

    // Registra imediatamente ao montar.
    void heartbeat()

    // Repete a cada 15 segundos.
    intervaloRef.current = setInterval(() => { void heartbeat() }, 15_000)

    return () => {
      if (intervaloRef.current) clearInterval(intervaloRef.current)
      setOutros([])
    }
  }, [recurso, recursoId, usuario])

  return { outros }
}
