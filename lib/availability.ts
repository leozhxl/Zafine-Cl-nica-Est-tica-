// Cálculo de horários livres na agenda. Sem dependências de servidor.

export type Service = { id: string; name: string; duration_min: number; active: boolean; sort: number }

export type DayHours = { open: string; close: string } | null

export type ScheduleSettings = {
  hours: Record<string, DayHours>
  break_start: string | null
  break_end: string | null
  slot_step_min: number
  capacity: number
  min_notice_hours: number
  days_ahead: number
  blocked_dates: string[]
}

export type BusyAppointment = { starts_at: string; duration_min: number; status: string }

// O Brasil não tem horário de verão desde 2019: o horário de Brasília é sempre UTC-3.
const BRT_OFFSET = '-03:00'
const MINUTE = 60000

export const weekdayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}
const toHHMM = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

/** Data (AAAA-MM-DD) de hoje no horário de Brasília. */
export function todayBRT(now = new Date()) {
  return new Date(now.getTime() - 3 * 3600000).toISOString().slice(0, 10)
}

export const slotToISO = (date: string, time: string) => new Date(`${date}T${time}:00${BRT_OFFSET}`).toISOString()

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function formatDay(date: string) {
  const d = new Date(`${date}T12:00:00Z`)
  const weekday = d.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '')
  return `${weekday}, ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })}`
}

/** Horários (HH:MM) livres para um serviço numa data. */
export function freeSlots(settings: ScheduleSettings, durationMin: number, date: string, busy: BusyAppointment[], now = new Date()): string[] {
  if (settings.blocked_dates.includes(date)) return []
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()
  const hours = settings.hours[String(weekday)]
  if (!hours) return []

  const open = toMinutes(hours.open)
  const close = toMinutes(hours.close)
  const breakStart = settings.break_start ? toMinutes(settings.break_start) : null
  const breakEnd = settings.break_end ? toMinutes(settings.break_end) : null
  const earliest = now.getTime() + settings.min_notice_hours * 3600000
  const active = busy.filter((a) => a.status !== 'cancelado' && a.status !== 'faltou')

  const slots: string[] = []
  for (let start = open; start + durationMin <= close; start += settings.slot_step_min) {
    const end = start + durationMin
    if (breakStart !== null && breakEnd !== null && start < breakEnd && end > breakStart) continue
    const startMs = new Date(slotToISO(date, toHHMM(start))).getTime()
    if (startMs < earliest) continue
    const endMs = startMs + durationMin * MINUTE
    const overlapping = active.filter((a) => {
      const aStart = new Date(a.starts_at).getTime()
      return aStart < endMs && aStart + a.duration_min * MINUTE > startMs
    }).length
    if (overlapping < settings.capacity) slots.push(toHHMM(start))
  }
  return slots
}

/** Próximos dias (AAAA-MM-DD) com pelo menos um horário livre. */
export function availableDays(settings: ScheduleSettings, durationMin: number, busy: BusyAppointment[], limit: number, now = new Date()) {
  const today = todayBRT(now)
  const days: string[] = []
  for (let i = 0; i <= settings.days_ahead && days.length < limit; i++) {
    const date = addDays(today, i)
    if (freeSlots(settings, durationMin, date, busy, now).length) days.push(date)
  }
  return days
}
