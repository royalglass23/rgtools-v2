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
            body: 'Work Order is not for creating quote links or continuing lead scoring after the job has moved on from Quote status.',
          },
        ],
      }}
    />
  )
}
