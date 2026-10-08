import { headers } from 'next/headers'
import { ConversasPanel, type Tab } from './conversas-panel'

export default async function ConversasPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const { aba } = await searchParams
  const host = (await headers()).get('host')
  const status = {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    whatsapp: !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    webhook: !!(process.env.WHATSAPP_VERIFY_TOKEN && process.env.WHATSAPP_APP_SECRET),
    serviceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  }
  return <ConversasPanel status={status} webhookUrl={`https://${host}/api/whatsapp`} initialTab={(['conversas', 'ia', 'conexao'] as Tab[]).includes(aba as Tab) ? (aba as Tab) : 'conversas'} />
}
