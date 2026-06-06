import { requireModule } from '@/lib/guard'

export default async function LeadIntakeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModule('lead-intake')

  return children
}
