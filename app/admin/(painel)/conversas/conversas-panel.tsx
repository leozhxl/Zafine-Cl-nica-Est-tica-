'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Send, Trash2 } from 'lucide-react'
import { type AiSettings, type Client, type WhatsappMessage, formatPhone } from '@/lib/crm'
import { type Agent, blockInfo } from '@/lib/agent-flow'
import { createClient } from '@/lib/supabase/client'
import { sendManualMessage } from './actions'

type Status = { anthropic: boolean; whatsapp: boolean; webhook: boolean; serviceRole: boolean }
export type Tab = 'conversas' | 'ia' | 'conexao'

const tabs: { value: Tab; label: string }[] = [
  { value: 'conversas', label: 'Conversas' },
  { value: 'ia', label: 'IA e roteiro' },
  { value: 'conexao', label: 'Conexão com o WhatsApp' },
]

export function ConversasPanel({ status, webhookUrl, initialTab, initialClient }: { status: Status; webhookUrl: string; initialTab: Tab; initialClient?: string }) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [settings, setSettings] = useState<AiSettings | null>(null)

  useEffect(() => {
    createClient().from('ai_settings').select('*').eq('id', 1).single().then(({ data }) => setSettings(data as AiSettings))
  }, [])

  const connected = status.whatsapp && status.webhook && status.serviceRole

  return (
    <>
      <div className="crm-header">
        <div>
          <h1>Conversas</h1>
          <p>Acompanhe e responda as clientes do WhatsApp. O atendimento automático é montado em <a href="/admin/agentes" style={{ color: 'var(--blue)' }}>Agentes</a>. <a href="/admin/ajuda#conversas" style={{ color: 'var(--blue)' }}>Ajuda</a></p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span className={`crm-badge ${connected ? 'fechado' : 'perdido'}`}>{connected ? 'WhatsApp conectado' : 'WhatsApp não conectado'}</span>
          {settings && <span className={`crm-badge ${settings.enabled ? 'fechado' : 'perdido'}`}>{settings.enabled ? 'IA ligada' : 'IA desligada'}</span>}
        </div>
      </div>

      <div className="crm-tabs">
        {tabs.map((t) => <button key={t.value} className={tab === t.value ? 'active' : ''} onClick={() => setTab(t.value)}>{t.label}</button>)}
      </div>

      {tab === 'conversas' && <ConversationsTab initialClient={initialClient} />}
      {tab === 'ia' && (settings ? <ConfigTab settings={settings} onChange={setSettings} status={status} /> : <p className="crm-empty">Carregando…</p>)}
      {tab === 'conexao' && <div style={{ maxWidth: 720 }}><IntegrationCard status={status} webhookUrl={webhookUrl} /></div>}
    </>
  )
}


function IntegrationCard({ status, webhookUrl }: { status: Status; webhookUrl: string }) {
  return (
    <div className="crm-card">
      <h2>Conexão com o WhatsApp</h2>
      <div className="crm-status"><span className={`crm-dot ${status.whatsapp ? 'on' : ''}`} /> WhatsApp Cloud API (WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID)</div>
      <div className="crm-status"><span className={`crm-dot ${status.webhook ? 'on' : ''}`} /> Webhook (WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET)</div>
      <div className="crm-status"><span className={`crm-dot ${status.serviceRole ? 'on' : ''}`} /> Supabase service role (SUPABASE_SERVICE_ROLE_KEY)</div>
      <p className="crm-sub" style={{ margin: '16px 0 6px' }}>URL do webhook para cadastrar no painel da Meta (campo <b>messages</b>):</p>
      <div className="crm-code">{webhookUrl}</div>
      <p className="crm-sub" style={{ marginTop: 14, lineHeight: 1.6 }}>
        As chaves ficam nas variáveis de ambiente do servidor (Vercel → Settings → Environment Variables), nunca no banco. Depois de alterar, faça um novo deploy.
      </p>
    </div>
  )
}

