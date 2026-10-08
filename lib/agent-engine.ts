import type { Flow, FlowNode, NodeData, RunState } from '@/lib/agent-flow'
import type { Stage, WhatsappMessage } from '@/lib/crm'

export type Effects = {
  messages: { text: string; ai: boolean }[]
  clientPatch: { stage?: Stage; interest?: string; ai_paused?: boolean }
  run: RunState & { agent_id: string }
  log: string[]
}

type Input = {
  agentId: string
  flow: Flow
  run: (RunState & { agent_id: string }) | null
  clientName: string
  history: WhatsappMessage[]
}

type Deps = { aiReply?: (history: WhatsappMessage[]) => Promise<{ reply: string; needsHuman: boolean }> }

const MAX_STEPS = 40

const normalize = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

function firstName(name: string) {
  const first = name.trim().split(/\s+/)[0] ?? ''
  return /\d{6,}/.test(first) ? '' : first // nome ainda é o telefone
}

function render(text: string, clientName: string) {
  const name = firstName(clientName)
  let out = text.replace(/\{nome\}/g, name)
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

async function advance(input: Input, deps: Deps, from: FlowNode, handle: string | null, vars: Record<string, string>): Promise<Effects> {
  const effects: Effects = {
    messages: [],
    clientPatch: {},
    run: { agent_id: input.agentId, node_id: null, status: 'done', wait_until: null, vars },
    log: [],
  }
  let node = nextNode(input.flow, from.id, handle)

  for (let step = 0; node && step < MAX_STEPS; step++) {
    const data = node.data
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

/** Mensagem nova da cliente. Retorna null quando o agente não deve responder (cai no menu/IA antigos). */
export async function handleInbound(input: Input, text: string, deps: Deps = {}): Promise<Effects | null> {
  const { flow, run } = input
  const vars = { ...(run?.vars ?? {}), last_reply: text }
  const current = run?.agent_id === input.agentId && run.status === 'waiting' ? flow.nodes.find((n) => n.id === run.node_id) : null

  if (current?.data.kind === 'wait') return advance(input, deps, current, 'reply', vars)

  const start = flow.nodes.find((n) => n.data.kind === 'start')
  if (!start || start.data.kind !== 'start') return null
  // "Primeira mensagem": só começa para quem ainda não passou por este agente.
  if (start.data.trigger === 'first_message' && run?.agent_id === input.agentId) return null
  return advance(input, deps, start, null, vars)
}

/** O tempo de espera de um bloco "Aguardar resposta" acabou. */
export async function handleTimeout(input: Input, deps: Deps = {}): Promise<Effects | null> {
  const { run, flow } = input
  if (!run || run.status !== 'waiting') return null
  const current = flow.nodes.find((n) => n.id === run.node_id)
  if (current?.data.kind !== 'wait') return null
  return advance(input, deps, current, 'timeout', run.vars)
}
