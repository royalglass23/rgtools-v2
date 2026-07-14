import { requireModule } from '@/lib/guard'
import { ModuleGuidePage } from '@/modules/guides/ModuleGuidePage'

export default async function WorkOrderGuidePage() {
  await requireModule('work-orders')

  return (
    <ModuleGuidePage
      guide={{
        title: 'Work Order Guide',
        summary: 'Use Work Order to view and manage jobs after they have moved to Work Order status in ServiceM8.',
        backHref: '/work-orders',
        backLabel: 'Open Work Orders',
        sections: [
          {
            title: 'When to use it',
            body: 'Use Work Order once the job has moved to Work Order status in ServiceM8.',
          },
          {
            title: 'Basic steps',
            items: [
              'Open Work Order from the menu.',
              'Refresh from ServiceM8 if the list needs updating.',
              'Search or filter for the job.',
              'Expand the job to review each ServiceM8 item and its short production label.',
              'If you have Manage access, correct the short label directly or use Regenerate with AI after confirming the replacement.',
              'Open the work order to view job details.',
              'Update internal operational fields such as stage, installer, install date, risk, importance, or notes when needed.',
            ],
          },
          {
            title: 'What it is for',
            body: 'Work Order is for managing active work and internal job progress.',
          },
          {
            title: 'Simple rule',
            body: 'Edit only the short production label in RG Tools. Quantity, item code, and the full ServiceM8 description remain read-only source information. A Label pending badge means the original description is being used until generation succeeds or a manager corrects it.',
          },
        ],
      }}
    />
  )
}
