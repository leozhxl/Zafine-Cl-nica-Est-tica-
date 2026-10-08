'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Background, Controls, Handle, MarkerType, MiniMap, Position, ReactFlow, ReactFlowProvider,
  addEdge, applyEdgeChanges, applyNodeChanges, useNodesInitialized, useReactFlow, useUpdateNodeInternals,
  type Connection, type Edge, type EdgeChange, type Node, type NodeChange, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ArrowLeft, Bot, Flag, GitBranch, Hourglass, MessageSquare, Play, Plus, RotateCcw, Save, Send, Sparkles, Timer, Trash2 } from 'lucide-react'
import { simulateAgent } from '@/app/admin/(painel)/agentes/actions'
import { type Agent, type Flow, type NodeData, type RunState, actionLabels, blockInfo, defaultData, newId } from '@/lib/agent-flow'
import { stageLabel, stages, treatments } from '@/lib/crm'
import { createClient } from '@/lib/supabase/client'

type BlockNode = Node<NodeData>
const icons = { start: Play, message: MessageSquare, wait: Hourglass, condition: GitBranch, ai: Sparkles, action: Flag }

// Bloco em que a simulação está parada, para destacar no desenho.
const RunningNode = createContext<string | null>(null)

function summary(data: NodeData) {
  switch (data.kind) {
    case 'start': return data.trigger === 'first_message' ? 'Primeira mensagem da cliente' : 'Qualquer mensagem (quando não está no meio do fluxo)'
    case 'message': return data.text.trim() ? data.text : 'Escreva a mensagem…'
    case 'wait': return data.timeoutMinutes ? `Tempo limite: ${formatMinutes(data.timeoutMinutes)}` : 'Sem tempo limite'
    case 'condition': return `${data.branches.length} opç${data.branches.length === 1 ? 'ão' : 'ões'}`
    case 'ai': return 'Responde usando o roteiro da aba Conversas → IA'
    case 'action':
      if (data.action === 'set_stage') return `${actionLabels.set_stage}: ${stageLabel(data.value as never)}`
      if (data.action === 'set_interest') return `${actionLabels.set_interest}: ${data.value || 'resposta da cliente'}`
      return actionLabels[data.action]
  }
}

function formatMinutes(minutes: number) {
  if (minutes % 1440 === 0) return `${minutes / 1440} dia(s)`
  if (minutes % 60 === 0) return `${minutes / 60}h`
  return `${minutes} min`
}

function outputs(data: NodeData): { id: string | null; label?: string }[] {
  switch (data.kind) {
    case 'wait': return [{ id: 'reply', label: 'Respondeu' }, ...(data.timeoutMinutes ? [{ id: 'timeout', label: 'Sem resposta' }] : [])]
    case 'condition': return [...data.branches.map((b) => ({ id: b.id, label: b.label || 'Opção' })), { id: 'else', label: 'Nenhuma das opções' }]
    case 'action': return data.action === 'handoff' || data.action === 'end' ? [] : [{ id: null }]
    default: return [{ id: null }]
  }
}

