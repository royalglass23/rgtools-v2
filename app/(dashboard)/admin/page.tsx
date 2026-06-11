import { requireModule } from '@/lib/guard'
import { redirect } from 'next/navigation'

export default async function AdminRedirectPage() {
  await requireModule('admin')
  redirect('/admin/administration')
}
