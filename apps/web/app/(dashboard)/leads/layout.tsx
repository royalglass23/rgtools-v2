import { requireModule } from '@/lib/guard'

export default async function LeadsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModule('leads')
  return <>{children}</>
}