function BlockView({ id, data, selected }: NodeProps<BlockNode>) {
  const info = blockInfo[data.kind]
  const Icon = icons[data.kind]
  const running = useContext(RunningNode) === id
  const updateInternals = useUpdateNodeInternals()
  const outs = outputs(data)
  const handlesKey = outs.map((o) => o.id).join('|')
  useEffect(() => { updateInternals(id) }, [id, handlesKey, updateInternals])

  return (
    <div className={`crm-block ${selected ? 'selected' : ''} ${running ? 'running' : ''}`} style={{ borderTopColor: info.color }}>
      {data.kind !== 'start' && <Handle type="target" position={Position.Left} />}
      <div className="crm-block-head" style={{ color: info.color }}><Icon size={14} /> {info.label}</div>
      <div className="crm-block-body">{summary(data)}</div>
      {outs.length === 1 && outs[0].id === null && <Handle type="source" position={Position.Right} />}
      {outs.some((o) => o.id !== null) && (
        <div className="crm-block-outs">
          {outs.map((o) => (
            <div key={o.id} className="crm-block-out">
              {o.label}
              <Handle type="source" position={Position.Right} id={o.id!} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const nodeTypes = Object.fromEntries(Object.keys(blockInfo).map((k) => [k, BlockView]))

const toNodes = (flow: Flow): BlockNode[] => flow.nodes.map((n) => ({ id: n.id, type: n.data.kind, position: n.position, data: n.data }))
const toEdges = (flow: Flow): Edge[] => flow.edges.map((e) => ({ id: e.id, source: e.source, sourceHandle: e.sourceHandle ?? null, target: e.target, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#8fb3c2' } }))
const toFlow = (nodes: BlockNode[], edges: Edge[]): Flow => ({
  nodes: nodes.map((n) => ({ id: n.id, type: n.data.kind, position: { x: Math.round(n.position.x), y: Math.round(n.position.y) }, data: n.data })),
  edges: edges.map((e) => ({ id: e.id, source: e.source, sourceHandle: e.sourceHandle ?? null, target: e.target })),
})

export function AgentEditor({ agent }: { agent: Agent }) {
  return <ReactFlowProvider><Editor agent={agent} /></ReactFlowProvider>
}

function Editor({ agent }: { agent: Agent }) {
  const { screenToFlowPosition, fitView } = useReactFlow()
  const nodesMeasured = useNodesInitialized()
  const fitted = useRef(false)
  const [name, setName] = useState(agent.name)
  const [enabled, setEnabled] = useState(agent.enabled)
  const [nodes, setNodes] = useState<BlockNode[]>(() => toNodes(agent.flow))
  const [edges, setEdges] = useState<Edge[]>(() => toEdges(agent.flow))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [panel, setPanel] = useState<'props' | 'test'>('props')
  const [runningNode, setRunningNode] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const selected = nodes.find((n) => n.id === selectedId) ?? null

  // Enquadra o fluxo inteiro só depois que os blocos foram medidos.
  useEffect(() => {
    if (nodesMeasured && !fitted.current) {
      fitted.current = true
      fitView({ padding: 0.12, maxZoom: 1 })
    }
  }, [nodesMeasured, fitView])

  const onNodesChange = useCallback((changes: NodeChange<BlockNode>[]) => {
    // O bloco Início não pode ser apagado.
    const filtered = changes.filter((c) => !(c.type === 'remove' && nodes.find((n) => n.id === c.id)?.data.kind === 'start'))
    if (filtered.some((c) => c.type !== 'select' && c.type !== 'dimensions')) setDirty(true)
    setNodes((ns) => applyNodeChanges(filtered, ns))
  }, [nodes])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (changes.some((c) => c.type !== 'select')) setDirty(true)
    setEdges((es) => applyEdgeChanges(changes, es))
  }, [])

  const onConnect = useCallback((c: Connection) => {
    setDirty(true)
    // Cada saída leva a um único bloco: a nova ligação substitui a anterior.
    setEdges((es) => addEdge({ ...c, id: `${c.source}-${c.sourceHandle ?? 'next'}-${c.target}-${newId()}` }, es.filter((e) => !(e.source === c.source && (e.sourceHandle ?? null) === (c.sourceHandle ?? null)))))
  }, [])

  function updateData(id: string, data: NodeData) {
    setDirty(true)
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data } : n)))
    // Remove ligações de saídas que deixaram de existir (opção apagada, tempo limite desligado…).
    const valid = new Set(outputs(data).map((o) => o.id))
    setEdges((es) => es.filter((e) => e.source !== id || valid.has(e.sourceHandle ?? null)))
  }

  function addBlock(kind: NodeData['kind']) {
    const canvas = document.querySelector('.crm-agent-canvas')?.getBoundingClientRect()
    const center = canvas ? screenToFlowPosition({ x: canvas.left + canvas.width / 2, y: canvas.top + canvas.height / 2 }) : { x: 0, y: 0 }
    const id = newId()
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), { id, type: kind, position: { x: center.x - 110 + Math.random() * 40, y: center.y - 40 + Math.random() * 40 }, data: defaultData(kind), selected: true }])
    setSelectedId(id)
    setPanel('props')
    setDirty(true)
  }

  function removeBlock(id: string) {
    setNodes((ns) => ns.filter((n) => n.id !== id))
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id))
    setSelectedId(null)
    setDirty(true)
  }

  async function save() {
    const flow = toFlow(nodes, edges)
    const start = flow.nodes.find((n) => n.data.kind === 'start')
    if (enabled && (!start || !flow.edges.some((e) => e.source === start.id))) {
      return setMessage({ type: 'error', text: 'Ligue o bloco Início a outro bloco antes de ativar o agente.' })
    }
    setSaving(true)
    const supabase = createClient()
    if (enabled) await supabase.from('agents').update({ enabled: false }).neq('id', agent.id)
    const { error } = await supabase.from('agents').update({ name, enabled, flow, updated_at: new Date().toISOString() }).eq('id', agent.id)
    setSaving(false)
    if (error) return setMessage({ type: 'error', text: error.message })
    setDirty(false)
    setMessage({ type: 'ok', text: enabled ? 'Salvo. Este agente está ativo.' : 'Salvo.' })
  }

  // Avisa antes de sair com alterações não salvas.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const flow = useMemo(() => toFlow(nodes, edges), [nodes, edges])

  return (
    <div className="crm-agent">
      <div className="crm-agent-bar">
        <Link href="/admin/agentes" className="crm-icon-btn" aria-label="Voltar"><ArrowLeft size={18} /></Link>
        <input className="crm-agent-name" value={name} onChange={(e) => { setName(e.target.value); setDirty(true) }} aria-label="Nome do agente" />
        <label className="crm-check"><input type="checkbox" checked={enabled} onChange={(e) => { setEnabled(e.target.checked); setDirty(true) }} /> Ativo</label>
        {message && <span className={`crm-badge ${message.type === 'ok' ? 'fechado' : 'perdido'}`}>{message.text}</span>}
        <Link href="/admin/ajuda#blocos" target="_blank" className="crm-btn ghost">Ajuda dos blocos</Link>
        <button className="crm-btn" onClick={save} disabled={saving} style={{ marginLeft: 'auto' }}><Save size={15} /> {saving ? 'Salvando…' : dirty ? 'Salvar alterações' : 'Salvo'}</button>
      </div>

      <div className="crm-agent-body">
        <div className="crm-agent-palette">
          <span className="crm-sub">Adicionar bloco</span>
          {(Object.keys(blockInfo) as NodeData['kind'][]).filter((k) => k !== 'start' || !nodes.some((n) => n.data.kind === 'start')).map((kind) => {
            const Icon = icons[kind]
            return (
              <button key={kind} className="crm-palette-btn" onClick={() => addBlock(kind)} title={blockInfo[kind].description}>
                <Icon size={15} style={{ color: blockInfo[kind].color }} /> {blockInfo[kind].label}
              </button>
            )
          })}
          <p className="crm-sub" style={{ marginTop: 'auto', lineHeight: 1.5, fontSize: 11.5 }}>
            Arraste da bolinha à direita de um bloco até outro para ligar. Para apagar uma ligação, clique nela e aperte Delete.
          </p>
        </div>

        <div className="crm-agent-canvas">
          <RunningNode.Provider value={runningNode}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onSelectionChange={({ nodes: sel }) => { setSelectedId(sel[0]?.id ?? null); if (sel[0]) setPanel('props') }}
              deleteKeyCode={['Backspace', 'Delete']}
              defaultEdgeOptions={{ type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: '#8fb3c2' } }}
              minZoom={0.2}
            >
              <Background gap={18} />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable />
            </ReactFlow>
          </RunningNode.Provider>
        </div>

        <div className="crm-agent-panel">
          <div className="crm-tabs" style={{ marginBottom: 14 }}>
            <button className={panel === 'props' ? 'active' : ''} onClick={() => setPanel('props')}>Bloco</button>
            <button className={panel === 'test' ? 'active' : ''} onClick={() => setPanel('test')}>Testar</button>
          </div>
          {panel === 'props' && (selected
            ? <BlockProps key={selected.id} node={selected} onChange={(d) => updateData(selected.id, d)} onRemove={() => removeBlock(selected.id)} />
            : <p className="crm-empty">Clique em um bloco para editar.</p>)}
          {panel === 'test' && <Tester flow={flow} onNode={setRunningNode} />}
        </div>
      </div>
    </div>
  )
}

