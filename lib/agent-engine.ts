import type { Flow, FlowNode, NodeData, RunState } from '@/lib/agent-flow'
import { addDays, formatDay, todayBRT, weekdayNames } from '@/lib/availability'
import type { Stage, WhatsappMessage } from '@/lib/crm'

export type Effects = {
  messages: { text: string; ai: boolean }[]
  clientPatch: { stage?: Stage; interest?: string; ai_paused?: boolean }
  run: RunState & { agent_id: string }
  log: string[]
  booked?: { service: string; date: string; time: string }
}

type Input = {
  agentId: string
  flow: Flow
  run: (RunState & { agent_id: string }) | null
  clientName: string
  history: WhatsappMessage[]
}

/** Acesso à agenda, usado pelo bloco "Agendar consulta". */
export type SchedulingDeps = {
  services(): Promise<{ name: string; duration_min: number }[]>
  days(service: string): Promise<string[]>
  slots(service: string, date: string): Promise<string[]>
  book(service: string, date: string, time: string): Promise<boolean>
}

export type Deps = {
  aiReply?: (history: WhatsappMessage[]) => Promise<{ reply: string; needsHuman: boolean }>
  scheduling?: SchedulingDeps
}

const MAX_STEPS = 40
const MAX_DAYS = 6

const normalize = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

function firstName(name: string) {
  const first = name.trim().split(/\s+/)[0] ?? ''
  return /\d{6,}/.test(first) ? '' : first // nome ainda é o telefone
}

function render(text: string, clientName: string, extra: Record<string, string> = {}) {
  const name = firstName(clientName)
  let out = text.replace(/\{nome\}/g, name)
  for (const [key, value] of Object.entries(extra)) out = out.replaceAll(`{${key}}`, value)
  if (!name) out = out.replace(/,\s*([!?.])/g, '$1').replace(/ {2,}/g, ' ')
  return out
}

function matchBranch(node: Extract<NodeData, { kind: 'condition' }>, reply: string) {
  const text = ` ${normalize(reply)} `
  return node.branches.find((b) =>
    b.keywords.split(',').map(normalize).filter(Boolean).some((k) => text.includes(` ${k} `)),
  )
}

function nextNode(flow: Flow, nodeId: string, handle: string | null) {
  const edge = flow.edges.find((e) => e.source === nodeId && (e.sourceHandle ?? null) === handle)
  return edge ? flow.nodes.find((n) => n.id === edge.target) ?? null : null
}

// ---------- Bloco "Agendar consulta" ----------

type ScheduleResult = { messages: string[]; vars: Record<string, string>; done: null | 'booked' | 'exit'; booked?: Effects['booked'] }

const CANCEL_WORDS = ['0', 'cancelar', 'cancela', 'sair', 'desistir', 'parar']
const YES_WORDS = ['1', 'sim', 's', 'confirmar', 'confirmo', 'pode', 'ok', 'isso', 'certo', 'quero']
const NO_WORDS = ['2', 'nao', 'n', 'outro', 'trocar', 'mudar']

const numbered = (labels: string[]) => labels.map((l, i) => `*${i + 1}* - ${l}`).join('\n')

/** Escolha por número ou pelo nome da opção. */
function pickIndex(labels: string[], text: string) {
  const t = normalize(text)
  const n = Number(t)
  if (Number.isInteger(n) && n >= 1 && n <= labels.length) return n - 1
  const exact = labels.findIndex((l) => normalize(l) === t)
  if (exact >= 0) return exact
  return t.length >= 3 ? labels.findIndex((l) => normalize(l).includes(t) || t.includes(normalize(l))) : -1
}

/** Lê "14", "14h", "14:30", "14h30", "às 9" e devolve HH:MM. */
function parseTime(text: string) {
  const m = text.match(/(\d{1,2})\s*(?:[:h]\s*(\d{2}))?/i)
  if (!m) return null
  const h = Number(m[1])
  const min = m[2] ? Number(m[2]) : 0
  return h < 24 && min < 60 ? `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}` : null
}

function slotsText(slots: string[]) {
  const items = slots.map((s, i) => `*${i + 1}* ${s}`)
  const rows: string[] = []
  for (let i = 0; i < items.length; i += 3) rows.push(items.slice(i, i + 3).join('    '))
  return rows.join('\n')
}

async function askService(deps: SchedulingDeps, vars: Record<string, string>): Promise<ScheduleResult> {
  const services = (await deps.services()).map((s) => s.name)
  return {
    messages: [`Qual serviço você quer agendar?\n\n${numbered(services)}\n\nResponda com o *número* (ou *0* para cancelar).`],
    vars: { ...vars, sched_step: 'service', sched_opts: JSON.stringify(services) },
    done: null,
  }
}

