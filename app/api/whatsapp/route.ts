import crypto from 'node:crypto'
import { after, NextResponse, type NextRequest } from 'next/server'
import { isWithinBusinessHours, sendWhatsappText } from '@/lib/ai-whatsapp'
import type { AiSettings, BotMenu, Client, WhatsappMessage } from '@/lib/crm'
import { handleInbound } from '@/lib/agent-engine'
import { type StoredRun, aiDeps, applyEffects, getActiveAgent } from '@/lib/agent-runtime'
import { botReply } from '@/lib/whatsapp-bot'
import { createServiceClient } from '@/lib/supabase/server'

type IncomingMessage = { from: string; id: string; type: string; text?: { body: string } }
type WebhookPayload = {
  entry?: { changes?: { value?: { messages?: IncomingMessage[]; contacts?: { wa_id: string; profile?: { name?: string } }[] } }[] }[]
}

// Verificação do webhook pela Meta (feita uma vez ao configurar).
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  if (params.get('hub.mode') === 'subscribe' && params.get('hub.verify_token') === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(params.get('hub.challenge'))
  }
  return new NextResponse('Forbidden', { status: 403 })
}

function validSignature(rawBody: string, signature: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET
  if (!secret || !signature) return false
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`
  return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  if (!validSignature(rawBody, request.headers.get('x-hub-signature-256'))) {
    return new NextResponse('Invalid signature', { status: 401 })
  }

  const payload = JSON.parse(rawBody) as WebhookPayload
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value
      for (const message of value?.messages ?? []) {
        if (message.type !== 'text' || !message.text) continue
        const name = value?.contacts?.find((c) => c.wa_id === message.from)?.profile?.name
        // Responde 200 na hora para a Meta não reenviar; o processamento continua depois.
        after(() => handleMessage(message, name).catch((error) => console.error('[whatsapp]', error)))
      }
    }
  }

  return NextResponse.json({ ok: true })
}

async function handleMessage(message: IncomingMessage, profileName?: string) {
  const supabase = createServiceClient()
  const phone = message.from

  let { data: client } = await supabase.from('clients').select('*').eq('phone', phone).maybeSingle<Client>()
  if (!client) {
    const { data, error } = await supabase
      .from('clients')
      .insert({ name: profileName || phone, phone, source: 'whatsapp', stage: 'novo' })
      .select()
      .single<Client>()
    if (error) throw error
    client = data
  }

  const { error: insertError } = await supabase
    .from('whatsapp_messages')
    .insert({ client_id: client.id, phone, direction: 'in', body: message.text!.body, wa_message_id: message.id })
  // Mensagem duplicada (a Meta reenviou): já foi tratada.
  if (insertError?.code === '23505') return
  if (insertError) throw insertError

  const [{ data: ai }, { data: menu }, { data: recent }] = await Promise.all([
    supabase.from('ai_settings').select('*').eq('id', 1).single<AiSettings>(),
    supabase.from('bot_menu').select('*').eq('id', 1).maybeSingle<BotMenu>(),
    supabase.from('whatsapp_messages').select('*').eq('client_id', client.id).order('created_at', { ascending: false }).limit(20),
  ])
  const history = ((recent ?? []) as WhatsappMessage[]).reverse()

  if (client.ai_paused) {
    // Atendimento humano: o robô só volta se a conversa ficou parada por 24h.
    const previous = history.at(-2)
    if (!previous || Date.now() - new Date(previous.created_at).getTime() < 24 * 3600000) return
    await supabase.from('clients').update({ ai_paused: false }).eq('id', client.id)
    // Conversa nova: o agente recomeça do início.
    await supabase.from('agent_runs').delete().eq('client_id', client.id)
  }

  // Agente em blocos ativo tem prioridade; se ele não responder, cai no menu/IA.
  const agent = await getActiveAgent(supabase)
  if (agent) {
    const { data: run } = await supabase.from('agent_runs').select('*').eq('client_id', client.id).maybeSingle<StoredRun>()
    const effects = await handleInbound(
      { agentId: agent.id, flow: agent.flow, run, clientName: client.name, history },
      message.text!.body,
      await aiDeps(supabase),
    )
    if (effects) return applyEffects(supabase, client, effects)
  }

  const aiAllowed = !!ai?.enabled && !(ai.outside_hours_only && isWithinBusinessHours(ai))
  if (!ai || (!menu?.enabled && !aiAllowed)) return

  const result = await botReply({ menu: menu ?? { enabled: false, welcome: '', options: [], footer: '', fallback: '' }, ai, aiAllowed, history })
  if (result?.aiError) console.error('[whatsapp] IA falhou, usando o menu:', result.aiError)
  if (!result) return

  const waId = await sendWhatsappText(phone, result.reply)
  await supabase.from('whatsapp_messages').insert({ client_id: client.id, phone, direction: 'out', body: result.reply, from_ai: true, wa_message_id: waId })

  if (result.handoff) await supabase.from('clients').update({ ai_paused: true, updated_at: new Date().toISOString() }).eq('id', client.id)
}
