'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Pencil, Plus, Trash2, X, Zap } from 'lucide-react'
import { stageLabel, stages } from '@/lib/crm'
import { type ActionKind, type Automation, type TriggerKind, PLACEHOLDER_HELP, actionLabels, triggerLabels } from '@/lib/modules'
import { createClient } from '@/lib/supabase/client'

type LogRow = { id: string; status: 'ok' | 'erro'; detail: string | null; created_at: string; automations: { name: string } | null; clients: { name: string } | null }

const SUGGESTIONS: { name: string; description: string; data: Partial<Automation> }[] = [
  {
    name: 'Lembrete 24h antes da sessão',
    description: 'Manda um lembrete no WhatsApp um dia antes.',
    data: { trigger: 'before_appointment', trigger_config: { hours: 24 }, action: 'send_template', action_config: { template: 'lembrete_sessao', language: 'pt_BR', params: ['{nome}', '{servico}', '{data}', '{hora}'] } },
  },
  {
    name: 'Tarefa para cada lead novo',
    description: 'Cria uma tarefa para a equipe chamar o lead em até 2h.',
    data: { trigger: 'lead_created', trigger_config: {}, action: 'create_task', action_config: { title: 'Chamar o novo lead {nome}', due_hours: 2 } },
  },
  {
    name: 'Pós-sessão: pedir avaliação',
    description: 'Um dia depois da sessão realizada, cria tarefa de pós-venda.',
    data: { trigger: 'after_appointment', trigger_config: { hours: 24 }, action: 'create_task', action_config: { title: 'Pós-venda: perguntar como {nome} está após {servico}', due_hours: 24 } },
  },
  {
    name: 'Agendou → vira Avaliação no funil',
    description: 'Toda sessão agendada move a cliente para Avaliação.',
    data: { trigger: 'appointment_created', trigger_config: { created_by: '' }, action: 'set_stage', action_config: { stage: 'avaliacao' } },
  },
]

function describe(a: Automation) {
  const t = a.trigger_config
  const when = {
    lead_created: 'Novo lead',
    stage_changed: `Entrou em “${stageLabel(t.stage ?? 'novo')}”`,
    appointment_created: `Sessão agendada${t.created_by === 'agente' ? ' pelo agente' : t.created_by === 'equipe' ? ' pela equipe' : ''}`,
    before_appointment: `${t.hours ?? 24}h antes da sessão`,
    after_appointment: `${t.hours ?? 24}h depois da sessão realizada`,
  }[a.trigger]
  const c = a.action_config
  const what = {
    send_message: `envia “${(c.text ?? '').slice(0, 50)}${(c.text ?? '').length > 50 ? '…' : ''}”`,
    send_template: `envia o modelo “${c.template}”`,
    create_task: `cria a tarefa “${c.title}”`,
    set_stage: `move para “${stageLabel(c.stage ?? 'novo')}”`,
  }[a.action]
  return `${when} → ${what}`
}

