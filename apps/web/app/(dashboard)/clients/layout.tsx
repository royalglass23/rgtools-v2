import { requireModule } from '@/lib/guard'

export default async function ClientsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModule('clients')
  return <>{children}</>
}
