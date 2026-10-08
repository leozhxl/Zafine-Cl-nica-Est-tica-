import { NextResponse, type NextRequest } from 'next/server'
import type { Agent } from '@/lib/agent-flow'
import { handleTimeout } from '@/lib/agent-engine'
import { type StoredRun, aiDeps, applyEffects } from '@/lib/agent-runtime'
import type { Client, WhatsappMessage } from '@/lib/crm'
import { createServiceClient } from '@/lib/supabase/server'

// Chamado a cada minuto pelo pg_cron do Supabase: dispara os blocos "Aguardar" cujo tempo acabou.
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada.' }, { status: 503 })
  }

  const supabase = createServiceClient()
  const { data: due } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('status', 'waiting')
    .lte('wait_until', new Date().toISOString())
    .limit(50)

  let processed = 0
  for (const run of (due ?? []) as StoredRun[]) {
    // Reserva a execução para não disparar duas vezes se outra chamada chegar junto.
    const { data: claimed } = await supabase
      .from('agent_runs')
      .update({ wait_until: null })
      .eq('id', run.id)
      .eq('wait_until', run.wait_until!)
      .select('id')
    if (!claimed?.length) continue

    try {
      const [{ data: agent }, { data: client }, { data: recent }] = await Promise.all([
        supabase.from('agents').select('*').eq('id', run.agent_id).maybeSingle<Agent>(),
        supabase.from('clients').select('*').eq('id', run.client_id).maybeSingle<Client>(),
        supabase.from('whatsapp_messages').select('*').eq('client_id', run.client_id).order('created_at', { ascending: false }).limit(20),
      ])
      if (!agent?.enabled || !client?.phone || client.ai_paused) continue
      const history = ((recent ?? []) as WhatsappMessage[]).reverse()
      const effects = await handleTimeout({ agentId: agent.id, flow: agent.flow, run, clientName: client.name, history }, await aiDeps(supabase))
      if (effects) await applyEffects(supabase, client, effects)
      processed++
    } catch (error) {
      console.error('[agents/tick]', run.id, error)
    }
  }

  return NextResponse.json({ processed })
}
