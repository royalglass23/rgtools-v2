import { requireModule } from '@/lib/guard'
import { ModuleGuidePage } from '@/modules/guides/ModuleGuidePage'

export default async function QuoteTrackerGuidePage() {
  await requireModule('quote-tracker')

  return (
    <ModuleGuidePage
      guide={{
        title: 'Quote Tracker Guide',
        summary: 'Use Quote Tracker to create tracked quote links, send them to customers, and check quote engagement.',
        backHref: '/quote-tracker',
        backLabel: 'Open Quote Tracker',
        sections: [
          {
            title: 'When to use it',
            body: 'Use Quote Tracker when the quote already exists in ServiceM8 and you want to send a tracked quote link to the customer.',
          },
          {
            title: 'Basic steps',
            items: [
              'Make sure the quote PDF has been generated in ServiceM8.',
              'Open Quote Tracker from the menu.',
              'Click Track Quote.',
              'Enter the ServiceM8 job number.',
              'Copy the tracked quote link.',
              'Send that link to the customer.',
              'Check Quote Tracker later for opens, viewing activity, and interest level.',
            ],
          },
          {
            title: 'Email gate',
            body: 'Turn on the email gate before sending the link if you want the customer to enter their email before viewing the quote.',
          },
          {
            title: 'Simple rule',
            body: 'Quote Tracker is for quote sending and follow-up, not for scoring new leads or managing active work orders.',
          },
        ],
      }}
    />
  )
}
