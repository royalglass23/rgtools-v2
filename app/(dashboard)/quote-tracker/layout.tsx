import { requireModule } from '@/lib/guard'

export default async function QuoteTrackerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModule('quote-tracker')
  return <>{children}</>
}
