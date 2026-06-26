import { requireModule } from '@/lib/guard'

export default async function PsGeneratorLayout({ children }: { children: React.ReactNode }) {
  await requireModule('ps-generator')
  return <>{children}</>
}
