import { requireModule } from '@/lib/guard'

export default async function CalculatorPricingAdminPage() {
  await requireModule('admin/calculator-pricing')

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Cost Calculator Price</h1>
      <div className="rounded border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-600">
          Cost calculator pricing controls will be added here when the pricing issue lands.
        </p>
      </div>
    </div>
  )
}