async function askDay(deps: SchedulingDeps, vars: Record<string, string>, service: string, intro = ''): Promise<ScheduleResult> {
  const days = (await deps.days(service)).slice(0, MAX_DAYS)
  if (!days.length) {
    return { messages: [`${intro}No momento não encontrei horários livres para *${service}* nos próximos dias. 😕`], vars, done: 'exit' }
  }
  return {
    messages: [`${intro}Para *${service}*, tenho horários nestes dias:\n\n${numbered(days.map(formatDay))}\n\nQual dia fica melhor? Responda com o *número* (ou *0* para cancelar).`],
    vars: { ...vars, sched_step: 'day', sched_service: service, sched_opts: JSON.stringify(days) },
    done: null,
  }
}

async function askTime(deps: SchedulingDeps, vars: Record<string, string>, service: string, date: string, intro = ''): Promise<ScheduleResult> {
  const slots = await deps.slots(service, date)
  if (!slots.length) return askDay(deps, vars, service, `${intro}Esse dia acabou de ficar sem horários. `)
  const other = slots.length + 1
  return {
    messages: [`${intro}Horários livres em *${formatDay(date)}*:\n\n${slotsText(slots)}\n\n*${other}* - Ver outro dia\n\nResponda com o *número* ou com o horário (ex.: 14h).`],
    vars: { ...vars, sched_step: 'time', sched_day: date, sched_opts: JSON.stringify(slots) },
    done: null,
  }
}

async function scheduleStep(data: Extract<NodeData, { kind: 'schedule' }>, vars: Record<string, string>, text: string | null, deps: Deps, clientName: string): Promise<ScheduleResult> {
  const sched = deps.scheduling
  if (!sched) return { messages: ['Não consegui acessar a agenda agora. 😕'], vars, done: 'exit' }

  // Chegando no bloco: começa do zero.
  if (text === null) {
    const clean = Object.fromEntries(Object.entries(vars).filter(([k]) => !k.startsWith('sched_')))
    return data.service ? askDay(sched, clean, data.service) : askService(sched, clean)
  }

  const t = normalize(text)
  if (CANCEL_WORDS.includes(t)) return { messages: [], vars, done: 'exit' }
  const opts: string[] = JSON.parse(vars.sched_opts ?? '[]')
  const service = vars.sched_service ?? ''

  switch (vars.sched_step) {
    case 'service': {
      const i = pickIndex(opts, text)
      if (i < 0) return { ...(await askService(sched, vars)), messages: [`Não entendi. 😊 Responda com o número do serviço:\n\n${numbered(opts)}`] }
      return askDay(sched, vars, opts[i])
    }
    case 'day': {
      let i = pickIndex(opts.map(formatDay), text)
      if (i < 0 && t.includes('hoje')) i = opts.indexOf(todayBRT())
      if (i < 0 && t.includes('amanha')) i = opts.indexOf(addDays(todayBRT(), 1))
      // "quarta", "sexta-feira"…: primeiro dia da lista com esse dia da semana.
      if (i < 0) i = opts.findIndex((d) => t.includes(normalize(weekdayNames[new Date(`${d}T12:00:00Z`).getUTCDay()])))
      if (i < 0) return { messages: [`Não entendi. 😊 Responda com o número do dia:\n\n${numbered(opts.map(formatDay))}`], vars, done: null }
      return askTime(sched, vars, service, opts[i])
    }
    case 'time': {
      const n = Number(t)
      if (n === opts.length + 1 || t.includes('outro dia')) return askDay(sched, vars, service)
      let time = Number.isInteger(n) && n >= 1 && n <= opts.length ? opts[n - 1] : null
      if (!time) {
        const typed = parseTime(text)
        if (typed && opts.includes(typed)) time = typed
        else if (typed) return { messages: [`Às ${typed} não tenho horário livre nesse dia. 😕 Escolha um destes:\n\n${slotsText(opts)}\n\n*${opts.length + 1}* - Ver outro dia`], vars, done: null }
      }
      if (!time) return { messages: [`Não entendi. 😊 Responda com o número do horário:\n\n${slotsText(opts)}\n\n*${opts.length + 1}* - Ver outro dia`], vars, done: null }
      return {
        messages: [`Confirmando: *${service}* em *${formatDay(vars.sched_day)} às ${time}*.\n\n*1* - Confirmar\n*2* - Escolher outro horário`],
        vars: { ...vars, sched_step: 'confirm', sched_time: time },
        done: null,
      }
    }
    case 'confirm': {
      const date = vars.sched_day
      const time = vars.sched_time
      if (YES_WORDS.includes(t)) {
        const ok = await sched.book(service, date, time)
        if (!ok) return askTime(sched, vars, service, date, 'Poxa, esse horário acabou de ser ocupado. 😕 ')
        const message = render(data.successText, clientName, { servico: service, data: formatDay(date), hora: time })
        return { messages: [message], vars, done: 'booked', booked: { service, date, time } }
      }
      if (NO_WORDS.includes(t)) return askTime(sched, vars, service, date)
      return { messages: ['Responda *1* para confirmar ou *2* para escolher outro horário.'], vars, done: null }
    }
    default:
      return data.service ? askDay(sched, vars, data.service) : askService(sched, vars)
  }
}

