import type { SupabaseClient } from '@supabase/supabase-js'
import { generateReply, sendWhatsappText } from '@/lib/ai-whatsapp'
import type { Agent, RunState } from '@/lib/agent-flow'
import type { Effects } from '@/lib/agent-engine'
import type { AiSettings, Client } from '@/lib/crm'

export type StoredRun = RunState & { id: string; client_id: string; agent_id: string }

export async function getActiveAgent(supabase: SupabaseClient) {
  const { data } = await supabase.from('agents').select('*').eq('enabled', true).order('updated_at', { ascending: false }).limit(1).maybeSingle<Agent>()
  return data
}

export async function aiDeps(supabase: SupabaseClient) {
  const { data: ai } = await supabase.from('ai_settings').select('*').eq('id', 1).single<AiSettings>()
  return { aiReply: ai?.enabled ? (history: Parameters<typeof generateReply>[1]) => generateReply(ai, history) : undefined }
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
