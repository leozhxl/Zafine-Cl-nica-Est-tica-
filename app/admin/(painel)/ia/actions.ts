'use server'

import { sendWhatsappText } from '@/lib/ai-whatsapp'
import type { AiSettings, BotMenu, Client, WhatsappMessage } from '@/lib/crm'
import { botReply } from '@/lib/whatsapp-bot'
import { createClient } from '@/lib/supabase/server'

async function requireUser() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('Não autorizado.')
  return supabase
}

export async function simulateReply(menu: BotMenu, ai: AiSettings, conversation: Pick<WhatsappMessage, 'direction' | 'body'>[]) {
  await requireUser()
  try {
    const history = conversation.map((m, i) => ({ ...m, id: String(i), client_id: null, phone: '', from_ai: false, created_at: '' }))
    const result = await botReply({ menu, ai, aiAllowed: ai.enabled, history })
    return { ok: true as const, result }
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : 'Erro ao gerar resposta.' }
  }
}

export async function sendManualMessage(clientId: string, body: string) {
  const supabase = await requireUser()
  const { data: client } = await supabase.from('clients').select('id, phone').eq('id', clientId).single<Pick<Client, 'id' | 'phone'>>()
  if (!client?.phone) return { ok: false as const, error: 'Cliente sem telefone.' }
  try {
    const waId = await sendWhatsappText(client.phone, body)
    await supabase.from('whatsapp_messages').insert({ client_id: client.id, phone: client.phone, direction: 'out', body, from_ai: false, wa_message_id: waId })
    return { ok: true as const }
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : 'Erro ao enviar.' }
  }
}