function ConfigTab({ settings, onChange, status }: { settings: AiSettings; onChange: (s: AiSettings) => void; status: Status }) {
  const [form, setForm] = useState(settings)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof AiSettings>(key: K, value: AiSettings[K]) => setForm((f) => ({ ...f, [key]: value }))
  // As colunas do roteiro só existem depois de rodar supabase/roteiro.sql.
  const hasScript = 'script_steps' in settings

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    const { error } = await createClient().from('ai_settings').update({ ...form, updated_at: new Date().toISOString() }).eq('id', 1)
    setSaving(false)
    if (error) return setMessage({ type: 'error', text: error.message })
    onChange(form)
    setMessage({ type: 'ok', text: 'Configurações salvas.' })
  }

  return (
    <div className="crm-grid cols-2" style={{ alignItems: 'start' }}>
      <form className="crm-card" onSubmit={save}>
        <h2>IA (opcional)</h2>
        {message && <div className={`crm-alert ${message.type}`}>{message.text}</div>}
        {form.enabled && !status.anthropic && <div className="crm-alert">A IA está ligada, mas falta a chave da API do Claude.</div>}
        <div className="crm-form">
          <label className="crm-check full"><input type="checkbox" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} /> <strong>Ligar a IA</strong></label>
          <label className="crm-field full">Nome da assistente<input value={form.assistant_name} onChange={(e) => set('assistant_name', e.target.value)} /></label>
          <label className="crm-field full">Instruções e tom de voz
            <small>Como ela deve se comportar, o que deve ou não falar, qual o objetivo da conversa.</small>
            <textarea rows={6} value={form.instructions} onChange={(e) => set('instructions', e.target.value)} />
          </label>
        </div>

        <h2 style={{ marginTop: 26 }}>Roteiro da conversa</h2>
        {!hasScript ? (
          <div className="crm-alert">Para montar o roteiro, rode o arquivo <b>supabase/roteiro.sql</b> no SQL Editor do Supabase e recarregue a página.</div>
        ) : (
          <>
            <p className="crm-sub" style={{ margin: '0 0 12px', lineHeight: 1.6 }}>
              <b>Etapas:</b> a sequência que a IA segue em toda conversa, uma etapa por vez. Se a cliente perguntar algo no meio, a IA responde e volta para o roteiro.
            </p>
            <ListEditor
              items={form.script_steps ?? []}
              onChange={(items) => set('script_steps', items)}
              empty={{ title: '', instruction: '' }}
              addLabel="Adicionar etapa"
              render={(step, update) => (
                <>
                  <input value={step.title} onChange={(e) => update({ title: e.target.value })} placeholder="Nome da etapa (ex.: Perguntar o nome)" />
                  <textarea rows={2} value={step.instruction} onChange={(e) => update({ instruction: e.target.value })} placeholder="O que a IA deve fazer ou dizer nesta etapa" style={{ marginTop: 8 }} />
                </>
              )}
            />

            <p className="crm-sub" style={{ margin: '22px 0 12px', lineHeight: 1.6 }}>
              <b>Respostas prontas:</b> quando a cliente perguntar algo parecido, a IA responde com o seu texto.
            </p>
            <ListEditor
              items={form.faq ?? []}
              onChange={(items) => set('faq', items)}
              empty={{ question: '', answer: '' }}
              addLabel="Adicionar resposta pronta"
              render={(item, update) => (
                <>
                  <input value={item.question} onChange={(e) => update({ question: e.target.value })} placeholder="Pergunta da cliente (ex.: Quanto custa?)" />
                  <textarea rows={3} value={item.answer} onChange={(e) => update({ answer: e.target.value })} placeholder="Resposta que a IA deve dar" style={{ marginTop: 8 }} />
                </>
              )}
            />
          </>
        )}

        <h2 style={{ marginTop: 26 }}>Informações e regras</h2>
        <div className="crm-form">
          <label className="crm-field full">Informações da clínica
            <small>Tratamentos, preços, endereço, horários, formas de pagamento, perguntas frequentes. A IA só responde com base no que estiver aqui.</small>
            <textarea rows={12} value={form.knowledge} onChange={(e) => set('knowledge', e.target.value)} />
          </label>
          <label className="crm-field full">Mensagem ao passar para atendente
            <small>A IA usa algo parecido quando a cliente pede uma pessoa, quer marcar horário ou faz uma reclamação. Depois disso, a IA fica pausada para esse contato.</small>
            <textarea rows={2} value={form.handoff_message} onChange={(e) => set('handoff_message', e.target.value)} />
          </label>
          <label className="crm-check full"><input type="checkbox" checked={form.outside_hours_only} onChange={(e) => set('outside_hours_only', e.target.checked)} /> Responder só fora do horário de atendimento</label>
          <label className="crm-field">Abre às<input type="time" value={form.hours_start.slice(0, 5)} onChange={(e) => set('hours_start', e.target.value)} /></label>
          <label className="crm-field">Fecha às<input type="time" value={form.hours_end.slice(0, 5)} onChange={(e) => set('hours_end', e.target.value)} /></label>
          <small className="crm-sub full">Horário de Brasília, de segunda a sábado. Aos domingos a clínica é considerada fechada.</small>
        </div>
        <div className="crm-modal-foot"><div><button className="crm-btn" disabled={saving}>{saving ? 'Salvando…' : 'Salvar configurações'}</button></div></div>
      </form>

      <div className="crm-card">
        <h2>Sobre a IA</h2>
        <div className="crm-status"><span className={`crm-dot ${status.anthropic ? 'on' : ''}`} /> Chave da API do Claude (ANTHROPIC_API_KEY)</div>
        <p className="crm-sub" style={{ marginTop: 12, lineHeight: 1.6 }}>
          A IA é opcional e paga por uso (créditos na Anthropic). Ela responde nos blocos “Resposta com IA” dos agentes e, quando não há agente ativo (ou ele não responde), responde sozinha usando este roteiro.
        </p>
        <h2 style={{ marginTop: 20 }}>Dicas para o roteiro</h2>
        <ul className="crm-sub" style={{ lineHeight: 1.7, paddingLeft: 18, margin: 0 }}>
          <li>Escreva cada etapa como uma ordem curta: “Pergunte…”, “Explique…”, “Convide…”.</li>
          <li>Na etapa em que a equipe deve assumir, escreva “passe para uma atendente”.</li>
          <li>Use as respostas prontas para o que precisa ser dito sempre do mesmo jeito, como preços, promoções e políticas.</li>
          <li>Para testar, use um bloco “Resposta com IA” na aba Testar do editor de agentes (precisa de créditos na Anthropic).</li>
        </ul>
      </div>
    </div>
  )
}

