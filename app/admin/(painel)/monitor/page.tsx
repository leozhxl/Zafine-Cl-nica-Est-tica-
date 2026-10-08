'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { type Agent, blockInfo } from '@/lib/agent-flow'
import { type Client, type WhatsappMessage, formatPhone } from '@/lib/crm'
import { createClient } from '@/lib/supabase/client'

type Row = {
  client: Pick<Client, 'id' | 'name' | 'phone' | 'ai_paused'>
  last: WhatsappMessage
  lastIn: WhatsappMessage | null
  run: { status: string; node_id: string | null; wait_until: string | null; agents: Pick<Agent, 'name' | 'flow'> | null } | null
}

const HOUR = 3600000

function ago(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  return `há ${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`
}

/** Quanto falta para fechar a janela de 24h do WhatsApp (a partir da última mensagem da cliente). */
function windowLeft(lastIn: WhatsappMessage | null) {
  if (!lastIn) return null
  const left = new Date(lastIn.created_at).getTime() + 24 * HOUR - Date.now()
  return left > 0 ? left : 0
}

export default function MonitorPage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [updated, setUpdated] = useState<Date | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const since = new Date(Date.now() - 24 * HOUR).toISOString()
    const { data: messages } = await supabase.from('whatsapp_messages').select('*, clients(id, name, phone, ai_paused)').gte('created_at', since).order('created_at', { ascending: false }).limit(1000)
    const map = new Map<string, Row>()
    for (const m of (messages ?? []) as (WhatsappMessage & { clients: Row['client'] | null })[]) {
      if (!m.clients) continue
      const row = map.get(m.clients.id) ?? { client: m.clients, last: m, lastIn: null, run: null }
      if (!row.lastIn && m.direction === 'in') row.lastIn = m
      map.set(m.clients.id, row)
    }
    const ids = [...map.keys()]
    if (ids.length) {
      const { data: runs } = await supabase.from('agent_runs').select('client_id, status, node_id, wait_until, agents(name, flow)').in('client_id', ids)
      for (const r of (runs ?? []) as unknown as (Row['run'] & { client_id: string })[]) {
        const row = map.get(r.client_id)
        if (row) row.run = r
      }
    }
    setRows([...map.values()])
    setUpdated(new Date())
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [load])

  const list = rows ?? []
  // Atendimento humano; esperando a clínica (última mensagem é da cliente); com o robô; respondidas.
  const human = list.filter((r) => r.client.ai_paused)
  const waiting = list.filter((r) => !r.client.ai_paused && r.last.direction === 'in')
  const bot = list.filter((r) => !r.client.ai_paused && r.last.direction === 'out' && r.run?.status === 'waiting')
  const answered = list.filter((r) => !r.client.ai_paused && r.last.direction === 'out' && r.run?.status !== 'waiting')

  const columns = [
    { title: '👤 Atendimento humano', hint: 'A equipe assumiu. O robô está pausado.', rows: human },
    { title: '⏳ Sem resposta', hint: 'A última mensagem é da cliente.', rows: waiting },
    { title: '🤖 Com o robô', hint: 'O agente está esperando a resposta dela.', rows: bot },
    { title: '✅ Respondidas', hint: 'Conversa sem pendência.', rows: answered },
  ]

  return (
    <>
      <div className="crm-header">
        <div>
          <h1>Monitor de chat</h1>
          <p>Conversas das últimas 24 horas, atualizadas a cada 10 segundos{updated && ` · última atualização ${updated.toLocaleTimeString('pt-BR')}`}.</p>
        </div>
      </div>

      <div className="crm-grid cols-4" style={{ marginBottom: 16 }}>
        {columns.map((c) => <div key={c.title} className="crm-card crm-stat"><span>{c.title}</span><strong>{c.rows.length}</strong><small>{c.hint}</small></div>)}
      </div>

      {rows && list.length === 0 && <div className="crm-card"><p className="crm-empty">Nenhuma conversa nas últimas 24 horas.</p></div>}

      {list.length > 0 && <div className="crm-kanban" style={{ gridTemplateColumns: 'repeat(4, minmax(230px, 1fr))' }}>
        {columns.map((c) => (
          <div key={c.title} className="crm-column" style={{ minHeight: 200 }}>
            <div className="crm-column-head">{c.title} <span>{c.rows.length}</span></div>
            {c.rows.map((r) => {
              const left = windowLeft(r.lastIn)
              const node = r.run?.agents?.flow.nodes.find((n) => n.id === r.run?.node_id)
              return (
                <Link key={r.client.id} href={`/admin/conversas?cliente=${r.client.id}`} className="crm-deal" style={{ display: 'block', cursor: 'pointer' }}>
                  <div className="crm-name">{r.client.name}</div>
                  <div className="crm-sub">{formatPhone(r.client.phone)}</div>
                  <div className="crm-sub" style={{ marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.last.direction === 'out' ? '↪ ' : ''}{r.last.body}</div>
                  <div className="crm-deal-foot">
                    <span>{ago(r.last.created_at)}</span>
                    {left !== null && <span style={{ color: left < 2 * HOUR ? 'var(--danger)' : undefined }} title="Tempo para responder com mensagem livre">{left ? `janela: ${Math.floor(left / HOUR)}h${String(Math.floor((left % HOUR) / 60000)).padStart(2, '0')}` : 'janela fechada'}</span>}
                  </div>
                  {node && r.run?.status === 'waiting' && <div className="crm-sub" style={{ marginTop: 4 }}>{r.run.agents?.name}: {blockInfo[node.data.kind].label.toLowerCase()}</div>}
                </Link>
              )
            })}
          </div>
        ))}
      </div>}
      <p className="crm-sub" style={{ marginTop: 12 }}>Clique numa conversa para abrir e responder. “Janela” é quanto tempo ainda dá para mandar mensagem livre (regra do WhatsApp: até 24h após a última mensagem da cliente).</p>
    </>
  )
}
