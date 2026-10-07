// Root layout — Server Component.
// Envolve tudo com AppRouterCacheProvider (MUI/emotion no App Router)
// e Providers (AuthProvider client-side).

import type { Metadata } from 'next'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter'
import { Providers } from '@/components/Providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Hudson Car · Gestão da oficina',
  description: 'Sistema de gestão da oficina mecânica Hudson Car.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AppRouterCacheProvider>
          <Providers>{children}</Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  )
}