export default function AutomacoesPage() {
  const [autos, setAutos] = useState<Automation[] | null>(null)
  const [log, setLog] = useState<LogRow[]>([])
  const [editing, setEditing] = useState<Partial<Automation> | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const supabase = createClient()
    const [a, l] = await Promise.all([
      supabase.from('automations').select('*').order('created_at'),
      supabase.from('automation_log').select('id, status, detail, created_at, automations(name), clients(name)').order('created_at', { ascending: false }).limit(30),
    ])
    if (a.error) return setError(a.error.code === 'PGRST205' ? 'missing' : a.error.message)
    setAutos((a.data ?? []) as Automation[])
    setLog((l.data ?? []) as unknown as LogRow[])
  }, [])

  useEffect(() => { load() }, [load])

  async function toggle(a: Automation) {
    const { error } = await createClient().from('automations').update({ enabled: !a.enabled, updated_at: new Date().toISOString() }).eq('id', a.id)
    if (error) setError(error.message)
    load()
  }

  async function remove(a: Automation) {
    if (!confirm(`Excluir a automação "${a.name}"?`)) return
    const { error } = await createClient().from('automations').delete().eq('id', a.id)
    if (error) setError(error.message)
    load()
  }

  if (error === 'missing') return <div className="crm-alert">Falta criar as tabelas: rode o arquivo <b>supabase/modulos.sql</b> no SQL Editor do Supabase e recarregue a página.</div>

  return (
    <>
      <div className="crm-header">
        <div><h1>Automações</h1><p>Regras do tipo “quando isso acontecer, faça aquilo”. Conferidas a cada minuto. <Link href="/admin/ajuda#automacoes" style={{ color: 'var(--blue)' }}>Como funciona?</Link></p></div>
        <button className="crm-btn" onClick={() => setEditing({ trigger: 'lead_created', trigger_config: {}, action: 'create_task', action_config: {} })}><Plus size={16} /> Nova automação</button>
      </div>
      {error && <div className="crm-alert error">{error}</div>}

      <div className="crm-grid cols-2" style={{ alignItems: 'start' }}>
        <div className="crm-grid">
          <div className="crm-card">
            <h2>Suas automações</h2>
            {!autos ? <p className="crm-empty">Carregando…</p> : autos.length === 0 ? <p className="crm-empty">Nenhuma automação ainda. Comece por uma sugestão ao lado.</p> : (
              <ul className="crm-list">
                {autos.map((a) => (
                  <li key={a.id}>
                    <div style={{ minWidth: 0 }}>
                      <div className="crm-name">{a.name}</div>
                      <div className="crm-sub">{describe(a)}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
                      <button className={`crm-badge ${a.enabled ? 'fechado' : 'perdido'}`} style={{ border: 0, cursor: 'pointer' }} onClick={() => toggle(a)}>{a.enabled ? 'Ligada' : 'Desligada'}</button>
                      <button className="crm-icon-btn" onClick={() => setEditing(a)} aria-label="Editar"><Pencil size={16} /></button>
                      <button className="crm-icon-btn" onClick={() => remove(a)} aria-label="Excluir"><Trash2 size={16} /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="crm-card">
            <h2>Últimas execuções</h2>
            {log.length === 0 ? <p className="crm-empty">Nada executado ainda.</p> : (
              <ul className="crm-list">
                {log.map((l) => (
                  <li key={l.id}>
                    <div style={{ minWidth: 0 }}>
                      <div className="crm-name">{l.automations?.name ?? 'Automação excluída'}{l.clients?.name ? ` · ${l.clients.name}` : ''}</div>
                      <div className="crm-sub" style={{ color: l.status === 'erro' ? 'var(--danger)' : undefined }}>{l.detail}</div>
                    </div>
                    <span className="crm-sub" style={{ flex: 'none' }}>{new Date(l.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="crm-card">
          <h2>Sugestões prontas</h2>
          <ul className="crm-list">
            {SUGGESTIONS.map((s) => (
              <li key={s.name}>
                <div><div className="crm-name"><Zap size={14} style={{ verticalAlign: -2, color: 'var(--warn)' }} /> {s.name}</div><div className="crm-sub">{s.description}</div></div>
                <button className="crm-btn secondary" onClick={() => setEditing({ name: s.name, ...s.data })}>Usar</button>
              </li>
            ))}
          </ul>
          <p className="crm-sub" style={{ marginTop: 12, lineHeight: 1.6 }}>
            Mensagens livres só chegam a quem escreveu para a clínica nas últimas 24h (regra do WhatsApp). Para lembretes e avisos, use um <b>modelo aprovado</b> no painel da Meta.
          </p>
        </div>
      </div>

      {editing && <AutomationModal automation={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
    </>
  )
}

function AutomationModal({ automation, onClose, onSaved }: { automation: Partial<Automation>; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<Automation>>({ enabled: true, name: '', ...automation, trigger_config: { ...automation.trigger_config }, action_config: { ...automation.action_config } })
  const [error, setError] = useState('')
  const tc = form.trigger_config ?? {}
  const ac = form.action_config ?? {}
  const setTc = (patch: Automation['trigger_config']) => setForm((f) => ({ ...f, trigger_config: { ...f.trigger_config, ...patch } }))
  const setAc = (patch: Automation['action_config']) => setForm((f) => ({ ...f, action_config: { ...f.action_config, ...patch } }))
  const params = ac.params ?? []

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (form.action === 'send_template' && !ac.template?.trim()) return setError('Informe o nome do modelo aprovado.')
    const payload = { name: form.name, enabled: form.enabled, trigger: form.trigger, trigger_config: tc, action: form.action, action_config: ac, updated_at: new Date().toISOString() }
    const supabase = createClient()
    const { error } = form.id ? await supabase.from('automations').update(payload).eq('id', form.id) : await supabase.from('automations').insert(payload)
    if (error) return setError(error.message)
    onSaved()
  }

  return (
    <div className="crm-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="crm-modal" onSubmit={save} style={{ width: 'min(680px, 100%)' }}>
        <div className="crm-modal-head">
          <h2>{form.id ? 'Editar automação' : 'Nova automação'}</h2>
          <button type="button" className="crm-icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        {error && <div className="crm-alert error">{error}</div>}
        <div className="crm-form">
          <label className="crm-field full">Nome<input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>

          <label className="crm-field full">Quando
            <select value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value as TriggerKind, trigger_config: {} })}>
              {Object.entries(triggerLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          {form.trigger === 'stage_changed' && (
            <label className="crm-field full">Etapa
              <select value={tc.stage ?? 'novo'} onChange={(e) => setTc({ stage: e.target.value as Automation['trigger_config']['stage'] })}>
                {stages.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          )}
          {form.trigger === 'appointment_created' && (
            <label className="crm-field full">Agendada por
              <select value={tc.created_by ?? ''} onChange={(e) => setTc({ created_by: e.target.value as '' | 'agente' | 'equipe' })}>
                <option value="">Qualquer um</option>
                <option value="agente">Só pelo agente</option>
                <option value="equipe">Só pela equipe</option>
              </select>
            </label>
          )}
          {(form.trigger === 'before_appointment' || form.trigger === 'after_appointment') && (
            <label className="crm-field full">Quantas horas {form.trigger === 'before_appointment' ? 'antes' : 'depois'}
              <input type="number" min={1} max={720} value={tc.hours ?? 24} onChange={(e) => setTc({ hours: Math.max(1, Number(e.target.value) || 24) })} />
              {form.trigger === 'after_appointment' && <small>Só vale para sessões com status “Realizado” na Agenda.</small>}
            </label>
          )}

          <label className="crm-field full">Faça
            <select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value as ActionKind, action_config: {} })}>
              {Object.entries(actionLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          {form.action === 'send_message' && (
            <label className="crm-field full">Mensagem
              <small>{PLACEHOLDER_HELP} Só chega se a cliente escreveu nas últimas 24h.</small>
              <textarea rows={4} value={ac.text ?? ''} onChange={(e) => setAc({ text: e.target.value })} required />
            </label>
          )}
          {form.action === 'send_template' && (
            <>
              <label className="crm-field">Nome do modelo na Meta<input value={ac.template ?? ''} onChange={(e) => setAc({ template: e.target.value })} placeholder="ex.: lembrete_sessao" /></label>
              <label className="crm-field">Idioma<input value={ac.language ?? 'pt_BR'} onChange={(e) => setAc({ language: e.target.value })} /></label>
              <div className="crm-field full">Variáveis do modelo ({'{{1}}'}, {'{{2}}'}…)
                <small>{PLACEHOLDER_HELP}</small>
                {params.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span className="crm-badge">{`{{${i + 1}}}`}</span>
                    <input value={p} onChange={(e) => setAc({ params: params.map((x, j) => (j === i ? e.target.value : x)) })} />
                    <button type="button" className="crm-icon-btn" onClick={() => setAc({ params: params.filter((_, j) => j !== i) })} aria-label="Remover"><Trash2 size={15} /></button>
                  </div>
                ))}
                <button type="button" className="crm-btn secondary" style={{ alignSelf: 'flex-start' }} onClick={() => setAc({ params: [...params, ''] })}><Plus size={15} /> Adicionar variável</button>
              </div>
            </>
          )}
          {form.action === 'create_task' && (
            <>
              <label className="crm-field full">Tarefa<small>{PLACEHOLDER_HELP}</small><input value={ac.title ?? ''} onChange={(e) => setAc({ title: e.target.value })} required /></label>
              <label className="crm-field full">Prazo (horas depois do evento)<input type="number" min={0} value={ac.due_hours ?? 0} onChange={(e) => setAc({ due_hours: Math.max(0, Number(e.target.value) || 0) })} /><small>0 = sem prazo.</small></label>
            </>
          )}
          {form.action === 'set_stage' && (
            <label className="crm-field full">Nova etapa
              <select value={ac.stage ?? 'novo'} onChange={(e) => setAc({ stage: e.target.value as Automation['action_config']['stage'] })}>
                {stages.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          )}

          <label className="crm-check full"><input type="checkbox" checked={!!form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Ligada</label>
          <small className="crm-sub full">Leads, mudanças de etapa e agendamentos de antes da automação existir não disparam. Lembretes antes da sessão valem para todas as sessões futuras.</small>
        </div>
        <div className="crm-modal-foot"><div>
          <button type="button" className="crm-btn secondary" onClick={onClose}>Cancelar</button>
          <button className="crm-btn">Salvar</button>
        </div></div>
      </form>
    </div>
  )
}