// ---------- Execução do fluxo ----------

function newEffects(input: Input, vars: Record<string, string>): Effects {
  return { messages: [], clientPatch: {}, run: { agent_id: input.agentId, node_id: null, status: 'done', wait_until: null, vars }, log: [] }
}

function applySchedule(effects: Effects, r: ScheduleResult) {
  effects.messages.push(...r.messages.map((text) => ({ text, ai: false })))
  effects.run.vars = r.vars
  if (r.booked) {
    effects.booked = r.booked
    effects.clientPatch.interest = r.booked.service
  }
}

async function advance(input: Input, deps: Deps, from: FlowNode, handle: string | null, effects: Effects): Promise<Effects> {
  let node = nextNode(input.flow, from.id, handle)

  for (let step = 0; node && step < MAX_STEPS; step++) {
    const data = node.data
    const vars = effects.run.vars
    let out: string | null = null
    effects.log.push(node.id)

    switch (data.kind) {
      case 'start':
        break
      case 'message':
        if (data.text.trim()) effects.messages.push({ text: render(data.text, input.clientName), ai: false })
        break
      case 'wait':
        effects.run = {
          ...effects.run,
          node_id: node.id,
          status: 'waiting',
          wait_until: data.timeoutMinutes ? new Date(Date.now() + data.timeoutMinutes * 60000).toISOString() : null,
        }
        return effects
      case 'condition':
        out = matchBranch(data, vars.last_reply ?? '')?.id ?? 'else'
        break
      case 'schedule': {
        const r = await scheduleStep(data, vars, null, deps, input.clientName)
        applySchedule(effects, r)
        if (!r.done) {
          effects.run = { ...effects.run, node_id: node.id, status: 'waiting', wait_until: null }
          return effects
        }
        out = r.done
        break
      }
      case 'ai': {
        if (!deps.aiReply) break
        const sent = effects.messages.map((m, i) => ({ id: `s${i}`, client_id: null, phone: '', direction: 'out' as const, body: m.text, from_ai: true, created_at: '' }))
        try {
          const { reply, needsHuman } = await deps.aiReply([...input.history, ...sent])
          effects.messages.push({ text: reply, ai: true })
          if (needsHuman) {
            effects.clientPatch.ai_paused = true
            return effects
          }
        } catch (error) {
          effects.log.push(`IA falhou: ${error instanceof Error ? error.message : String(error)}`)
        }
        break
      }
      case 'action':
        if (data.action === 'set_stage') effects.clientPatch.stage = data.value as Stage
        if (data.action === 'set_interest') effects.clientPatch.interest = (data.value || '{resposta}').replace(/\{resposta\}/g, vars.last_reply ?? '').trim()
        if (data.action === 'handoff') {
          effects.clientPatch.ai_paused = true
          return effects
        }
        if (data.action === 'end') return effects
        break
    }
    node = nextNode(input.flow, node.id, out)
  }
  return effects
}

/** Mensagem nova da cliente. Retorna null quando o agente não deve responder. */
export async function handleInbound(input: Input, text: string, deps: Deps = {}): Promise<Effects | null> {
  const { flow, run } = input
  const vars = { ...(run?.vars ?? {}), last_reply: text }
  const current = run?.agent_id === input.agentId && run.status === 'waiting' ? flow.nodes.find((n) => n.id === run.node_id) : null
  const effects = newEffects(input, vars)

  if (current?.data.kind === 'wait') return advance(input, deps, current, 'reply', effects)

  if (current?.data.kind === 'schedule') {
    const r = await scheduleStep(current.data, vars, text, deps, input.clientName)
    applySchedule(effects, r)
    if (!r.done) {
      effects.run = { ...effects.run, node_id: current.id, status: 'waiting', wait_until: null }
      return effects
    }
    return advance(input, deps, current, r.done, effects)
  }

  const start = flow.nodes.find((n) => n.data.kind === 'start')
  if (!start || start.data.kind !== 'start') return null
  // "Primeira mensagem": só começa para quem ainda não passou por este agente.
  if (start.data.trigger === 'first_message' && run?.agent_id === input.agentId) return null
  return advance(input, deps, start, null, effects)
}

/** O tempo de espera de um bloco "Aguardar resposta" acabou. */
export async function handleTimeout(input: Input, deps: Deps = {}): Promise<Effects | null> {
  const { run, flow } = input
  if (!run || run.status !== 'waiting') return null
  const current = flow.nodes.find((n) => n.id === run.node_id)
  if (current?.data.kind !== 'wait') return null
  return advance(input, deps, current, 'timeout', newEffects(input, run.vars))
}
