import type { SupabaseClient } from '@supabase/supabase-js'
import { generateReply, sendWhatsappText } from '@/lib/ai-whatsapp'
import type { Agent, RunState } from '@/lib/agent-flow'
import type { Deps, Effects, SchedulingDeps } from '@/lib/agent-engine'
import { type BusyAppointment, type ScheduleSettings, type Service, availableDays, freeSlots, slotToISO } from '@/lib/availability'
import type { AiSettings, Client } from '@/lib/crm'

export type StoredRun = RunState & { id: string; client_id: string; agent_id: string }

export async function getActiveAgent(supabase: SupabaseClient) {
  const { data } = await supabase.from('agents').select('*').eq('enabled', true).order('updated_at', { ascending: false }).limit(1).maybeSingle<Agent>()
  return data
}

/**
 * Acesso à agenda para o bloco "Agendar consulta".
 * Com `simulate`, consulta a agenda de verdade mas não grava nada.
 */
async function schedulingDeps(supabase: SupabaseClient, clientId: string | null, simulate: boolean): Promise<SchedulingDeps | undefined> {
  const [{ data: settings }, { data: services }] = await Promise.all([
    supabase.from('schedule_settings').select('*').eq('id', 1).maybeSingle<ScheduleSettings>(),
    supabase.from('services').select('*').eq('active', true).order('sort'),
  ])
  if (!settings || !services?.length) return undefined

  const list = services as Service[]
  const duration = (name: string) => list.find((s) => s.name === name)?.duration_min ?? 60
  const loadBusy = async () => {
    const from = new Date(Date.now() - 12 * 3600000).toISOString()
    const to = new Date(Date.now() + (settings.days_ahead + 2) * 86400000).toISOString()
    const { data } = await supabase.from('appointments').select('starts_at, duration_min, status').gte('starts_at', from).lte('starts_at', to)
    return (data ?? []) as BusyAppointment[]
  }
  let busy: BusyAppointment[] | null = null
  const getBusy = async () => (busy ??= await loadBusy())

  return {
    services: async () => list,
    days: async (service) => availableDays(settings, duration(service), await getBusy(), 10),
    slots: async (service, date) => freeSlots(settings, duration(service), date, await getBusy()),
    async book(service, date, time) {
      // Confere de novo com a agenda atualizada antes de marcar.
      busy = await loadBusy()
      if (!freeSlots(settings, duration(service), date, busy).includes(time)) return false
      if (simulate || !clientId) return true
      const { error } = await supabase.from('appointments').insert({
        client_id: clientId,
        treatment: service,
        starts_at: slotToISO(date, time),
        duration_min: duration(service),
        status: 'agendado',
        created_by: 'agente',
        notes: 'Agendado pelo agente no WhatsApp.',
      })
      if (error) console.error('[agendamento]', error)
      return !error
    },
  }
}

export async function buildDeps(supabase: SupabaseClient, { clientId = null, simulate = false }: { clientId?: string | null; simulate?: boolean } = {}): Promise<Deps> {
  const [{ data: ai }, scheduling] = await Promise.all([
    supabase.from('ai_settings').select('*').eq('id', 1).single<AiSettings>(),
    schedulingDeps(supabase, clientId, simulate),
  ])
  return {
    aiReply: ai?.enabled ? (history) => generateReply(ai, history) : undefined,
    scheduling,
  }
}

/** Envia as mensagens, grava no histórico e atualiza cliente e execução do agente. */
export async function applyEffects(supabase: SupabaseClient, client: Pick<Client, 'id' | 'phone'>, effects: Effects) {
  for (const message of effects.messages) {
    const waId = await sendWhatsappText(client.phone!, message.text)
    await supabase.from('whatsapp_messages').insert({ client_id: client.id, phone: client.phone, direction: 'out', body: message.text, from_ai: true, wa_message_id: waId })
  }
  if (Object.keys(effects.clientPatch).length) {
    await supabase.from('clients').update({ ...effects.clientPatch, updated_at: new Date().toISOString() }).eq('id', client.id)
  }
  await supabase.from('agent_runs').upsert(
    { client_id: client.id, ...effects.run, updated_at: new Date().toISOString() },
    { onConflict: 'client_id' },
  )
}
