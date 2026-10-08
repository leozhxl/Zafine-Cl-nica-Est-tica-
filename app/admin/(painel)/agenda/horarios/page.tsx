'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { type ScheduleSettings, type Service, weekdayNames } from '@/lib/availability'
import { createClient } from '@/lib/supabase/client'

type EditableService = Omit<Service, 'id'> & { id?: string }

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] // segunda primeiro

export default function HorariosPage() {
  const [settings, setSettings] = useState<ScheduleSettings | null>(null)
  const [services, setServices] = useState<EditableService[]>([])
  const [removed, setRemoved] = useState<string[]>([])
  const [newDate, setNewDate] = useState('')
  const [missing, setMissing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('schedule_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('services').select('*').order('sort'),
    ]).then(([s, sv]) => {
      if (s.error || sv.error || !s.data) return setMissing(true)
      setSettings(s.data as ScheduleSettings)
      setServices((sv.data ?? []) as Service[])
    })
  }, [])

  if (missing) return <div className="crm-alert">Falta criar as tabelas da agenda: rode o arquivo <b>supabase/agendamento.sql</b> no SQL Editor do Supabase e recarregue a página.</div>
  if (!settings) return <p className="crm-empty">Carregando…</p>

  const set = <K extends keyof ScheduleSettings>(key: K, value: ScheduleSettings[K]) => setSettings({ ...settings, [key]: value })
  const setDay = (day: number, value: ScheduleSettings['hours'][string]) => set('hours', { ...settings.hours, [String(day)]: value })
  const setService = (i: number, patch: Partial<EditableService>) => setServices(services.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const moveService = (i: number, delta: number) => {
    const next = [...services]
    const [item] = next.splice(i, 1)
    next.splice(i + delta, 0, item)
    setServices(next)
  }

  async function save() {
    if (!settings) return
    const names = services.map((s) => s.name.trim().toLowerCase())
    if (names.some((n) => !n)) return setMessage({ type: 'error', text: 'Todo serviço precisa de um nome.' })
    if (new Set(names).size !== names.length) return setMessage({ type: 'error', text: 'Há serviços com o mesmo nome.' })
    if ((settings.break_start && !settings.break_end) || (!settings.break_start && settings.break_end)) {
      return setMessage({ type: 'error', text: 'Preencha o início e o fim do intervalo, ou deixe os dois vazios.' })
    }

    setSaving(true)
    const supabase = createClient()
    const errors: string[] = []
    const { hours, break_start, break_end, slot_step_min, capacity, min_notice_hours, days_ahead, blocked_dates } = settings
    const r = await supabase.from('schedule_settings').update({ hours, break_start: break_start || null, break_end: break_end || null, slot_step_min, capacity, min_notice_hours, days_ahead, blocked_dates, updated_at: new Date().toISOString() }).eq('id', 1)
    if (r.error) errors.push(r.error.message)
    if (removed.length) {
      const d = await supabase.from('services').delete().in('id', removed)
      if (d.error) errors.push(d.error.message)
    }
    const saved: EditableService[] = []
    for (const [i, s] of services.entries()) {
      const row = { name: s.name.trim(), duration_min: s.duration_min, active: s.active, sort: i }
      const res = s.id
        ? await supabase.from('services').update(row).eq('id', s.id).select().single()
        : await supabase.from('services').insert(row).select().single()
      if (res.error) errors.push(`${row.name}: ${res.error.message}`)
      saved.push((res.data as Service) ?? s)
    }
    setServices(saved)
    setRemoved([])
    setSaving(false)
    setMessage(errors.length ? { type: 'error', text: errors.join(' · ') } : { type: 'ok', text: 'Horários e serviços salvos. O agente já usa a nova configuração.' })
  }

  return (
    <>
      <div className="crm-header">
        <div>
          <Link href="/admin/agenda" className="crm-btn ghost" style={{ paddingLeft: 0 }}><ArrowLeft size={15} /> Agenda</Link>
          <h1>Horários e serviços</h1>
          <p>O agente só oferece horários dentro desta configuração e que estejam livres na agenda.</p>
        </div>
        <button className="crm-btn" onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
      </div>
      {message && <div className={`crm-alert ${message.type}`}>{message.text}</div>}

      <div className="crm-grid cols-2" style={{ alignItems: 'start' }}>
        <div className="crm-grid">
          <div className="crm-card">
            <h2>Dias e horários de atendimento</h2>
            <table className="crm-table">
              <tbody>
                {WEEK_ORDER.map((day) => {
                  const hours = settings.hours[String(day)]
                  return (
                    <tr key={day}>
                      <td style={{ width: 130 }}>
                        <label className="crm-check"><input type="checkbox" checked={!!hours} onChange={(e) => setDay(day, e.target.checked ? { open: '08:00', close: '18:00' } : null)} /> {weekdayNames[day]}</label>
                      </td>
                      <td>
                        {hours ? (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input type="time" value={hours.open} onChange={(e) => setDay(day, { ...hours, open: e.target.value })} />
                            até
                            <input type="time" value={hours.close} onChange={(e) => setDay(day, { ...hours, close: e.target.value })} />
                          </div>
                        ) : <span className="crm-sub">Fechado</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="crm-form" style={{ marginTop: 16 }}>
              <label className="crm-field">Intervalo (almoço) — início<input type="time" value={settings.break_start?.slice(0, 5) ?? ''} onChange={(e) => set('break_start', e.target.value || null)} /></label>
              <label className="crm-field">Intervalo — fim<input type="time" value={settings.break_end?.slice(0, 5) ?? ''} onChange={(e) => set('break_end', e.target.value || null)} /></label>
              <small className="crm-sub full">Nenhuma sessão é marcada pelo agente encostando no intervalo. Deixe vazio se não houver.</small>
            </div>
          </div>

          <div className="crm-card">
            <h2>Regras do agendamento</h2>
            <div className="crm-form">
              <label className="crm-field">Atendimentos ao mesmo tempo
                <small>Quantas clientes podem ser atendidas no mesmo horário (ex.: número de salas ou profissionais).</small>
                <input type="number" min={1} max={50} value={settings.capacity} onChange={(e) => set('capacity', Math.max(1, Number(e.target.value) || 1))} />
              </label>
              <label className="crm-field">Intervalo entre horários (min)
                <small>De quanto em quanto tempo o agente oferece horários (ex.: 30 → 8:00, 8:30, 9:00…).</small>
                <input type="number" min={5} max={240} step={5} value={settings.slot_step_min} onChange={(e) => set('slot_step_min', Math.max(5, Number(e.target.value) || 30))} />
              </label>
              <label className="crm-field">Antecedência mínima (horas)
                <small>O agente não oferece horários que comecem antes disso.</small>
                <input type="number" min={0} max={168} value={settings.min_notice_hours} onChange={(e) => set('min_notice_hours', Math.max(0, Number(e.target.value) || 0))} />
              </label>
              <label className="crm-field">Até quantos dias à frente
                <small>Até onde o agente procura horários livres.</small>
                <input type="number" min={1} max={90} value={settings.days_ahead} onChange={(e) => set('days_ahead', Math.max(1, Number(e.target.value) || 14))} />
              </label>
            </div>
          </div>

          <div className="crm-card">
            <h2>Feriados e dias bloqueados</h2>
            <p className="crm-sub" style={{ marginTop: 0 }}>Nesses dias o agente não oferece horários.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              <button type="button" className="crm-btn secondary" disabled={!newDate} onClick={() => { if (!settings.blocked_dates.includes(newDate)) set('blocked_dates', [...settings.blocked_dates, newDate].sort()); setNewDate('') }}><Plus size={15} /> Bloquear</button>
            </div>
            <ul className="crm-list" style={{ marginTop: 8 }}>
              {settings.blocked_dates.map((d) => (
                <li key={d}>
                  <span>{new Date(`${d}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })}</span>
                  <button type="button" className="crm-icon-btn" onClick={() => set('blocked_dates', settings.blocked_dates.filter((x) => x !== d))} aria-label="Desbloquear"><Trash2 size={15} /></button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="crm-card">
          <h2>Serviços</h2>
          <p className="crm-sub" style={{ marginTop: 0, lineHeight: 1.6 }}>
            O agente mostra os serviços ativos nesta ordem, e a duração define quanto tempo cada sessão ocupa na agenda.
          </p>
          <table className="crm-table">
            <thead><tr><th>Serviço</th><th style={{ width: 110 }}>Duração</th><th style={{ width: 60 }}>Ativo</th><th /></tr></thead>
            <tbody>
              {services.map((s, i) => (
                <tr key={s.id ?? `novo-${i}`}>
                  <td><input value={s.name} onChange={(e) => setService(i, { name: e.target.value })} placeholder="Nome do serviço" /></td>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><input type="number" min={10} max={480} step={5} value={s.duration_min} onChange={(e) => setService(i, { duration_min: Math.max(10, Number(e.target.value) || 30) })} /> min</div></td>
                  <td style={{ textAlign: 'center' }}><input type="checkbox" checked={s.active} onChange={(e) => setService(i, { active: e.target.checked })} style={{ width: 'auto' }} /></td>
                  <td className="actions">
                    <button type="button" className="crm-icon-btn" disabled={i === 0} onClick={() => moveService(i, -1)} aria-label="Subir"><ArrowUp size={15} /></button>
                    <button type="button" className="crm-icon-btn" disabled={i === services.length - 1} onClick={() => moveService(i, 1)} aria-label="Descer"><ArrowDown size={15} /></button>
                    <button type="button" className="crm-icon-btn" onClick={() => { if (s.id) setRemoved([...removed, s.id]); setServices(services.filter((_, j) => j !== i)) }} aria-label="Remover"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="crm-btn secondary" style={{ marginTop: 12 }} onClick={() => setServices([...services, { name: '', duration_min: 30, active: true, sort: services.length }])}><Plus size={15} /> Adicionar serviço</button>
          <p className="crm-sub" style={{ marginTop: 14, lineHeight: 1.6 }}>
            Desativar um serviço tira ele da lista do agente, mas mantém as sessões que já estão na agenda. Lembre de clicar em <b>Salvar</b> no topo.
          </p>
        </div>
      </div>
    </>
  )
}
