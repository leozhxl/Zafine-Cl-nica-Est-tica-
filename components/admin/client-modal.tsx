'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { type Client, normalizePhone, sources, stages, treatments } from '@/lib/crm'
import { createClient } from '@/lib/supabase/client'

type Props = {
  client: Partial<Client> | null
  onClose: () => void
  onSaved: () => void
}

export function ClientModal({ client, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Partial<Client>>({ source: 'whatsapp', stage: 'novo', ai_paused: false, ...client })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof Client>(key: K, value: Client[K]) => setForm((f) => ({ ...f, [key]: value }))

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    const payload = {
      name: form.name,
      phone: form.phone ? normalizePhone(form.phone) : null,
      email: form.email || null,
      source: form.source,
      stage: form.stage,
      interest: form.interest || null,
      notes: form.notes || null,
      ai_paused: form.ai_paused,
      updated_at: new Date().toISOString(),
    }
    const supabase = createClient()
    const { error } = form.id
      ? await supabase.from('clients').update(payload).eq('id', form.id)
      : await supabase.from('clients').insert(payload)
    setSaving(false)
    if (error) return setError(error.code === '23505' ? 'Já existe um cliente com este telefone.' : error.message)
    onSaved()
  }

  async function remove() {
    if (!form.id || !confirm(`Excluir ${form.name}? As sessões e conversas dele(a) também serão apagadas.`)) return
    const { error } = await createClient().from('clients').delete().eq('id', form.id)
    if (error) return setError(error.message)
    onSaved()
  }

  return (
    <div className="crm-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="crm-modal" onSubmit={save}>
        <div className="crm-modal-head">
          <h2>{form.id ? 'Editar cliente' : 'Novo cliente'}</h2>
          <button type="button" className="crm-icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        {error && <div className="crm-alert error">{error}</div>}
        <div className="crm-form">
          <label className="crm-field full">Nome<input value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} required autoFocus /></label>
          <label className="crm-field">WhatsApp<input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="(48) 99999-9999" /></label>
          <label className="crm-field">E-mail<input type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} /></label>
          <label className="crm-field">Etapa
            <select value={form.stage} onChange={(e) => set('stage', e.target.value as Client['stage'])}>
              {stages.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label className="crm-field">Origem
            <select value={form.source} onChange={(e) => set('source', e.target.value)}>
              {sources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="crm-field full">Tratamento de interesse
            <select value={form.interest ?? ''} onChange={(e) => set('interest', e.target.value)}>
              <option value="">—</option>
              {treatments.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="crm-field full">Observações<textarea value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></label>
          <label className="crm-check full"><input type="checkbox" checked={!!form.ai_paused} onChange={(e) => set('ai_paused', e.target.checked)} /> Pausar respostas automáticas para este contato (atendimento humano)</label>
        </div>
        <div className="crm-modal-foot">
          {form.id && <button type="button" className="crm-btn danger" onClick={remove}>Excluir</button>}
          <div>
            <button type="button" className="crm-btn secondary" onClick={onClose}>Cancelar</button>
            <button className="crm-btn" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </div>
      </form>
    </div>
  )
}
