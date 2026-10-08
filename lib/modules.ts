// Tipos e textos das abas Tarefas, Automações e Campanhas. Sem dependências de servidor.
import type { Client, Stage } from '@/lib/crm'

export type Task = {
  id: string
  title: string
  notes: string | null
  client_id: string | null
  due_at: string | null
  done: boolean
  done_at: string | null
  assignee: string | null
  created_by: 'equipe' | 'automacao'
  created_at: string
  clients?: Pick<Client, 'name' | 'phone'> | null
}

export type TriggerKind = 'lead_created' | 'stage_changed' | 'appointment_created' | 'before_appointment' | 'after_appointment'
export type ActionKind = 'send_message' | 'send_template' | 'create_task' | 'set_stage'

export type Automation = {
  id: string
  name: string
  enabled: boolean
  trigger: TriggerKind
  trigger_config: { stage?: Stage; hours?: number; created_by?: '' | 'agente' | 'equipe' }
  action: ActionKind
  action_config: { text?: string; template?: string; language?: string; params?: string[]; title?: string; due_hours?: number; stage?: Stage }
  created_at: string
  updated_at: string
}

export const triggerLabels: Record<TriggerKind, string> = {
  lead_created: 'Quando chega um novo lead',
  stage_changed: 'Quando a cliente entra numa etapa do funil',
  appointment_created: 'Quando uma sessão é agendada',
  before_appointment: 'Antes de uma sessão (lembrete)',
  after_appointment: 'Depois de uma sessão realizada',
}

export const actionLabels: Record<ActionKind, string> = {
  send_message: 'Enviar mensagem no WhatsApp',
  send_template: 'Enviar modelo aprovado do WhatsApp',
  create_task: 'Criar tarefa para a equipe',
  set_stage: 'Mover no funil',
}

export type Audience = { stages?: Stage[]; interests?: string[]; sources?: string[] }

export type Campaign = {
  id: string
  name: string
  status: 'rascunho' | 'agendada' | 'enviando' | 'concluida' | 'cancelada'
  audience: Audience
  template_name: string
  template_language: string
  body_params: string[]
  preview: string
  scheduled_at: string | null
  sent_count: number
  failed_count: number
  created_at: string
}

export const campaignStatusLabels: Record<Campaign['status'], string> = {
  rascunho: 'Rascunho',
  agendada: 'Agendada',
  enviando: 'Enviando',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

export function matchesAudience(client: Pick<Client, 'stage' | 'interest' | 'source' | 'phone'> & { marketing_opt_out?: boolean }, audience: Audience) {
  if (!client.phone || client.marketing_opt_out) return false
  if (audience.stages?.length && !audience.stages.includes(client.stage)) return false
  if (audience.interests?.length && !audience.interests.includes(client.interest ?? '')) return false
  if (audience.sources?.length && !audience.sources.includes(client.source)) return false
  return true
}

/** Troca {nome}, {servico}, {data} e {hora} pelos dados da cliente/sessão. */
export function fillPlaceholders(text: string, vars: { nome?: string; servico?: string; data?: string; hora?: string }) {
  const first = (vars.nome ?? '').trim().split(/\s+/)[0] ?? ''
  const nome = /\d{6,}/.test(first) ? '' : first
  let out = text.replace(/\{nome\}/g, nome).replace(/\{servico\}/g, vars.servico ?? '').replace(/\{data\}/g, vars.data ?? '').replace(/\{hora\}/g, vars.hora ?? '')
  if (!nome) out = out.replace(/,\s*([!?.])/g, '$1').replace(/ {2,}/g, ' ')
  return out
}

export const PLACEHOLDER_HELP = 'Use {nome}, {servico}, {data} e {hora} (os três últimos só em gatilhos de sessão).'
