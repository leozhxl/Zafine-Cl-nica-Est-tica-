'use client'

import { useCallback, useEffect, useState } from 'react'
import { appointmentStatuses, stages } from '@/lib/crm'
import { createClient } from '@/lib/supabase/client'

const DAY = 86400000
const periods = [{ days: 7, label: '7 dias' }, { days: 30, label: '30 dias' }, { days: 90, label: '90 dias' }]

type Data = {
  leadsByDay: { date: string; count: number }[]
  sources: [string, number][]
  funnel: [string, number][]
  services: [string, number][]
  statuses: [string, number][]
  bookedBy: [string, number][]
  kpis: { leads: number; won: number; booked: number; bookedByAgent: number; attendance: number | null; inbound: number; automatic: number; automations: number; campaignSent: number }
}

const countBy = <T,>(items: T[], key: (item: T) => string) =>
  Object.entries(items.reduce<Record<string, number>>((acc, i) => { const k = key(i); acc[k] = (acc[k] ?? 0) + 1; return acc }, {})).sort((a, b) => b[1] - a[1])

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function RelatoriosPage() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setData(null)
    const supabase = createClient()
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setTime(start.getTime() - (days - 1) * DAY)
    const since = start.toISOString()
    const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0)

    const [leads, allClients, won, booked, held, inbound, automatic, automations, campaignSent] = await Promise.all([
      supabase.from('clients').select('created_at, source').gte('created_at', since),
      supabase.from('clients').select('stage'),
      count(supabase.from('client_stage_changes').select('id', { count: 'exact', head: true }).eq('to_stage', 'fechado').gte('created_at', since)),
      supabase.from('appointments').select('created_by').gte('created_at', since),
      supabase.from('appointments').select('treatment, status').gte('starts_at', since).lte('starts_at', new Date().toISOString()),
      count(supabase.from('whatsapp_messages').select('id', { count: 'exact', head: true }).eq('direction', 'in').gte('created_at', since)),
      count(supabase.from('whatsapp_messages').select('id', { count: 'exact', head: true }).eq('from_ai', true).gte('created_at', since)),
      count(supabase.from('automation_log').select('id', { count: 'exact', head: true }).eq('status', 'ok').gte('created_at', since)),
      count(supabase.from('campaign_recipients').select('id', { count: 'exact', head: true }).eq('status', 'enviado').gte('sent_at', since)),
    ])
    if (leads.error) return setError(leads.error.message)

    const leadsByDay = Array.from({ length: days }, (_, i) => {
      const key = dayKey(new Date(start.getTime() + i * DAY))
      return { date: key, count: (leads.data ?? []).filter((c) => dayKey(new Date(c.created_at)) === key).length }
    })
    const done = (held.data ?? []).filter((a) => a.status === 'realizado').length
    const missed = (held.data ?? []).filter((a) => a.status === 'faltou').length
    const bookedRows = booked.data ?? []

    setData({
      leadsByDay,
      sources: countBy(leads.data ?? [], (c) => c.source),
      funnel: stages.map((s) => [s.label, (allClients.data ?? []).filter((c) => c.stage === s.value).length]),
      services: countBy(held.data ?? [], (a) => a.treatment),
      statuses: appointmentStatuses.map((s) => [s.label, (held.data ?? []).filter((a) => a.status === s.value).length] as [string, number]).filter(([, n]) => n),
      bookedBy: [['Agente 🤖', bookedRows.filter((a) => a.created_by === 'agente').length], ['Equipe', bookedRows.filter((a) => a.created_by !== 'agente').length]],
      kpis: {
        leads: leads.data?.length ?? 0,
        won,
        booked: bookedRows.length,
        bookedByAgent: bookedRows.filter((a) => a.created_by === 'agente').length,
        attendance: done + missed ? Math.round((done / (done + missed)) * 100) : null,
        inbound,
        automatic,
        automations,
        campaignSent,
      },
    })
  }, [days])

  useEffect(() => { load() }, [load])

  return (
    <>
      <div className="crm-header">
        <div><h1>Relatórios</h1><p>Como estão os leads, o funil e a agenda no período.</p></div>
        <div className="crm-segmented" role="group" aria-label="Período">
          {periods.map((p) => <button key={p.days} className={days === p.days ? 'active' : ''} onClick={() => setDays(p.days)}>{p.label}</button>)}
        </div>
      </div>
      {error && <div className="crm-alert error">{error}</div>}
      {!data ? <p className="crm-empty">Carregando…</p> : (
        <>
          <div className="crm-grid cols-4" style={{ marginBottom: 16 }}>
            <div className="crm-card crm-stat"><span>Novos leads</span><strong>{data.kpis.leads}</strong><small>{data.kpis.won} viraram clientes no período</small></div>
            <div className="crm-card crm-stat"><span>Sessões agendadas</span><strong>{data.kpis.booked}</strong><small>{data.kpis.bookedByAgent} pelo agente 🤖</small></div>
            <div className="crm-card crm-stat"><span>Comparecimento</span><strong>{data.kpis.attendance === null ? '—' : `${data.kpis.attendance}%`}</strong><small>realizadas ÷ (realizadas + faltas)</small></div>
            <div className="crm-card crm-stat"><span>WhatsApp</span><strong>{data.kpis.inbound}</strong><small>mensagens recebidas · {data.kpis.automatic} respostas automáticas</small></div>
          </div>

          <div className="crm-card" style={{ marginBottom: 16 }}>
            <h2>Novos leads por dia</h2>
            <ColumnChart data={data.leadsByDay} />
          </div>

          <div className="crm-grid cols-2">
            <BarList title="Funil hoje" subtitle="Quantas clientes estão em cada etapa agora" rows={data.funnel} />
            <BarList title="Origem dos novos leads" rows={data.sources} empty="Nenhum lead no período." />
            <BarList title="Sessões por serviço" subtitle="Sessões que já aconteceram no período" rows={data.services} empty="Nenhuma sessão no período." />
            <BarList title="Sessões por status" subtitle="Sessões que já aconteceram no período" rows={data.statuses} empty="Nenhuma sessão no período." />
            <BarList title="Quem agendou" subtitle="Sessões criadas no período" rows={data.bookedBy} />
            <div className="crm-card">
              <h2>Automação e campanhas</h2>
              <ul className="crm-list">
                <li><span>Automações executadas</span><strong>{data.kpis.automations}</strong></li>
                <li><span>Mensagens de campanha enviadas</span><strong>{data.kpis.campaignSent}</strong></li>
                <li><span>Respostas automáticas (agente, IA, automações)</span><strong>{data.kpis.automatic}</strong></li>
              </ul>
            </div>
          </div>
        </>
      )}
    </>
  )
}

