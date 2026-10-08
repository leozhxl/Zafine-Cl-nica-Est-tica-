import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/admin/sidebar'
import { createClient } from '@/lib/supabase/server'

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/admin/login')

  return (
    <div className="crm-shell">
      <Sidebar email={data.user.email ?? ''} />
      <main className="crm-main">{children}</main>
    </div>
  )
}
