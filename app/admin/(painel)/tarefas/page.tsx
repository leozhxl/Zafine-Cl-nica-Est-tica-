'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bot, Pencil, Plus, X } from 'lucide-react'
import type { Client } from '@/lib/crm'
import type { Task } from '@/lib/modules'
import { createClient } from '@/lib/supabase/client'

type Filter = 'abertas' | 'hoje' | 'atrasadas' | 'concluidas'

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d }

function toLocalInput(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export default function TarefasPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [clients, setClients] = useState<Pick<Client, 'id' | 'name'>[]>([])
  const [filter, setFilter] = useState<Filter>('abertas')
  const [editing, setEditing] = useState<Partial<Task> | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const supabase = createClient()
    const [t, c] = await Promise.all([
      supabase.from('tasks').select('*, clients(name, phone)').order('done').order('due_at', { ascending: true, nullsFirst: false }).limit(500),
      supabase.from('clients').select('id, name').order('name'),
    ])
    if (t.error) return setError(t.error.code === '42P01' || t.error.code === 'PGRST205' ? 'missing' : t.error.message)
    setTasks((t.data ?? []) as Task[])
    setClients(c.data ?? [])
  }, [])

  useEffect(() => { load() }, [load])

  const counts = useMemo(() => {
    const list = tasks ?? []
    const open = list.filter((t) => !t.done)
    return {
      abertas: open.length,
      hoje: open.filter((t) => t.due_at && new Date(t.due_at) >= startOfToday() && new Date(t.due_at) <= endOfToday()).length,
      atrasadas: open.filter((t) => t.due_at && new Date(t.due_at) < new Date()).length,
      concluidas: list.length - open.length,
    }
  }, [tasks])

  const shown = (tasks ?? []).filter((t) => {
    if (filter === 'concluidas') return t.done
    if (t.done) return false
    if (filter === 'hoje') return t.due_at && new Date(t.due_at) >= startOfToday() && new Date(t.due_at) <= endOfToday()
    if (filter === 'atrasadas') return t.due_at && new Date(t.due_at) < new Date()
    return true
  })

  async function toggle(task: Task) {
    const done = !task.done
    setTasks((list) => list?.map((t) => (t.id === task.id ? { ...t, done } : t)) ?? null)
    const { error } = await createClient().from('tasks').update({ done, done_at: done ? new Date().toISOString() : null }).eq('id', task.id)
    if (error) { setError(error.message); load() }
  }

  if (error === 'missing') return <div className="crm-alert">Falta criar as tabelas: rode o arquivo <b>supabase/modulos.sql</b> no SQL Editor do Supabase e recarregue a página.</div>

  const tabs: { value: Filter; label: string }[] = [
    { value: 'abertas', label: `Abertas (${counts.abertas})` },
    { value: 'hoje', label: `Para hoje (${counts.hoje})` },
    { value: 'atrasadas', label: `Atrasadas (${counts.atrasadas})` },
    { value: 'concluidas', label: `Concluídas (${counts.concluidas})` },
  ]

  return (
    <>
      <div className="crm-header">
        <div><h1>Tarefas</h1><p>O que a equipe precisa fazer: ligar, confirmar, retornar.</p></div>
        <button className="crm-btn" onClick={() => setEditing({})}><Plus size={16} /> Nova tarefa</button>
      </div>
      {error && <div className="crm-alert error">{error}</div>}

      <div className="crm-tabs">
        {tabs.map((t) => <button key={t.value} className={filter === t.value ? 'active' : ''} onClick={() => setFilter(t.value)}>{t.label}</button>)}
      </div>

      <div className="crm-card">
        {!tasks ? <p className="crm-empty">Carregando…</p> : shown.length === 0 ? <p className="crm-empty">Nenhuma tarefa aqui. 🎉</p> : (
          <ul className="crm-list">
            {shown.map((t) => {
              const late = !t.done && t.due_at && new Date(t.due_at) < new Date()
              return (
                <li key={t.id}>
                  <label className="crm-check" style={{ alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                    <input type="checkbox" checked={t.done} onChange={() => toggle(t)} style={{ marginTop: 3 }} />
                    <span style={{ minWidth: 0 }}>
                      <span className="crm-name" style={{ textDecoration: t.done ? 'line-through' : undefined, opacity: t.done ? 0.6 : 1 }}>{t.title}</span>
                      <span className="crm-sub" style={{ display: 'block' }}>
                        {t.clients?.name && `${t.clients.name} · `}
                        {t.due_at ? <span style={{ color: late ? 'var(--danger)' : undefined }}>{late ? 'Atrasada: ' : 'Até '}{new Date(t.due_at).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span> : 'Sem prazo'}
                        {t.assignee && ` · ${t.assignee}`}
                        {t.created_by === 'automacao' && <> · <Bot size={12} style={{ verticalAlign: -2 }} /> automação</>}
                      </span>
                    </span>
                  </label>
                  <button className="crm-icon-btn" onClick={() => setEditing(t)} aria-label="Editar"><Pencil size={16} /></button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {editing && <TaskModal task={editing} clients={clients} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
    </>
  )
}

function TaskModal({ task, clients, onClose, onSaved }: { task: Partial<Task>; clients: Pick<Client, 'id' | 'name'>[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ ...task, due_local: toLocalInput(task.due_at ?? null) })
  const [error, setError] = useState('')
  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      title: form.title,
      notes: form.notes || null,
      client_id: form.client_id || null,
      due_at: form.due_local ? new Date(form.due_local).toISOString() : null,
      assignee: form.assignee || null,
    }
    const supabase = createClient()
    const { error } = form.id ? await supabase.from('tasks').update(payload).eq('id', form.id) : await supabase.from('tasks').insert(payload)
    if (error) return setError(error.message)
    onSaved()
  }

  async function remove() {
    if (!form.id || !confirm('Excluir esta tarefa?')) return
    const { error } = await createClient().from('tasks').delete().eq('id', form.id)
    if (error) return setError(error.message)
    onSaved()
  }

  return (
    <div className="crm-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="crm-modal" onSubmit={save}>
        <div className="crm-modal-head">
          <h2>{form.id ? 'Editar tarefa' : 'Nova tarefa'}</h2>
          <button type="button" className="crm-icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        {error && <div className="crm-alert error">{error}</div>}
        <div className="crm-form">
          <label className="crm-field full">O que fazer<input value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} required autoFocus placeholder="Ex.: Ligar para confirmar a sessão" /></label>
          <label className="crm-field">Cliente
            <select value={form.client_id ?? ''} onChange={(e) => set('client_id', e.target.value)}>
              <option value="">—</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="crm-field">Prazo<input type="datetime-local" value={form.due_local} onChange={(e) => set('due_local', e.target.value)} /></label>
          <label className="crm-field full">Responsável<input value={form.assignee ?? ''} onChange={(e) => set('assignee', e.target.value)} placeholder="Nome de quem vai fazer (opcional)" /></label>
          <label className="crm-field full">Observações<textarea value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></label>
        </div>
        <div className="crm-modal-foot">
          {form.id && <button type="button" className="crm-btn danger" onClick={remove}>Excluir</button>}
          <div>
            <button type="button" className="crm-btn secondary" onClick={onClose}>Cancelar</button>
            <button className="crm-btn">Salvar</button>
          </div>
        </div>
      </form>
    </div>
  )
}