function BarList({ title, subtitle, rows, empty }: { title: string; subtitle?: string; rows: [string, number][]; empty?: string }) {
  const max = Math.max(1, ...rows.map(([, n]) => n))
  const total = rows.reduce((s, [, n]) => s + n, 0)
  return (
    <div className="crm-card">
      <h2 style={{ marginBottom: subtitle ? 2 : 14 }}>{title}</h2>
      {subtitle && <p className="crm-sub" style={{ margin: '0 0 12px' }}>{subtitle}</p>}
      {!total && empty ? <p className="crm-empty">{empty}</p> : (
        <ul className="crm-list">
          {rows.map(([label, n]) => (
            <li key={label} style={{ display: 'block' }} title={`${label}: ${n}${total ? ` (${Math.round((n / total) * 100)}%)` : ''}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{label}</span><strong>{n}</strong></div>
              <div className="crm-bar"><span style={{ width: `${(n / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ColumnChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  const total = data.reduce((s, d) => s + d.count, 0)
  const labelEvery = data.length > 31 ? 14 : data.length > 7 ? 5 : 1
  const fmt = (date: string) => date.split('-').reverse().slice(0, 2).join('/')
  if (!total) return <p className="crm-empty">Nenhum lead no período.</p>
  return (
    <div className="crm-columns" role="img" aria-label={`Novos leads por dia: ${total} no total`}>
      <div className="crm-columns-plot">
        {data.map((d) => (
          <div key={d.date} className="crm-column-bar" data-tip={`${fmt(d.date)}: ${d.count} lead${d.count === 1 ? '' : 's'}`}>
            <span style={{ height: `${(d.count / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="crm-columns-axis">
        {data.map((d, i) => <span key={d.date}>{i % labelEvery === 0 || i === data.length - 1 ? fmt(d.date) : ''}</span>)}
      </div>
      <p className="crm-sub" style={{ margin: '8px 0 0' }}>Máximo de {max} por dia · {total} no período. Passe o mouse nas barras para ver cada dia.</p>
    </div>
  )
}
