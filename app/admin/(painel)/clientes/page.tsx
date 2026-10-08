'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { MessageCircle, Pencil, Plus } from 'lucide-react'
import { ClientModal } from '@/components/admin/client-modal'
import { type Client, formatPhone, stageLabel, stages, whatsappUrl } from '@/lib/crm'
import { createClient } from '@/lib/supabase/client'

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stage, setStage] = useState('')
  const [editing, setEditing] = useState<Partial<Client> | null>(null)

  const load = useCallback(async () => {
    const { data } = await createClient().from('clients').select('*').order('created_at', { ascending: false })
    setClients((data ?? []) as Client[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const digits = q.replace(/\D/g, '')
    return clients.filter((c) =>
      (!stage || c.stage === stage) &&
      (!q || c.name.toLowerCase().includes(q) || (digits && c.phone?.includes(digits)) || c.email?.toLowerCase().includes(q)),
    )
  }, [clients, search, stage])

  return (
    <>
      <div className="crm-header">
        <div><h1>Clientes</h1><p>{clients.length} contatos cadastrados</p></div>
        <button className="crm-btn" onClick={() => setEditing({})}><Plus size={16} /> Novo cliente</button>
      </div>

      <div className="crm-card">
        <div className="crm-toolbar">
          <input placeholder="Buscar por nome, telefone ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">Todas as etapas</option>
            {stages.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="crm-table-wrap">
          <table className="crm-table">
            <thead><tr><th>Nome</th><th>Etapa</th><th>Interesse</th><th>Origem</th><th>Cadastro</th><th /></tr></thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td><div className="crm-name">{c.name}</div><div className="crm-sub">{formatPhone(c.phone)}{c.ai_paused ? ' · robô pausado' : ''}</div></td>
                  <td><span className={`crm-badge ${c.stage}`}>{stageLabel(c.stage)}</span></td>
                  <td>{c.interest ?? '—'}</td>
                  <td>{c.source}</td>
                  <td>{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="actions">
                    {c.phone && <a className="crm-icon-btn" href={whatsappUrl(c.phone)} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={16} /></a>}
                    <button className="crm-icon-btn" onClick={() => setEditing(c)} aria-label="Editar"><Pencil size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && <p className="crm-empty">Nenhum cliente encontrado.</p>}
          {loading && <p className="crm-empty">Carregando…</p>}
        </div>
      </div>

      {editing && <ClientModal client={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
    </>
  )
}
