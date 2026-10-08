import { headers } from 'next/headers'
import { IaPanel, type Tab } from './ia-panel'

export default async function IaPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const { aba } = await searchParams
  const host = (await headers()).get('host')
  const status = {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    whatsapp: !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    webhook: !!(process.env.WHATSAPP_VERIFY_TOKEN && process.env.WHATSAPP_APP_SECRET),
    serviceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  }
  return <IaPanel status={status} webhookUrl={`https://${host}/api/whatsapp`} initialTab={(['menu', 'ia', 'testar', 'conversas'] as Tab[]).includes(aba as Tab) ? (aba as Tab) : 'menu'} />
}
