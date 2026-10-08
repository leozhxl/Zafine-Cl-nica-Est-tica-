import type { SupabaseClient } from '@supabase/supabase-js'
import { sendWhatsappTemplate, sendWhatsappText } from '@/lib/ai-whatsapp'
import type { Appointment, Client } from '@/lib/crm'
import { type Automation, type Campaign, fillPlaceholders, matchesAudience } from '@/lib/modules'

const HOUR = 3600000
const MAX_EVENTS_PER_AUTOMATION = 20
const MAX_SENDS_PER_CAMPAIGN = 25

type Event = { key: string; clientId: string; appointment?: Pick<Appointment, 'treatment' | 'starts_at'> }

const brtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '')
const brtTime = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })

/** Eventos que ainda podem disparar a automação (a deduplicação é feita depois, pela chave). */
async function collectEvents(supabase: SupabaseClient, auto: Automation): Promise<Event[]> {
  const now = Date.now()
  // Eventos de "acontecimento" só contam se forem posteriores à criação da automação e das últimas 24h.
  const since = new Date(Math.max(new Date(auto.created_at).getTime(), now - 24 * HOUR)).toISOString()
  const hours = Math.max(1, auto.trigger_config.hours ?? 24)

  switch (auto.trigger) {
    case 'lead_created':
    case 'stage_changed': {
      let query = supabase.from('client_stage_changes').select('id, client_id, from_stage, to_stage').gte('created_at', since).order('created_at').limit(200)
      query = auto.trigger === 'lead_created' ? query.is('from_stage', null) : query.eq('to_stage', auto.trigger_config.stage ?? 'novo')
      const { data } = await query
      return (data ?? []).map((c) => ({ key: `${auto.id}:${c.id}`, clientId: c.client_id }))
    }
    case 'appointment_created': {
      let query = supabase.from('appointments').select('id, client_id, treatment, starts_at, created_by').gte('created_at', since).limit(200)
      if (auto.trigger_config.created_by) query = query.eq('created_by', auto.trigger_config.created_by)
      const { data } = await query
      return (data ?? []).map((a) => ({ key: `${auto.id}:${a.id}`, clientId: a.client_id, appointment: a }))
    }
    case 'before_appointment': {
      const { data } = await supabase
        .from('appointments')
        .select('id, client_id, treatment, starts_at')
        .in('status', ['agendado', 'confirmado'])
        .gt('starts_at', new Date(now).toISOString())
        .lte('starts_at', new Date(now + hours * HOUR).toISOString())
        .limit(200)
      return (data ?? []).map((a) => ({ key: `${auto.id}:${a.id}`, clientId: a.client_id, appointment: a }))
    }
    case 'after_appointment': {
      const { data } = await supabase
        .from('appointments')
        .select('id, client_id, treatment, starts_at')
        .eq('status', 'realizado')
        .lte('starts_at', new Date(now - hours * HOUR).toISOString())
        .gte('starts_at', new Date(Math.max(new Date(auto.created_at).getTime() - hours * HOUR, now - (hours + 7 * 24) * HOUR)).toISOString())
        .limit(200)
      return (data ?? []).map((a) => ({ key: `${auto.id}:${a.id}`, clientId: a.client_id, appointment: a }))
    }
  }
}

async function runAction(supabase: SupabaseClient, auto: Automation, client: Client, event: Event) {
  const cfg = auto.action_config
  const vars = {
    nome: client.name,
    servico: event.appointment?.treatment ?? client.interest ?? '',
    data: event.appointment ? brtDate(event.appointment.starts_at) : '',
    hora: event.appointment ? brtTime(event.appointment.starts_at) : '',
  }

  switch (auto.action) {
    case 'send_message':
    case 'send_template': {
      if (!client.phone) throw new Error('Cliente sem telefone.')
      if (client.ai_paused) return 'Não enviado: atendimento humano em andamento.'
      const body = auto.action === 'send_message'
        ? fillPlaceholders(cfg.text ?? '', vars)
        : `[Modelo ${cfg.template}] ${(cfg.params ?? []).map((p) => fillPlaceholders(p, vars)).join(' · ')}`
      const waId = auto.action === 'send_message'
        ? await sendWhatsappText(client.phone, body)
        : await sendWhatsappTemplate(client.phone, cfg.template ?? '', cfg.language || 'pt_BR', (cfg.params ?? []).map((p) => fillPlaceholders(p, vars)))
      await supabase.from('whatsapp_messages').insert({ client_id: client.id, phone: client.phone, direction: 'out', body, from_ai: true, wa_message_id: waId })
      return 'Mensagem enviada.'
    }
    case 'create_task': {
      const due = cfg.due_hours ? new Date(Date.now() + cfg.due_hours * HOUR).toISOString() : null
      const { error } = await supabase.from('tasks').insert({ title: fillPlaceholders(cfg.title || 'Falar com {nome}', vars), client_id: client.id, due_at: due, created_by: 'automacao' })
      if (error) throw error
      return 'Tarefa criada.'
    }
    case 'set_stage': {
      if (!cfg.stage || client.stage === cfg.stage) return 'Já estava nessa etapa.'
      const { error } = await supabase.from('clients').update({ stage: cfg.stage, updated_at: new Date().toISOString() }).eq('id', client.id)
      if (error) throw error
      return 'Etapa alterada.'
    }
  }
}

