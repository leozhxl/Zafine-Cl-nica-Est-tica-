'use server'

import type { Flow, RunState } from '@/lib/agent-flow'
import { handleInbound, handleTimeout } from '@/lib/agent-engine'
import { aiDeps } from '@/lib/agent-runtime'
import type { WhatsappMessage } from '@/lib/crm'
import { createClient } from '@/lib/supabase/server'

type Turn = Pick<WhatsappMessage, 'direction' | 'body'>

/** Simula o agente sem enviar nada no WhatsApp. `text` nulo = simular que o tempo de espera acabou. */
export async function simulateAgent(flow: Flow, run: (RunState & { agent_id: string }) | null, conversation: Turn[], clientName: string, text: string | null) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return { ok: false as const, error: 'Não autorizado.' }

  const history = conversation.map((m, i) => ({ ...m, id: String(i), client_id: null, phone: '', from_ai: false, created_at: '' }))
  const input = { agentId: 'simulacao', flow, run, clientName, history }
  try {
    const deps = await aiDeps(supabase)
    const effects = text === null ? await handleTimeout(input, deps) : await handleInbound(input, text, deps)
    return { ok: true as const, effects }
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : 'Erro ao simular.' }
  }
}
