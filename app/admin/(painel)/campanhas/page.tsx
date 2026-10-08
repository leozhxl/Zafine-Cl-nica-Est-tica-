'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Copy, Pencil, Plus, Send, Trash2, X } from 'lucide-react'
import { type Client, sources, stages, treatments } from '@/lib/crm'
import { type Audience, type Campaign, campaignStatusLabels, fillPlaceholders, matchesAudience } from '@/lib/modules'
import { createClient } from '@/lib/supabase/client'

type AudienceClient = Pick<Client, 'id' | 'name' | 'stage' | 'interest' | 'source' | 'phone'> & { marketing_opt_out: boolean }

const statusColor: Record<Campaign['status'], string> = { rascunho: '', agendada: 'avaliacao', enviando: 'contatado', concluida: 'fechado', cancelada: 'perdido' }

function toLocalInput(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export default function CampanhasPage() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null)
  const [clients, setClients] = useState<AudienceClient[]>([])
  const [editing, setEditing] = useState<Partial<Campaign> | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const supabase = createClient()
    const [c, cl] = await Promise.all([
      supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name, stage, interest, source, phone, marketing_opt_out'),
    ])
    if (c.error) return setError(c.error.code === 'PGRST205' ? 'missing' : c.error.message)
    setCampaigns((c.data ?? []) as Campaign[])
    setClients((cl.data ?? []) as AudienceClient[])
  }, [])

  useEffect(() => { load() }, [load])
  // Enquanto alguma campanha está enviando, atualiza o progresso.
  useEffect(() => {
    if (!campaigns?.some((c) => c.status === 'enviando' || c.status === 'agendada')) return
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [campaigns, load])

  async function cancel(c: Campaign) {
    if (!confirm(`Cancelar a campanha "${c.name}"? Quem ainda não recebeu não vai receber.`)) return
    const { error } = await createClient().from('campaigns').update({ status: 'cancelada' }).eq('id', c.id)
    if (error) setError(error.message)
    load()
  }

  async function remove(c: Campaign) {
    if (!confirm(`Excluir a campanha "${c.name}"?`)) return
    const { error } = await createClient().from('campaigns').delete().eq('id', c.id)
    if (error) setError(error.message)
    load()
  }

  if (error === 'missing') return <div className="crm-alert">Falta criar as tabelas: rode o arquivo <b>supabase/modulos.sql</b> no SQL Editor do Supabase e recarregue a página.</div>

  return (
    <>
      <div className="crm-header">
        <div><h1>Campanhas</h1><p>Envio em massa no WhatsApp para um grupo de clientes. <Link href="/admin/ajuda#campanhas" style={{ color: 'var(--blue)' }}>Como funciona?</Link></p></div>
        <button className="crm-btn" onClick={() => setEditing({ audience: {}, template_language: 'pt_BR', body_params: ['{nome}'] })}><Plus size={16} /> Nova campanha</button>
      </div>
      {error && <div className="crm-alert error">{error}</div>}
      <div className="crm-alert">
        O WhatsApp só permite mensagens em massa usando <b>modelos aprovados pela Meta</b> (WhatsApp Manager → Modelos de mensagem). Envie só para quem aceitou receber: clientes marcadas com “Não receber campanhas” ficam de fora automaticamente.
      </div>

      <div className="crm-card">
        {!campaigns ? <p className="crm-empty">Carregando…</p> : campaigns.length === 0 ? <p className="crm-empty">Nenhuma campanha ainda.</p> : (
          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead><tr><th>Campanha</th><th>Status</th><th>Envio</th><th>Resultado</th><th /></tr></thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td><div className="crm-name">{c.name}</div><div className="crm-sub">Modelo: {c.template_name || '—'}</div></td>
                    <td><span className={`crm-badge ${statusColor[c.status]}`}>{campaignStatusLabels[c.status]}</span></td>
                    <td>{c.scheduled_at ? new Date(c.scheduled_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td>{c.status === 'rascunho' ? '—' : `${c.sent_count} enviadas${c.failed_count ? ` · ${c.failed_count} com erro` : ''}`}</td>
                    <td className="actions">
                      {c.status === 'rascunho' && <button className="crm-icon-btn" onClick={() => setEditing(c)} aria-label="Editar"><Pencil size={16} /></button>}
                      <button className="crm-icon-btn" onClick={() => setEditing({ ...c, id: undefined, name: `${c.name} (cópia)`, status: 'rascunho', scheduled_at: null })} aria-label="Duplicar"><Copy size={16} /></button>
                      {(c.status === 'agendada' || c.status === 'enviando') && <button className="crm-btn danger" onClick={() => cancel(c)}>Cancelar</button>}
                      {(c.status === 'rascunho' || c.status === 'concluida' || c.status === 'cancelada') && <button className="crm-icon-btn" onClick={() => remove(c)} aria-label="Excluir"><Trash2 size={16} /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && <CampaignModal campaign={editing} clients={clients} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
    </>
  )
}

function MultiCheck({ label, options, value, onChange }: { label: string; options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="crm-field full">{label} <small>Nada marcado = todas.</small>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
        {options.map((o) => (
          <label key={o.value} className="crm-check" style={{ fontWeight: 400 }}>
            <input type="checkbox" checked={value.includes(o.value)} onChange={(e) => onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value))} /> {o.label}
          </label>
        ))}
      </div>
    </div>
  )
}

function CampaignModal({ campaign, clients, onClose, onSaved }: { campaign: Partial<Campaign>; clients: AudienceClient[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<Campaign>>({ name: '', preview: '', ...campaign })
  const [when, setWhen] = useState<'agora' | 'depois'>(campaign.scheduled_at ? 'depois' : 'agora')
  const [scheduledLocal, setScheduledLocal] = useState(toLocalInput(campaign.scheduled_at ?? null))
  const [error, setError] = useState('')
  const audience: Audience = form.audience ?? {}
  const params = form.body_params ?? []
  const setAudience = (patch: Audience) => setForm((f) => ({ ...f, audience: { ...f.audience, ...patch } }))
  const recipients = useMemo(() => clients.filter((c) => matchesAudience(c, audience)), [clients, audience])
  const sample = recipients[0]

  async function persist(status: 'rascunho' | 'agendada') {
    setError('')
    if (status === 'agendada') {
      if (!form.template_name?.trim()) return setError('Informe o nome do modelo aprovado na Meta.')
      if (!recipients.length) return setError('Nenhuma cliente nesse público.')
      if (when === 'depois' && !scheduledLocal) return setError('Escolha a data e a hora do envio.')
      if (!confirm(`Enviar para ${recipients.length} cliente(s)${when === 'agora' ? ' agora' : ''}?`)) return
    }
    const payload = {
      name: form.name,
      audience,
      template_name: (form.template_name ?? '').trim(),
      template_language: form.template_language || 'pt_BR',
      body_params: params,
      preview: form.preview ?? '',
      status,
      scheduled_at: status === 'agendada' ? (when === 'agora' ? new Date().toISOString() : new Date(scheduledLocal).toISOString()) : null,
    }
    const supabase = createClient()
    const { error } = form.id ? await supabase.from('campaigns').update(payload).eq('id', form.id) : await supabase.from('campaigns').insert(payload)
    if (error) return setError(error.message)
    onSaved()
  }

  return (
    <div className="crm-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="crm-modal" style={{ width: 'min(760px, 100%)' }} onSubmit={(e) => { e.preventDefault(); persist('agendada') }}>
        <div className="crm-modal-head">
          <h2>{form.id ? 'Editar campanha' : 'Nova campanha'}</h2>
          <button type="button" className="crm-icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        {error && <div className="crm-alert error">{error}</div>}
        <div className="crm-form">
          <label className="crm-field full">Nome da campanha<input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Ex.: Promoção de novembro" /></label>

          <MultiCheck label="Etapa do funil" options={stages} value={audience.stages ?? []} onChange={(v) => setAudience({ stages: v as Audience['stages'] })} />
          <MultiCheck label="Tratamento de interesse" options={treatments.map((t) => ({ value: t, label: t }))} value={audience.interests ?? []} onChange={(v) => setAudience({ interests: v })} />
          <MultiCheck label="Origem" options={sources.map((s) => ({ value: s, label: s }))} value={audience.sources ?? []} onChange={(v) => setAudience({ sources: v })} />
          <div className="crm-alert ok full" style={{ margin: 0 }}><b>{recipients.length}</b> cliente(s) vão receber (com telefone e sem “Não receber campanhas”).</div>

          <label className="crm-field">Nome do modelo na Meta<input value={form.template_name ?? ''} onChange={(e) => setForm({ ...form, template_name: e.target.value })} placeholder="ex.: promocao_laser" /></label>
          <label className="crm-field">Idioma do modelo<input value={form.template_language ?? 'pt_BR'} onChange={(e) => setForm({ ...form, template_language: e.target.value })} /></label>
          <div className="crm-field full">Variáveis do modelo ({'{{1}}'}, {'{{2}}'}…)
            <small>Use {'{nome}'} e {'{servico}'} (tratamento de interesse). A quantidade precisa ser igual à do modelo aprovado.</small>
            {params.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span className="crm-badge">{`{{${i + 1}}}`}</span>
                <input value={p} onChange={(e) => setForm({ ...form, body_params: params.map((x, j) => (j === i ? e.target.value : x)) })} />
                <button type="button" className="crm-icon-btn" onClick={() => setForm({ ...form, body_params: params.filter((_, j) => j !== i) })} aria-label="Remover"><Trash2 size={15} /></button>
              </div>
            ))}
            <button type="button" className="crm-btn secondary" style={{ alignSelf: 'flex-start' }} onClick={() => setForm({ ...form, body_params: [...params, ''] })}><Plus size={15} /> Adicionar variável</button>
          </div>
          <label className="crm-field full">Texto do modelo (para o histórico)
            <small>Copie o texto do modelo como está na Meta, trocando {'{{1}}'} por {'{nome}'} etc. É o que aparece nas Conversas.</small>
            <textarea rows={3} value={form.preview ?? ''} onChange={(e) => setForm({ ...form, preview: e.target.value })} placeholder="Oi, {nome}! Neste mês a depilação a laser está com condições especiais…" />
          </label>
          {sample && form.preview && <div className="crm-bubble out full" style={{ maxWidth: '100%' }}>{fillPlaceholders(form.preview, { nome: sample.name, servico: sample.interest ?? '' })}<small>Exemplo para {sample.name}</small></div>}

          <div className="crm-field full">Quando enviar
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <label className="crm-check" style={{ fontWeight: 400 }}><input type="radio" checked={when === 'agora'} onChange={() => setWhen('agora')} /> Agora (em até 1 minuto)</label>
              <label className="crm-check" style={{ fontWeight: 400 }}><input type="radio" checked={when === 'depois'} onChange={() => setWhen('depois')} /> Agendar</label>
              {when === 'depois' && <input type="datetime-local" value={scheduledLocal} onChange={(e) => setScheduledLocal(e.target.value)} style={{ width: 'auto' }} />}
            </div>
            <small>O envio é feito aos poucos (25 mensagens por minuto) para não sobrecarregar o WhatsApp.</small>
          </div>
        </div>
        <div className="crm-modal-foot">
          <button type="button" className="crm-btn secondary" onClick={() => persist('rascunho')}>Salvar rascunho</button>
          <div>
            <button type="button" className="crm-btn secondary" onClick={onClose}>Fechar</button>
            <button className="crm-btn"><Send size={15} /> {when === 'agora' ? 'Enviar' : 'Agendar envio'}</button>
          </div>
        </div>
      </form>
    </div>
  )
}