function ListEditor<T>({ items, onChange, empty, addLabel, render }: {
  items: T[]
  onChange: (items: T[]) => void
  empty: T
  addLabel: string
  render: (item: T, update: (patch: Partial<T>) => void) => React.ReactNode
}) {
  const move = (index: number, delta: number) => {
    const next = [...items]
    const [item] = next.splice(index, 1)
    next.splice(index + delta, 0, item)
    onChange(next)
  }
  return (
    <>
      {items.map((item, i) => (
        <div key={i} className="crm-card" style={{ padding: 14, marginBottom: 10, background: '#fafcfc', display: 'flex', gap: 10 }}>
          <span className="crm-badge" style={{ alignSelf: 'flex-start', marginTop: 8 }}>{i + 1}</span>
          <div style={{ flex: 1, minWidth: 0 }}>{render(item, (patch) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it))))}</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <button type="button" className="crm-icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir"><ArrowUp size={15} /></button>
            <button type="button" className="crm-icon-btn" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Descer"><ArrowDown size={15} /></button>
            <button type="button" className="crm-icon-btn" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remover"><Trash2 size={15} /></button>
          </div>
        </div>
      ))}
      <button type="button" className="crm-btn secondary" onClick={() => onChange([...items, { ...empty }])}><Plus size={15} /> {addLabel}</button>
    </>
  )
}

type Thread = { client: Pick<Client, 'id' | 'name' | 'phone' | 'ai_paused'>; last: WhatsappMessage }