function BlockProps({ node, onChange, onRemove }: { node: BlockNode; onChange: (d: NodeData) => void; onRemove: () => void }) {
  const data = node.data
  const info = blockInfo[data.kind]
  return (
    <div className="crm-form" style={{ gridTemplateColumns: '1fr' }}>
      <div><strong style={{ color: info.color }}>{info.label}</strong><div className="crm-sub">{info.description}</div></div>

      {data.kind === 'start' && (
        <label className="crm-field">Quando começar
          <select value={data.trigger} onChange={(e) => onChange({ ...data, trigger: e.target.value as typeof data.trigger })}>
            <option value="first_message">Primeira mensagem da cliente (uma vez por cliente)</option>
            <option value="any_message">Qualquer mensagem, quando ela não estiver no meio do fluxo</option>
          </select>
        </label>
      )}

      {data.kind === 'message' && (
        <label className="crm-field">Mensagem
          <small>Use {'{nome}'} para o primeiro nome da cliente e *texto* para negrito.</small>
          <textarea rows={8} value={data.text} onChange={(e) => onChange({ ...data, text: e.target.value })} />
        </label>
      )}

      {data.kind === 'wait' && (
        <>
          <p className="crm-sub" style={{ margin: 0, lineHeight: 1.5 }}>O fluxo para aqui até a cliente responder. A resposta dela é usada pelo próximo bloco de Condição.</p>
          <label className="crm-check"><input type="checkbox" checked={!!data.timeoutMinutes} onChange={(e) => onChange({ ...data, timeoutMinutes: e.target.checked ? 60 : null })} /> Seguir outro caminho se ela não responder</label>
          {!!data.timeoutMinutes && (
            <WaitTime minutes={data.timeoutMinutes} onChange={(m) => onChange({ ...data, timeoutMinutes: m })} />
          )}
        </>
      )}

      {data.kind === 'condition' && (
        <>
          <p className="crm-sub" style={{ margin: 0, lineHeight: 1.5 }}>Compara a última resposta da cliente com as palavras-chave de cada opção (separe por vírgula). A primeira que bater define o caminho.</p>
          {data.branches.map((b, i) => (
            <div key={b.id} className="crm-card" style={{ padding: 10, background: '#fafcfc' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={b.label} placeholder="Nome da saída" onChange={(e) => onChange({ ...data, branches: data.branches.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                <button type="button" className="crm-icon-btn" onClick={() => onChange({ ...data, branches: data.branches.filter((_, j) => j !== i) })} aria-label="Remover"><Trash2 size={15} /></button>
              </div>
              <input style={{ marginTop: 6 }} value={b.keywords} placeholder="Palavras-chave: 1, laser, depilação" onChange={(e) => onChange({ ...data, branches: data.branches.map((x, j) => (j === i ? { ...x, keywords: e.target.value } : x)) })} />
            </div>
          ))}
          <button type="button" className="crm-btn secondary" onClick={() => onChange({ ...data, branches: [...data.branches, { id: newId(), label: `Opção ${data.branches.length + 1}`, keywords: String(data.branches.length + 1) }] })}><Plus size={15} /> Adicionar opção</button>
          <p className="crm-sub" style={{ margin: 0 }}>Se nada bater, segue pela saída “Nenhuma das opções”.</p>
        </>
      )}

      {data.kind === 'ai' && (
        <p className="crm-sub" style={{ margin: 0, lineHeight: 1.6 }}>
          A IA lê a conversa e responde usando o <b>roteiro</b>, as <b>respostas prontas</b> e as informações da aba <Link href="/admin/conversas?aba=ia" style={{ color: 'var(--blue)' }}>Conversas → IA e roteiro</Link>.
          Se ela decidir passar para uma atendente, o fluxo para. Precisa da IA ligada e com créditos; sem isso, o bloco é pulado.
        </p>
      )}

      {data.kind === 'action' && (
        <>
          <label className="crm-field">O que fazer
            <select value={data.action} onChange={(e) => {
              const action = e.target.value as typeof data.action
              onChange({ ...data, action, value: action === 'set_stage' ? stages[0].value : '' })
            }}>
              {Object.entries(actionLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          {data.action === 'set_stage' && (
            <label className="crm-field">Etapa do funil
              <select value={data.value} onChange={(e) => onChange({ ...data, value: e.target.value })}>
                {stages.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          )}
          {data.action === 'set_interest' && (
            <label className="crm-field">Tratamento
              <select value={data.value} onChange={(e) => onChange({ ...data, value: e.target.value })}>
                <option value="">O que a cliente respondeu</option>
                {treatments.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          )}
          {data.action === 'handoff' && <p className="crm-sub" style={{ margin: 0 }}>Pausa as respostas automáticas para esta cliente. Ela aparece no Painel em “Aguardando atendente”.</p>}
          {data.action === 'end' && <p className="crm-sub" style={{ margin: 0 }}>Encerra o fluxo. Com o Início em “Primeira mensagem”, o agente não volta a falar com esta cliente.</p>}
        </>
      )}

      {data.kind !== 'start' && <button type="button" className="crm-btn danger" onClick={onRemove}><Trash2 size={15} /> Apagar bloco</button>}
    </div>
  )
}

function WaitTime({ minutes, onChange }: { minutes: number; onChange: (m: number) => void }) {
  const unit = minutes % 1440 === 0 ? 1440 : minutes % 60 === 0 ? 60 : 1
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input type="number" min={1} value={minutes / unit} onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1) * unit)} />
      <select value={unit} onChange={(e) => onChange(Math.max(1, Math.round(minutes / unit)) * Number(e.target.value))} style={{ width: 'auto' }}>
        <option value={1}>minutos</option>
        <option value={60}>horas</option>
        <option value={1440}>dias</option>
      </select>
    </div>
  )
}

type Line = { direction: 'in' | 'out'; body: string; note?: string }

function Tester({ flow, onNode }: { flow: Flow; onNode: (id: string | null) => void }) {
  const [lines, setLines] = useState<Line[]>([])
  const [run, setRun] = useState<(RunState & { agent_id: string }) | null>(null)
  const [input, setInput] = useState('')
  const [clientName, setClientName] = useState('Maria')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const waitingTimeout = run?.status === 'waiting' && !!run.wait_until

  useEffect(() => { onNode(run?.status === 'waiting' ? run.node_id : null) }, [run, onNode])
  useEffect(() => () => onNode(null), [onNode])

  async function step(text: string | null) {
    const conversation = text === null ? lines : [...lines, { direction: 'in' as const, body: text }]
    setLines(conversation)
    setLoading(true)
    setError('')
    const res = await simulateAgent(flow, run, conversation.map(({ direction, body }) => ({ direction, body })), clientName, text)
    setLoading(false)
    if (!res.ok) return setError(res.error)
    if (!res.effects) return setLines([...conversation, { direction: 'out', body: '(o agente não responde: com o Início em “Primeira mensagem”, ele só fala uma vez com cada cliente. Clique em ↻ para recomeçar.)' }])
    const fx = res.effects
    const notes = [
      fx.clientPatch.stage && `funil → ${stageLabel(fx.clientPatch.stage)}`,
      fx.clientPatch.interest && `interesse → ${fx.clientPatch.interest}`,
      fx.clientPatch.ai_paused && 'passou para atendente',
      fx.run.status === 'done' && !fx.clientPatch.ai_paused && 'fluxo encerrado',
      ...fx.log.filter((l) => l.startsWith('IA falhou')),
    ].filter(Boolean).join(' · ')
    const out: Line[] = fx.messages.map((m) => ({ direction: 'out', body: m.text, note: m.ai ? 'IA' : undefined }))
    if (notes) {
      if (out.length) out[out.length - 1] = { ...out[out.length - 1], note: [out[out.length - 1].note, notes].filter(Boolean).join(' · ') }
      else out.push({ direction: 'out', body: '(sem mensagem)', note: notes })
    }
    setLines([...conversation, ...out])
    setRun(fx.run)
  }

  function send(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    step(text)
  }

  return (
    <div>
      <p className="crm-sub" style={{ margin: '0 0 10px', lineHeight: 1.5 }}>Testa o desenho atual, mesmo sem salvar. Nada é enviado no WhatsApp. O bloco onde a conversa parou fica destacado.</p>
      <label className="crm-field" style={{ marginBottom: 10 }}>Nome da cliente no teste<input value={clientName} onChange={(e) => setClientName(e.target.value)} /></label>
      {error && <div className="crm-alert error">{error}</div>}
      <div className="crm-chat" style={{ minHeight: 260, maxHeight: 'none' }}>
        {lines.length === 0 && <p className="crm-empty">Escreva como se fosse a cliente, por exemplo “Oi”.</p>}
        {lines.map((l, i) => <div key={i} className={`crm-bubble ${l.direction}`}>{l.body}{l.note && <small>{l.note}</small>}</div>)}
        {loading && <div className="crm-bubble out">digitando…</div>}
      </div>
      <form className="crm-chat-input" onSubmit={send}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Mensagem da cliente" />
        <button className="crm-btn" disabled={loading} aria-label="Enviar"><Send size={15} /></button>
        <button type="button" className="crm-btn secondary" onClick={() => { setLines([]); setRun(null) }} aria-label="Recomeçar"><RotateCcw size={15} /></button>
      </form>
      {waitingTimeout && (
        <button className="crm-btn secondary" style={{ marginTop: 8 }} onClick={() => step(null)} disabled={loading}><Timer size={15} /> Simular que ela não respondeu</button>
      )}
      <p className="crm-sub" style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}><Bot size={14} /> Blocos de IA só respondem com a IA ligada e com créditos.</p>
    </div>
  )
}