export async function runAutomations(supabase: SupabaseClient) {
  const { data: autos } = await supabase.from('automations').select('*').eq('enabled', true)
  let processed = 0
  for (const auto of (autos ?? []) as Automation[]) {
    const events = await collectEvents(supabase, auto)
    if (!events.length) continue
    const { data: done } = await supabase.from('automation_log').select('key').in('key', events.map((e) => e.key))
    const seen = new Set((done ?? []).map((d) => d.key))
    for (const event of events.filter((e) => !seen.has(e.key)).slice(0, MAX_EVENTS_PER_AUTOMATION)) {
      // Reserva o evento primeiro: se outra execução chegar junto, a chave única impede a repetição.
      const { error: claimError } = await supabase.from('automation_log').insert({ automation_id: auto.id, client_id: event.clientId, key: event.key, status: 'ok', detail: 'Processando…' })
      if (claimError) continue
      try {
        const { data: client } = await supabase.from('clients').select('*').eq('id', event.clientId).maybeSingle<Client>()
        if (!client) throw new Error('Cliente não encontrada.')
        const detail = await runAction(supabase, auto, client, event)
        await supabase.from('automation_log').update({ detail }).eq('key', event.key)
      } catch (error) {
        await supabase.from('automation_log').update({ status: 'erro', detail: error instanceof Error ? error.message : String(error) }).eq('key', event.key)
      }
      processed++
    }
  }
  return processed
}

export async function runCampaigns(supabase: SupabaseClient) {
  const { data: due } = await supabase.from('campaigns').select('*').in('status', ['agendada', 'enviando']).lte('scheduled_at', new Date().toISOString())
  let sent = 0
  for (const campaign of (due ?? []) as Campaign[]) {
    if (campaign.status === 'agendada') {
      // Monta a lista de destinatárias uma única vez, no momento do envio.
      const { data: clients } = await supabase.from('clients').select('id, stage, interest, source, phone, marketing_opt_out')
      const rows = (clients ?? []).filter((c) => matchesAudience(c, campaign.audience)).map((c) => ({ campaign_id: campaign.id, client_id: c.id }))
      if (rows.length) await supabase.from('campaign_recipients').upsert(rows, { onConflict: 'campaign_id,client_id', ignoreDuplicates: true })
      await supabase.from('campaigns').update({ status: 'enviando' }).eq('id', campaign.id).eq('status', 'agendada')
    }

    const { data: pending } = await supabase
      .from('campaign_recipients')
      .select('id, client_id, clients(name, phone, interest, marketing_opt_out)')
      .eq('campaign_id', campaign.id)
      .eq('status', 'pendente')
      .limit(MAX_SENDS_PER_CAMPAIGN)

    for (const r of (pending ?? []) as unknown as { id: string; client_id: string; clients: Pick<Client, 'name' | 'phone' | 'interest'> & { marketing_opt_out: boolean } | null }[]) {
      // Reserva a destinatária para não enviar duas vezes.
      const { data: claimed } = await supabase.from('campaign_recipients').update({ status: 'enviado', sent_at: new Date().toISOString() }).eq('id', r.id).eq('status', 'pendente').select('id')
      if (!claimed?.length) continue
      try {
        if (!r.clients?.phone || r.clients.marketing_opt_out) throw new Error('Sem telefone ou não quer receber campanhas.')
        const vars = { nome: r.clients.name, servico: r.clients.interest ?? '' }
        const params = campaign.body_params.map((p) => fillPlaceholders(p, vars))
        const waId = await sendWhatsappTemplate(r.clients.phone, campaign.template_name, campaign.template_language || 'pt_BR', params)
        await supabase.from('whatsapp_messages').insert({
          client_id: r.client_id, phone: r.clients.phone, direction: 'out', from_ai: true, wa_message_id: waId,
          body: `[Campanha: ${campaign.name}] ${fillPlaceholders(campaign.preview || campaign.template_name, vars)}`,
        })
        sent++
      } catch (error) {
        await supabase.from('campaign_recipients').update({ status: 'erro', error: error instanceof Error ? error.message : String(error) }).eq('id', r.id)
      }
    }

    const [{ count: ok }, { count: failed }, { count: left }] = await Promise.all([
      supabase.from('campaign_recipients').select('id', { count: 'exact', head: true }).eq('campaign_id', campaign.id).eq('status', 'enviado'),
      supabase.from('campaign_recipients').select('id', { count: 'exact', head: true }).eq('campaign_id', campaign.id).eq('status', 'erro'),
      supabase.from('campaign_recipients').select('id', { count: 'exact', head: true }).eq('campaign_id', campaign.id).eq('status', 'pendente'),
    ])
    await supabase.from('campaigns').update({ sent_count: ok ?? 0, failed_count: failed ?? 0, ...(left ? {} : { status: 'concluida' }) }).eq('id', campaign.id).neq('status', 'cancelada')
  }
  return sent
}
