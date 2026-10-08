import Link from 'next/link'
import { type Appointment, type Client, formatPhone, stages, whatsappUrl } from '@/lib/crm'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const weekEnd = new Date(now.getTime() + 7 * 86400000).toISOString()

  const [{ data: clients }, { data: upcoming }, { count: aiReplies }] = await Promise.all([
    supabase.from('clients').select('id, name, phone, stage, interest, created_at, ai_paused, updated_at'),
    supabase
      .from('appointments')
      .select('*, clients(name, phone)')
      .gte('starts_at', now.toISOString())
      .lte('starts_at', weekEnd)
      .not('status', 'eq', 'cancelado')
      .order('starts_at'),
    supabase.from('whatsapp_messages').select('id', { count: 'exact', head: true }).eq('from_ai', true).gte('created_at', monthStart),
  ])

  const all = (clients ?? []) as Client[]
  const sessions = (upcoming ?? []) as Appointment[]
  const monthLeads = all.filter((c) => c.created_at >= monthStart)
  const monthClosed = monthLeads.filter((c) => c.stage === 'fechado').length
  const conversion = monthLeads.length ? Math.round((monthClosed / monthLeads.length) * 100) : 0
  const waitingHuman = all.filter((c) => c.ai_paused && c.stage !== 'fechado' && c.stage !== 'perdido')

  const byStage = stages.map((s) => ({ ...s, count: all.filter((c) => c.stage === s.value).length }))
  const interestCounts = Object.entries(
    all.reduce<Record<string, number>>((acc, c) => {
      if (c.interest) acc[c.interest] = (acc[c.interest] ?? 0) + 1
      return acc
    }, {}),
  ).sort((a, b) => b[1] - a[1])
  const maxStage = Math.max(1, ...byStage.map((s) => s.count))
  const maxInterest = Math.max(1, ...interestCounts.map(([, n]) => n))

  return (
    <>
      <div className="crm-header">
        <div>
          <h1>Painel</h1>
          <p>{now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
      </div>

      <div className="crm-grid cols-4" style={{ marginBottom: 16 }}>
        <div className="crm-card crm-stat"><span>Leads no mês</span><strong>{monthLeads.length}</strong><small>{all.length} contatos no total</small></div>
        <div className="crm-card crm-stat"><span>Conversão do mês</span><strong>{conversion}%</strong><small>{monthClosed} viraram clientes</small></div>
        <div className="crm-card crm-stat"><span>Sessões em 7 dias</span><strong>{sessions.length}</strong><small>{sessions.filter((a) => a.created_by === 'agente').length} marcadas pelo agente 🤖</small></div>
        <div className="crm-card crm-stat"><span>Respostas automáticas</span><strong>{aiReplies ?? 0}</strong><small>neste mês</small></div>
      </div>

      <div className="crm-grid cols-2">
        <div className="crm-card">
          <h2>Próximas sessões</h2>
          {sessions.length === 0 ? <p className="crm-empty">Nenhuma sessão nos próximos 7 dias.</p> : (
            <ul className="crm-list">
              {sessions.slice(0, 8).map((a) => (
                <li key={a.id}>
                  <div>
                    <div className="crm-name">{a.clients?.name}</div>
                    <div className="crm-sub">{a.treatment}{a.professional ? ` · ${a.professional}` : ''}{a.created_by === 'agente' ? ' · 🤖 agente' : ''}</div>
                  </div>
                  <span className="crm-sub">{new Date(a.starts_at).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                </li>
              ))}
            </ul>
          )}
          <Link className="crm-btn ghost" href="/admin/agenda">Ver agenda →</Link>
        </div>

        <div className="crm-card">
          <h2>Aguardando atendente ({waitingHuman.length})</h2>
          {waitingHuman.length === 0 ? <p className="crm-empty">Ninguém esperando atendimento. 🙂</p> : (
            <ul className="crm-list">
              {waitingHuman.slice(0, 8).map((c) => (
                <li key={c.id}>
                  <div>
                    <div className="crm-name">{c.name}</div>
                    <div className="crm-sub">{formatPhone(c.phone)}</div>
                  </div>
                  <a className="crm-btn secondary" href={whatsappUrl(c.phone)} target="_blank" rel="noreferrer">Abrir WhatsApp</a>
                </li>
              ))}
            </ul>
          )}
          <Link className="crm-btn ghost" href="/admin/conversas">Ver conversas →</Link>
        </div>

        <div className="crm-card">
          <h2>Funil</h2>
          <ul className="crm-list">
            {byStage.map((s) => (
              <li key={s.value} style={{ display: 'block' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{s.label}</span><strong>{s.count}</strong></div>
                <div className="crm-bar"><span style={{ width: `${(s.count / maxStage) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </div>

        <div className="crm-card">
          <h2>Interesse por tratamento</h2>
          {interestCounts.length === 0 ? <p className="crm-empty">Preencha o interesse nos cadastros para ver este gráfico.</p> : (
            <ul className="crm-list">
              {interestCounts.map(([name, n]) => (
                <li key={name} style={{ display: 'block' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{name}</span><strong>{n}</strong></div>
                  <div className="crm-bar"><span style={{ width: `${(n / maxInterest) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}
