'use client'
// Layout autenticado: sidebar + topbar + área de conteúdo.
// Portado de src/components/Layout.tsx para o App Router.
// Itens de menu financeiros aparecem SOMENTE para o admin (RBAC).

import type { ComponentType } from 'react'
import type { SvgIconProps } from '@mui/material/SvgIcon'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  IconeInicio,
  IconeOrcamento,
  IconeOS,
  IconePecas,
  IconeEstoque,
  IconeVeiculo,
  IconeCliente,
  IconeRelatorios,
  IconeSair,
} from '@/components/icons'

interface ItemMenu {
  href: string
  Ico: ComponentType<SvgIconProps>
  texto: string
}

const MENU_OPERACIONAL: ItemMenu[] = [
  { href: '/', Ico: IconeInicio, texto: 'Início' },
  { href: '/orcamentos', Ico: IconeOrcamento, texto: 'Orçamentos' },
  { href: '/ordens-servico', Ico: IconeOS, texto: 'Ordens de serviço' },
  { href: '/pecas', Ico: IconePecas, texto: 'Peças & Fornecedores' },
  { href: '/estoque', Ico: IconeEstoque, texto: 'Estoque' },
  { href: '/fornecedores', Ico: IconePecas, texto: 'Fornecedores' },
  { href: '/veiculos', Ico: IconeVeiculo, texto: 'Veículos' },
  { href: '/clientes', Ico: IconeCliente, texto: 'Clientes' },
]

const MENU_ADMIN: ItemMenu[] = [
  { href: '/relatorios', Ico: IconeRelatorios, texto: 'Relatórios' },
]

// Título/subtítulo por rota, exibido na topbar.
const TITULOS: Record<string, { titulo: string; sub: string }> = {
  '/': { titulo: 'Início', sub: 'Visão geral da oficina' },
  '/orcamentos': { titulo: 'Orçamentos', sub: 'Orçamentos e autorizações' },
  '/ordens-servico': { titulo: 'Ordens de serviço', sub: 'Acompanhamento dos serviços' },
  '/pecas': { titulo: 'Peças & Fornecedores', sub: 'Busca por chassi e preço do dia' },
  '/estoque': { titulo: 'Estoque', sub: 'Quantidades e alertas de compra' },
  '/fornecedores': { titulo: 'Fornecedores', sub: 'Cadastro e gestão de fornecedores' },
  '/veiculos': { titulo: 'Veículos', sub: 'Histórico e fotos por veículo' },
  '/clientes': { titulo: 'Clientes', sub: 'Cadastro e contatos' },
  '/relatorios': { titulo: 'Relatórios', sub: 'Financeiro — acesso restrito' },
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase()
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { usuario, ehAdmin, sair } = useAuth()
  const pathname = usePathname()
  const meta = TITULOS[pathname] ?? { titulo: 'Hudson Car', sub: '' }

  function ehAtivo(href: string): boolean {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="marca">
          <div className="logo">HC</div>
          <div>
            <strong>Hudson Car</strong>
            <span>Gestão da oficina</span>
          </div>
        </div>

        <div className="nav-secao">Operacional</div>
        {MENU_OPERACIONAL.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link ${ehAtivo(item.href) ? 'ativo' : ''}`}
          >
            <item.Ico className="ico" fontSize="small" />
            {item.texto}
          </Link>
        ))}

        {ehAdmin && (
          <>
            <div className="nav-secao">Administração</div>
            {MENU_ADMIN.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${ehAtivo(item.href) ? 'ativo' : ''}`}
              >
                <item.Ico className="ico" fontSize="small" />
                {item.texto}
              </Link>
            ))}
          </>
        )}

        <div className="rodape">
          Sprint 1 · TIS3 · PUC Minas · 2026
        </div>
      </aside>

      <div className="conteudo">
        <header className="topbar">
          <div className="titulo-pagina">
            <h1>{meta.titulo}</h1>
            {meta.sub && <p>{meta.sub}</p>}
          </div>
          <div className="usuario">
            <div className="dados">
              <strong>{usuario?.nome}</strong>
              <br />
              <span>{usuario?.cargo}</span>
            </div>
            <div className="avatar">{iniciais(usuario?.nome ?? '?')}</div>
            <button
              className="btn-sair"
              onClick={() => void sair()}
              aria-label="Sair do sistema"
            >
              <IconeSair sx={{ fontSize: 15, verticalAlign: '-3px', mr: 0.5 }} />
              Sair
            </button>
          </div>
        </header>

        <main className="pagina">{children}</main>
      </div>
    </div>
  )
}
