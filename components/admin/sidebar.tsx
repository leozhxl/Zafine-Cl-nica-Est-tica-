'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { CalendarDays, ChartColumn, CircleHelp, Columns3, LayoutDashboard, ListTodo, LogOut, Megaphone, Menu, MessageCircle, MonitorDot, Route, Users, Workflow, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const links = [
  { href: '/admin', label: 'Painel', icon: LayoutDashboard },
  { href: '/admin/jornada', label: 'Sua jornada', icon: Route },
  { href: '/admin/conversas', label: 'Conversas', icon: MessageCircle },
  { href: '/admin/monitor', label: 'Monitor de chat', icon: MonitorDot },
  { href: '/admin/agentes', label: 'Agentes', icon: Workflow },
  { href: '/admin/clientes', label: 'Clientes', icon: Users },
  { href: '/admin/agenda', label: 'Agenda', icon: CalendarDays },
  { href: '/admin/funil', label: 'Funil', icon: Columns3 },
  { href: '/admin/tarefas', label: 'Tarefas', icon: ListTodo },
  { href: '/admin/campanhas', label: 'Campanhas', icon: Megaphone },
  { href: '/admin/relatorios', label: 'Relatórios', icon: ChartColumn },
  { href: '/admin/automacoes', label: 'Automações', icon: Zap },
  { href: '/admin/ajuda', label: 'Ajuda', icon: CircleHelp },
]

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function logout() {
    await createClient().auth.signOut()
    router.replace('/admin/login')
    router.refresh()
  }

  return (
    <>
      <div className="crm-mobile-bar">
        <button onClick={() => setOpen(!open)} aria-label="Abrir menu"><Menu size={22} /></button>
        <strong>Zafine CRM</strong>
      </div>
      <aside className={`crm-sidebar ${open ? 'open' : ''}`}>
        <span className="brand"><span className="brand-mark small">Z</span><span><strong>Zafine</strong><small>CRM</small></span></span>
        <nav>
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === '/admin' ? pathname === href : pathname.startsWith(href)
            return (
              <Link key={href} href={href} className={`crm-nav-link ${active ? 'active' : ''}`} onClick={() => setOpen(false)}>
                <Icon size={18} /> {label}
              </Link>
            )
          })}
        </nav>
        <div className="crm-sidebar-footer">
          <span>{email}</span>
          <button onClick={logout}><LogOut size={15} /> Sair</button>
        </div>
      </aside>
    </>
  )
}
