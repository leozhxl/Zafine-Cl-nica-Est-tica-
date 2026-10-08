'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { ClientModal } from '@/components/admin/client-modal'
import { type Client, type Stage, formatPhone, stages } from '@/lib/crm'
import { createClient } from '@/lib/supabase/client'

export default function FunilPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<Stage | null>(null)
  const [editing, setEditing] = useState<Partial<Client> | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data } = await createClient().from('clients').select('*').order('updated_at', { ascending: false })
    setClients((data ?? []) as Client[])
  }, [])

  useEffect(() => { load() }, [load])

  async function moveTo(stage: Stage) {
    const id = dragging
    setDragging(null)
    setOver(null)
    const client = clients.find((c) => c.id === id)
    if (!client || client.stage === stage) return
    const previous = clients
    const updated_at = new Date().toISOString()
    setClients((list) => list.map((c) => (c.id === id ? { ...c, stage, updated_at } : c)))
    const { error } = await createClient().from('clients').update({ stage, updated_at }).eq('id', id)
    if (error) {
      setClients(previous)
      setError(`Não foi possível mover: ${error.message}`)
    }
  }

  return (
    <>
      <div className="crm-header">
        <div><h1>Funil</h1><p>Arraste os cartões para mudar a etapa do atendimento.</p></div>
        <button className="crm-btn" onClick={() => setEditing({})}><Plus size={16} /> Novo lead</button>
      </div>
      {error && <div className="crm-alert error">{error}</div>}

      <div className="crm-kanban">
        {stages.map((s) => {
          const items = clients.filter((c) => c.stage === s.value)
          return (
            <div
              key={s.value}
              className={`crm-column ${over === s.value ? 'over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setOver(s.value) }}
              onDragLeave={() => setOver(null)}
              onDrop={() => moveTo(s.value)}
            >
              <div className="crm-column-head">{s.label} <span>{items.length}</span></div>
              {items.map((c) => (
                <div
                  key={c.id}
                  className={`crm-deal ${dragging === c.id ? 'dragging' : ''}`}
                  draggable
                  onDragStart={() => setDragging(c.id)}
                  onDragEnd={() => setDragging(null)}
                  onClick={() => setEditing(c)}
                >
                  <div className="crm-name">{c.name}</div>
                  <div className="crm-sub">{formatPhone(c.phone)}</div>
                  <div className="crm-deal-foot">
                    <span>{c.interest ?? 'Sem interesse definido'}</span>
                    {c.ai_paused && <span title="Robô pausado">👤</span>}
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {editing && <ClientModal client={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
    </>
  )
}
