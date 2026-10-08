'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { AgentEditor } from '@/components/admin/agent-editor'
import type { Agent } from '@/lib/agent-flow'
import { createClient } from '@/lib/supabase/client'

export default function AgentPage() {
  const { id } = useParams<{ id: string }>()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    createClient().from('agents').select('*').eq('id', id).maybeSingle().then(({ data, error }) => {
      if (error || !data) setError('Agente não encontrado.')
      else setAgent(data as Agent)
    })
  }, [id])

  if (error) return <div className="crm-alert error">{error}</div>
  if (!agent) return <p className="crm-empty">Carregando…</p>
  return <AgentEditor agent={agent} />
}