function ConversationsTab({ initialClient }: { initialClient?: string }) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [selected, setSelected] = useState<string | null>(initialClient ?? null)
  const [messages, setMessages] = useState<WhatsappMessage[]>([])
  const [reply, setReply] = useState('')
  const [error, setError] = useState('')

  const loadThreads = useCallback(async () => {
    const { data } = await createClient()
      .from('whatsapp_messages')
      .select('*, clients(id, name, phone, ai_paused)')
      .order('created_at', { ascending: false })
      .limit(500)
    const seen = new Map<string, Thread>()
    for (const m of (data ?? []) as (WhatsappMessage & { clients: Thread['client'] | null })[]) {
      if (m.clients && !seen.has(m.clients.id)) seen.set(m.clients.id, { client: m.clients, last: m })
    }
    setThreads([...seen.values()])
  }, [])

  const loadMessages = useCallback(async (clientId: string) => {
    const { data } = await createClient().from('whatsapp_messages').select('*').eq('client_id', clientId).order('created_at').limit(200)
    setMessages((data ?? []) as WhatsappMessage[])
  }, [])

  useEffect(() => {
    loadThreads()
    const timer = setInterval(() => {
      loadThreads()
      if (selected) loadMessages(selected)
    }, 15000)
    return () => clearInterval(timer)
  }, [loadThreads, loadMessages, selected])

  useEffect(() => { if (selected) loadMessages(selected) }, [selected, loadMessages])

  // Em qual bloco do agente a cliente está.
  const [agentStatus, setAgentStatus] = useState('')
  useEffect(() => {
    setAgentStatus('')
    if (!selected) return
    createClient().from('agent_runs').select('status, node_id, wait_until, agents(name, flow)').eq('client_id', selected).maybeSingle().then(({ data }) => {
      const run = data as { status: string; node_id: string | null; wait_until: string | null; agents: Pick<Agent, 'name' | 'flow'> | null } | null
      if (!run?.agents) return
      if (run.status === 'done') return setAgentStatus(`Agente “${run.agents.name}”: fluxo concluído`)
      const node = run.agents.flow.nodes.find((n) => n.id === run.node_id)
      const until = run.wait_until ? ` até ${new Date(run.wait_until).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''
      setAgentStatus(`Agente “${run.agents.name}”: ${node ? blockInfo[node.data.kind].label.toLowerCase() : 'aguardando'}${until}`)
    })
  }, [selected, messages.length])

  const current = threads.find((t) => t.client.id === selected)?.client

  async function toggleAi() {
    if (!current) return
    await createClient().from('clients').update({ ai_paused: !current.ai_paused, updated_at: new Date().toISOString() }).eq('id', current.id)
    loadThreads()
  }

  async function send(event: React.FormEvent) {
    event.preventDefault()
    if (!current || !reply.trim()) return
    setError('')
    const result = await sendManualMessage(current.id, reply.trim())
    if (!result.ok) return setError(result.error)
    setReply('')
    loadMessages(current.id)
  }

  return (
    <div className="crm-grid" style={{ gridTemplateColumns: 'minmax(220px, 320px) 1fr', alignItems: 'start' }}>
      <div className="crm-card" style={{ padding: 8 }}>
        {threads.length === 0 && <p className="crm-empty">Nenhuma conversa ainda. Elas aparecem aqui quando clientes escreverem no WhatsApp.</p>}
        <ul className="crm-list">
          {threads.map(({ client, last }) => (
            <li key={client.id} onClick={() => setSelected(client.id)} style={{ cursor: 'pointer', padding: '10px 12px', borderRadius: 8, background: selected === client.id ? '#eef4f5' : undefined }}>
              <div style={{ minWidth: 0 }}>
                <div className="crm-name">{client.name} {client.ai_paused && <span title="Atendimento humano">👤</span>}</div>
                <div className="crm-sub" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{last.direction === 'out' ? 'Você: ' : ''}{last.body}</div>
              </div>
              <span className="crm-sub">{new Date(last.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="crm-card">
        {!current ? <p className="crm-empty">Selecione uma conversa.</p> : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <div><div className="crm-name">{current.name}</div><div className="crm-sub">{formatPhone(current.phone)}{agentStatus && ` · ${agentStatus}`}</div></div>
              <button className="crm-btn secondary" onClick={toggleAi}>{current.ai_paused ? 'Devolver para o robô' : 'Assumir atendimento'}</button>
            </div>
            {error && <div className="crm-alert error">{error}</div>}
            <div className="crm-chat">
              {messages.map((m) => (
                <div key={m.id} className={`crm-bubble ${m.direction}`}>
                  {m.body}
                  <small>{m.direction === 'out' ? (m.from_ai ? 'Robô · ' : 'Equipe · ') : ''}{new Date(m.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small>
                </div>
              ))}
            </div>
            <form className="crm-chat-input" onSubmit={send}>
              <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Responder pelo WhatsApp" />
              <button className="crm-btn"><Send size={15} /></button>
            </form>
            <p className="crm-sub" style={{ marginTop: 8 }}>O WhatsApp só permite mensagens livres até 24h depois da última mensagem da cliente.</p>
          </>
        )}
      </div>
    </div>
  )
}
