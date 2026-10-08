'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Copy, Pencil, Plus, Trash2, X } from 'lucide-react'
import { type Agent, emptyFlow, schedulingTemplateFlow, templateFlow } from '@/lib/agent-flow'
import { createClient } from '@/lib/supabase/client'

export default function AgentesPage() {
  const router = useRouter()
  const [agents, setAgents] = useState<Agent[] | null>(null)
  const [missingTable, setMissingTable] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await createClient().from('agents').select('id, name, enabled, flow, updated_at').order('updated_at', { ascending: false })
    if (error) return setMissingTable(true)
    setAgents((data ?? []) as Agent[])
  }, [])

  useEffect(() => { load() }, [load])

  async function toggle(agent: Agent) {
    const supabase = createClient()
    // Só um agente ativo por vez.
    if (!agent.enabled) await supabase.from('agents').update({ enabled: false }).neq('id', agent.id)
    const { error } = await supabase.from('agents').update({ enabled: !agent.enabled }).eq('id', agent.id)
    if (error) setError(error.message)
    load()
  }

  async function duplicate(agent: Agent) {
    const { error } = await createClient().from('agents').insert({ name: `${agent.name} (cópia)`, flow: agent.flow, enabled: false })
    if (error) setError(error.message)
    load()
  }

  async function remove(agent: Agent) {
    if (!confirm(`Excluir o agente "${agent.name}"?`)) return
    const { error } = await createClient().from('agents').delete().eq('id', agent.id)
    if (error) setError(error.message)
    load()
  }

  async function create(name: string, template: Template) {
    const flow = template === 'agendamento' ? schedulingTemplateFlow() : template === 'atendimento' ? templateFlow() : emptyFlow()
    const { data, error } = await createClient().from('agents').insert({ name, flow }).select('id').single()
    if (error) return setError(error.message)
    router.push(`/admin/agentes/${data.id}`)
  }

  return (
    <>
      <div className="crm-header">
        <div>
          <h1>Agentes</h1>
          <p>Monte o caminho da conversa em blocos. O agente ativo responde as clientes no WhatsApp. <Link href="/admin/ajuda#agentes" style={{ color: 'var(--blue)' }}>Como funciona?</Link></p>
        </div>
        {!missingTable && <button className="crm-btn" onClick={() => setCreating(true)}><Plus size={16} /> Novo agente</button>}
      </div>

      {error && <div className="crm-alert error">{error}</div>}
      {missingTable && <div className="crm-alert">Falta criar as tabelas dos agentes: rode o arquivo <b>supabase/agentes.sql</b> no SQL Editor do Supabase e recarregue a página.</div>}

      {agents && (
        <div className="crm-card">
          {agents.length === 0 ? <p className="crm-empty">Nenhum agente ainda. Clique em “Novo agente” e comece pelo modelo pronto.</p> : (
            <ul className="crm-list">
              {agents.map((a) => (
                <li key={a.id}>
                  <div>
                    <Link href={`/admin/agentes/${a.id}`} className="crm-name">{a.name}</Link>
                    <div className="crm-sub">{a.flow.nodes.length} blocos · editado em {new Date(a.updated_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button className={`crm-badge ${a.enabled ? 'fechado' : 'perdido'}`} style={{ border: 0, cursor: 'pointer' }} onClick={() => toggle(a)} title="Ligar/desligar">
                      {a.enabled ? 'Ativo' : 'Desligado'}
                    </button>
                    <Link className="crm-icon-btn" href={`/admin/agentes/${a.id}`} aria-label="Editar"><Pencil size={16} /></Link>
                    <button className="crm-icon-btn" onClick={() => duplicate(a)} aria-label="Duplicar"><Copy size={16} /></button>
                    <button className="crm-icon-btn" onClick={() => remove(a)} aria-label="Excluir"><Trash2 size={16} /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="crm-sub" style={{ marginTop: 14, lineHeight: 1.6 }}>
            Só um agente fica ativo por vez. Quando ele não responde (por exemplo, a cliente já passou pelo fluxo), a IA da aba Conversas responde sozinha, se estiver ligada.
          </p>
        </div>
      )}

      {creating && <NewAgentModal onClose={() => setCreating(false)} onCreate={create} />}
    </>
  )
}

type Template = 'agendamento' | 'atendimento' | 'branco'
const templateNames: Record<Template, string> = { agendamento: 'Agendamento de avaliação', atendimento: 'Atendimento', branco: 'Novo agente' }

function NewAgentModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, template: Template) => void }) {
  const [template, setTemplate] = useState<Template>('agendamento')
  const [name, setName] = useState(templateNames.agendamento)
  const choose = (t: Template) => { setTemplate(t); setName(templateNames[t]) }
  return (
    <div className="crm-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="crm-modal" onSubmit={(e) => { e.preventDefault(); onCreate(name, template) }}>
        <div className="crm-modal-head">
          <h2>Novo agente</h2>
          <button type="button" className="crm-icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="crm-form">
          <label className="crm-field full">Nome<input value={name} onChange={(e) => setName(e.target.value)} required autoFocus /></label>
          <label className="crm-check full"><input type="radio" checked={template === 'agendamento'} onChange={() => choose('agendamento')} /> <span><b>Agendamento de avaliação</b> (recomendado): aborda o lead, mostra os horários livres da agenda e marca a consulta sozinho</span></label>
          <label className="crm-check full"><input type="radio" checked={template === 'atendimento'} onChange={() => choose('atendimento')} /> <span><b>Atendimento</b>: boas-vindas, tratamentos e passar para a equipe agendar</span></label>
          <label className="crm-check full"><input type="radio" checked={template === 'branco'} onChange={() => choose('branco')} /> <span>Começar em branco</span></label>
        </div>
        <div className="crm-modal-foot"><div>
          <button type="button" className="crm-btn secondary" onClick={onClose}>Cancelar</button>
          <button className="crm-btn">Criar e abrir editor</button>
        </div></div>
      </form>
    </div>
  )
}
