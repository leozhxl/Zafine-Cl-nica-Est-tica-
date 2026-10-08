'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await createClient().auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) return setError('E-mail ou senha incorretos.')
    router.replace('/admin')
    router.refresh()
  }

  return (
    <main className="crm-login">
      <form onSubmit={submit}>
        <span className="brand"><span className="brand-mark">Z</span><span><strong>Zafine</strong><small>CRM · ÁREA RESTRITA</small></span></span>
        {error && <div className="crm-alert error">{error}</div>}
        <label className="crm-field">E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></label>
        <label className="crm-field">Senha<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        <button className="crm-btn" disabled={loading}>{loading ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </main>
  )
}
