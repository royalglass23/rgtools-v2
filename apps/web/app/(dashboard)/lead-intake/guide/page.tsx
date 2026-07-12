import { requireModule } from '@/lib/guard'
import { ModuleGuidePage } from '@/modules/guides/ModuleGuidePage'

export default async function LeadIntakeGuidePage() {
  await requireModule('lead-intake')

  return (
    <ModuleGuidePage
      guide={{
        title: 'Lead Intake Guide',
        summary: 'Use Lead Intake to record a new enquiry, capture the basic job details, and score the lead before quote follow-up.',
        backHref: '/lead-intake',
        backLabel: 'Open Lead Intake',
        sections: [
          {
            title: 'When to use it',
            body: 'Use Lead Intake when a new enquiry comes in by phone, email, WeChat, calculator, contact form, or another channel.',
          },
          {
            title: 'Basic steps',
            items: [
              'Open Lead Intake from the menu.',
              'Enter the customer details, job address, product, and job description.',
              'Fill in the scoring fields you know.',
              'Do not guess answers if the customer has not provided them.',
              'Click Save and score.',
            ],
          },
          {
            title: 'Minimum details',
            items: [
              'Client name or business name.',
              'Phone.',
              'Email.',
              'Job address.',
            ],
          },
          {
            title: 'Simple rule',
            body: 'Lead Intake is for capturing and qualifying the enquiry before it becomes a quoted job or work order.',
          },
        ],
      }}
    />
  )
}
