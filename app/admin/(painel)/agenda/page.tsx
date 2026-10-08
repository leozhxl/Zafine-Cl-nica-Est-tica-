'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bot, ChevronLeft, ChevronRight, Plus, Settings2, X } from 'lucide-react'
import { type Appointment, type Client, appointmentStatuses, treatments } from '@/lib/crm'
import { createClient } from '@/lib/supabase/client'

const DAY = 86400000

function startOfWeek(date: Date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // segunda-feira
  return d
}

// Valor para <input type="datetime-local"> no fuso do navegador.
function toLocalInput(iso: string) {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
const time = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export default function AgendaPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [clients, setClients] = useState<Pick<Client, 'id' | 'name'>[]>([])
  const [editing, setEditing] = useState<Partial<Appointment> | null>(null)
  const [onlyAgent, setOnlyAgent] = useState(false)
  const [services, setServices] = useState<{ name: string; duration_min: number }[]>([])

  useEffect(() => {
    createClient().from('services').select('name, duration_min').eq('active', true).order('sort').then(({ data, error }) => setServices(error ? [] : data ?? []))
  }, [])
  const shown = onlyAgent ? appointments.filter((a) => a.created_by === 'agente') : appointments
  const byAgent = appointments.filter((a) => a.created_by === 'agente' && a.status !== 'cancelado').length

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY)), [weekStart])

  const load = useCallback(async () => {
    const supabase = createClient()
    const [{ data: appts }, { data: cl }] = await Promise.all([
      supabase
        .from('appointments')
        .select('*, clients(name, phone)')
        .gte('starts_at', weekStart.toISOString())
        .lt('starts_at', new Date(weekStart.getTime() + 7 * DAY).toISOString())
        .order('starts_at'),
      supabase.from('clients').select('id, name').order('name'),
    ])
    setAppointments((appts ?? []) as Appointment[])
    setClients(cl ?? [])
  }, [weekStart])

  useEffect(() => { load() }, [load])

  function newAt(day: Date) {
    const d = new Date(day)
    d.setHours(9, 0, 0, 0)
    const first = services[0]
    setEditing({ starts_at: d.toISOString(), duration_min: first?.duration_min ?? 60, status: 'agendado', treatment: first?.name ?? treatments[0] })
  }

  const label = `${days[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${days[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`

  return (
    <>
      <div className="crm-header">
        <div><h1>Agenda</h1><p>{appointments.filter((a) => a.status !== 'cancelado').length} sessões nesta semana · {byAgent} marcadas pelo agente 🤖</p></div>
        <div className="crm-week-nav">
          <button className="crm-btn secondary" onClick={() => setWeekStart(new Date(weekStart.getTime() - 7 * DAY))} aria-label="Semana anterior"><ChevronLeft size={16} /></button>
          <strong>{label}</strong>
          <button className="crm-btn secondary" onClick={() => setWeekStart(new Date(weekStart.getTime() + 7 * DAY))} aria-label="Próxima semana"><ChevronRight size={16} /></button>
          <button className="crm-btn secondary" onClick={() => setWeekStart(startOfWeek(new Date()))}>Hoje</button>
          <button className="crm-btn" onClick={() => newAt(new Date())}><Plus size={16} /> Agendar</button>
          <Link className="crm-btn secondary" href="/admin/agenda/horarios"><Settings2 size={16} /> Horários e serviços</Link>
        </div>
      </div>

      <label className="crm-check" style={{ marginBottom: 12 }}><input type="checkbox" checked={onlyAgent} onChange={(e) => setOnlyAgent(e.target.checked)} /> <Bot size={15} /> Mostrar só as sessões marcadas pelo agente</label>

      <div className="crm-days">
        {days.map((day) => (
          <div key={day.toISOString()} className={`crm-day ${sameDay(day, new Date()) ? 'today' : ''}`}>
            <div className="crm-day-head">
              <span>{day.toLocaleDateString('pt-BR', { weekday: 'short' })} <strong>{day.getDate()}</strong></span>
              <button className="crm-icon-btn" onClick={() => newAt(day)} aria-label="Agendar neste dia"><Plus size={15} /></button>
            </div>
            {shown.filter((a) => sameDay(new Date(a.starts_at), day)).map((a) => (
              <button key={a.id} className={`crm-appt ${a.status}`} onClick={() => setEditing(a)}>
                <b>{time(a.starts_at)} · {a.clients?.name}{a.created_by === 'agente' && <span title="Agendado pelo agente"> 🤖</span>}</b>
                {a.treatment}{a.professional ? ` · ${a.professional}` : ''}
              </button>
            ))}
          </div>
        ))}
      </div>

      {editing && <AppointmentModal appointment={editing} clients={clients} services={services} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
    </>
  )
}

function AppointmentModal({ appointment, clients, services, onClose, onSaved }: {
  appointment: Partial<Appointment>
  clients: Pick<Client, 'id' | 'name'>[]
  services: { name: string; duration_min: number }[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({ ...appointment, starts_local: toLocalInput(appointment.starts_at ?? new Date().toISOString()) })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }))

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    const payload = {
      client_id: form.client_id,
      treatment: form.treatment,
      professional: form.professional || null,
      starts_at: new Date(form.starts_local).toISOString(),
      duration_min: Number(form.duration_min) || 60,
      status: form.status,
      notes: form.notes || null,
    }
    const supabase = createClient()
    const { error } = form.id
      ? await supabase.from('appointments').update(payload).eq('id', form.id)
      : await supabase.from('appointments').insert(payload)
    setSaving(false)
    if (error) return setError(error.message)
    onSaved()
  }

  async function remove() {
    if (!form.id || !confirm('Excluir este agendamento?')) return
    const { error } = await createClient().from('appointments').delete().eq('id', form.id)
    if (error) return setError(error.message)
    onSaved()
  }

  return (
    <div className="crm-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="crm-modal" onSubmit={save}>
        <div className="crm-modal-head">
          <h2>{form.id ? 'Editar sessão' : 'Nova sessão'}</h2>
          <button type="button" className="crm-icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        {error && <div className="crm-alert error">{error}</div>}
        {clients.length === 0 && <div className="crm-alert">Cadastre um cliente antes de agendar.</div>}
        <div className="crm-form">
          <label className="crm-field full">Cliente
            <select value={form.client_id ?? ''} onChange={(e) => set('client_id', e.target.value)} required>
              <option value="" disabled>Selecione…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="crm-field">Tratamento
            <select value={form.treatment} onChange={(e) => {
              set('treatment', e.target.value)
              const service = services.find((s) => s.name === e.target.value)
              if (service && !form.id) set('duration_min', service.duration_min)
            }}>
              {(services.length ? services.map((s) => s.name) : treatments).map((t) => <option key={t} value={t}>{t}</option>)}
              {form.treatment && !(services.length ? services.map((s) => s.name) : treatments).includes(form.treatment) && <option value={form.treatment}>{form.treatment}</option>}
            </select>
          </label>
          <label className="crm-field">Profissional<input value={form.professional ?? ''} onChange={(e) => set('professional', e.target.value)} /></label>
          <label className="crm-field">Data e hora<input type="datetime-local" value={form.starts_local} onChange={(e) => set('starts_local', e.target.value)} required /></label>
          <label className="crm-field">Duração (min)<input type="number" min={10} step={5} value={form.duration_min ?? 60} onChange={(e) => set('duration_min', e.target.value)} /></label>
          <label className="crm-field full">Status
            <select value={form.status} onChange={(e) => set('status', e.target.value)}>
              {appointmentStatuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label className="crm-field full">Observações<textarea value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></label>
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
