export type Stage = 'novo' | 'contatado' | 'avaliacao' | 'fechado' | 'perdido'
export type AppointmentStatus = 'agendado' | 'confirmado' | 'realizado' | 'faltou' | 'cancelado'

export type Client = {
  id: string
  name: string
  phone: string | null
  email: string | null
  source: string
  stage: Stage
  interest: string | null
  notes: string | null
  ai_paused: boolean
  created_at: string
  updated_at: string
}

export type Appointment = {
  id: string
  client_id: string
  treatment: string
  professional: string | null
  starts_at: string
  duration_min: number
  status: AppointmentStatus
  notes: string | null
  created_by?: 'equipe' | 'agente'
  clients?: Pick<Client, 'name' | 'phone'> | null
}

export type WhatsappMessage = {
  id: string
  client_id: string | null
  phone: string
  direction: 'in' | 'out'
  body: string
  from_ai: boolean
  created_at: string
}

export type ScriptStep = { title: string; instruction: string }
export type FaqItem = { question: string; answer: string }

export type AiSettings = {
  script_steps?: ScriptStep[]
  faq?: FaqItem[]
  enabled: boolean
  assistant_name: string
  instructions: string
  knowledge: string
  handoff_message: string
  outside_hours_only: boolean
  hours_start: string
  hours_end: string
}

export const stages: { value: Stage; label: string }[] = [
  { value: 'novo', label: 'Novo lead' },
  { value: 'contatado', label: 'Contatado' },
  { value: 'avaliacao', label: 'Avaliação' },
  { value: 'fechado', label: 'Cliente' },
  { value: 'perdido', label: 'Perdido' },
]

export const stageLabel = (stage: Stage) => stages.find((s) => s.value === stage)?.label ?? stage

export const appointmentStatuses: { value: AppointmentStatus; label: string }[] = [
  { value: 'agendado', label: 'Agendado' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'realizado', label: 'Realizado' },
  { value: 'faltou', label: 'Faltou' },
  { value: 'cancelado', label: 'Cancelado' },
]

export const sources = ['whatsapp', 'instagram', 'site', 'indicação', 'passante', 'outro']

export const treatments = [
  'Depilação a laser',
  'Estética corporal',
  'Flacidez',
  'Estrias',
  'Rejuvenescimento facial',
  'Lipo enzimática',
  'Radiofrequência',
  'Lipo de papada',
]

export function formatPhone(phone: string | null) {
  if (!phone) return ''
  const d = phone.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return phone
}

// Formato usado pelo WhatsApp: só dígitos, com DDI 55.
export function normalizePhone(phone: string) {
  const d = phone.replace(/\D/g, '')
  if (!d) return null
  return d.length <= 11 ? `55${d}` : d
}

export const whatsappUrl = (phone: string | null) => (phone ? `https://wa.me/${normalizePhone(phone)}` : undefined)
