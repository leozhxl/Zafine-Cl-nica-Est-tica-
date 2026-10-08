import { redirect } from 'next/navigation'

// Endereço antigo da aba (antes chamada "WhatsApp").
export default function OldIaPage() {
  redirect('/admin/conversas')
}
