import Link from 'next/link'
import { CheckCircle2, Circle, CircleAlert } from 'lucide-react'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Sua jornada · CRM Zafine' }

type Step = { title: string; done: boolean; text: string; href?: string; action?: string; optional?: boolean; warning?: boolean }

async function signupClosed() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! }, cache: 'no-store' })
    return ((await res.json()) as { disable_signup?: boolean }).disable_signup === true
  } catch {
    return false
  }
}

async function teamSize() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  try {
    const { data } = await createServiceClient().auth.admin.listUsers({ perPage: 100 })
    return data.users.length
  } catch {
    return null
  }
}

export default async function JornadaPage() {
  const supabase = await createClient()
  const count = (q: PromiseLike<{ count: number | null; error: unknown }>) => q.then((r) => (r.error ? null : r.count ?? 0))
  const head = { count: 'exact' as const, head: true }

  const [closed, team, agents, activeAgents, services, inbound, agentBookings, automations, campaigns, ai, clients] = await Promise.all([
    signupClosed(),
    teamSize(),
    count(supabase.from('agents').select('id', head)),
    count(supabase.from('agents').select('id', head).eq('enabled', true)),
    count(supabase.from('services').select('id', head).eq('active', true)),
    count(supabase.from('whatsapp_messages').select('id', head).eq('direction', 'in')),
    count(supabase.from('appointments').select('id', head).eq('created_by', 'agente')),
    count(supabase.from('automations').select('id', head).eq('enabled', true)),
    count(supabase.from('campaigns').select('id', head)),
    supabase.from('ai_settings').select('enabled').eq('id', 1).maybeSingle(),
    count(supabase.from('clients').select('id', head)),
  ])
  const whatsapp = !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_VERIFY_TOKEN && process.env.WHATSAPP_APP_SECRET)
  const missingTables = [agents, services, automations].some((c) => c === null)

  const steps: Step[] = [
    {
      title: 'Proteger o acesso ao CRM',
      done: closed,
      warning: !closed,
      text: closed ? 'O cadastro público está fechado: só entra quem você criar.' : 'O cadastro público do Supabase está aberto: qualquer pessoa poderia criar uma conta e ver os dados. Desligue em Supabase → Authentication → “Allow new users to sign up”.',
    },
    {
      title: 'Cadastrar a equipe',
      done: (team ?? 0) > 1,
      text: team === null ? 'Crie um login para cada pessoa da equipe em Supabase → Authentication → Users → Add user.' : `${team} login(s) criado(s). Crie um para cada pessoa da equipe em Supabase → Authentication → Users → Add user.`,
    },
    {
      title: 'Configurar horários e serviços',
      done: (services ?? 0) > 0,
      text: 'Dias e horários de atendimento, almoço, feriados e a duração de cada serviço. É daqui que o agente tira os horários livres.',
      href: '/admin/agenda/horarios',
      action: 'Abrir horários',
    },
    {
      title: 'Criar o agente de atendimento',
      done: (agents ?? 0) > 0,
      text: 'Comece pelo modelo “Agendamento de avaliação”, ajuste os textos e teste na aba Testar do editor.',
      href: '/admin/agentes',
      action: 'Abrir agentes',
    },
    {
      title: 'Ativar o agente',
      done: (activeAgents ?? 0) > 0,
      text: 'Marque “Ativo” no editor e salve. Só um agente fica ativo por vez.',
      href: '/admin/agentes',
      action: 'Abrir agentes',
    },
    {
      title: 'Conectar o WhatsApp',
      done: whatsapp,
      text: 'Crie o app na Meta (WhatsApp Cloud API) e cadastre as chaves na Vercel. A URL do webhook está em Conversas → Conexão.',
      href: '/admin/conversas?aba=conexao',
      action: 'Ver conexão',
    },
    {
      title: 'Receber a primeira mensagem',
      done: (inbound ?? 0) > 0,
      text: 'Mande uma mensagem de outro celular para o número da clínica e veja ela aparecer em Conversas.',
      href: '/admin/conversas',
      action: 'Abrir conversas',
    },
    {
      title: 'Primeira consulta marcada pelo agente',
      done: (agentBookings ?? 0) > 0,
      text: 'Quando o agente marcar a primeira sessão, ela aparece na Agenda com 🤖.',
      href: '/admin/agenda',
      action: 'Abrir agenda',
    },
    {
      title: 'Cadastrar os clientes atuais',
      done: (clients ?? 0) > 5,
      optional: true,
      text: 'Traga os clientes que já existem (por exemplo, do Qontrol) para usar o funil, as campanhas e os relatórios.',
      href: '/admin/clientes',
      action: 'Abrir clientes',
    },
    {
      title: 'Ligar uma automação',
      done: (automations ?? 0) > 0,
      optional: true,
      text: 'Por exemplo, o lembrete 24h antes da sessão ou uma tarefa para cada lead novo.',
      href: '/admin/automacoes',
      action: 'Abrir automações',
    },
    {
      title: 'Criar a primeira campanha',
      done: (campaigns ?? 0) > 0,
      optional: true,
      text: 'Precisa de um modelo de mensagem aprovado pela Meta.',
      href: '/admin/campanhas',
      action: 'Abrir campanhas',
    },
    {
      title: 'Ligar a IA',
      done: !!ai.data?.enabled,
      optional: true,
      text: 'Opcional e pago por uso. Responde perguntas abertas usando o roteiro e as informações da clínica.',
      href: '/admin/conversas?aba=ia',
      action: 'Configurar IA',
    },
  ]

  const essential = steps.filter((s) => !s.optional)
  const doneCount = essential.filter((s) => s.done).length
  const pct = Math.round((doneCount / essential.length) * 100)

  return (
    <>
      <div className="crm-header">
        <div><h1>Sua jornada</h1><p>O caminho para deixar o atendimento automático funcionando. Os passos se marcam sozinhos.</p></div>
      </div>

      {missingTables && <div className="crm-alert">Algumas tabelas ainda não existem. Rode no Supabase os arquivos da pasta <b>supabase/</b> que faltam (por exemplo, modulos.sql) e recarregue.</div>}

      <div className="crm-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 style={{ margin: 0 }}>{doneCount} de {essential.length} passos essenciais</h2>
          <strong style={{ font: '400 28px Georgia, serif', color: 'var(--navy)' }}>{pct}%</strong>
        </div>
        <div className="crm-bar" style={{ height: 10, marginTop: 12 }}><span style={{ width: `${pct}%` }} /></div>
      </div>

      <div className="crm-grid">
        {[{ title: 'Essenciais', items: essential }, { title: 'Para ir além', items: steps.filter((s) => s.optional) }].map((group) => (
          <div key={group.title} className="crm-card">
            <h2>{group.title}</h2>
            <ul className="crm-list">
              {group.items.map((s) => (
                <li key={s.title} style={{ alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {s.done ? <CheckCircle2 size={22} color="var(--ok)" style={{ flex: 'none' }} /> : s.warning ? <CircleAlert size={22} color="var(--danger)" style={{ flex: 'none' }} /> : <Circle size={22} color="#b8c7cd" style={{ flex: 'none' }} />}
                    <div>
                      <div className="crm-name" style={{ textDecoration: s.done ? 'line-through' : undefined, opacity: s.done ? 0.7 : 1 }}>{s.title}</div>
                      <div className="crm-sub" style={{ lineHeight: 1.5, color: s.warning ? 'var(--danger)' : undefined }}>{s.text}</div>
                    </div>
                  </div>
                  {s.href && !s.done && <Link className="crm-btn secondary" href={s.href} style={{ flex: 'none' }}>{s.action}</Link>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  )
}
