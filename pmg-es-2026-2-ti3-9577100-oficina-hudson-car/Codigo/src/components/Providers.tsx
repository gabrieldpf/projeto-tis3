'use client'
// Wrapper client-side que agrupa todos os providers necessários.
// Fica abaixo do AppRouterCacheProvider (MUI/emotion) que vive no layout raiz.

import { AuthProvider } from '@/context/AuthContext'
import type { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
