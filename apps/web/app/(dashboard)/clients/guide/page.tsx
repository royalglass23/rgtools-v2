import { ModuleGuidePage } from '@/modules/guides/ModuleGuidePage'

export default async function ClientsGuidePage() {
  return (
    <ModuleGuidePage
      guide={{
        title: 'Clients Guide',
        summary: 'Use Clients to find the customer record and review the connected lead, quote, and work order context.',
        backHref: '/clients',
        backLabel: 'Open Clients',
        sections: [
          {
            title: 'When to use it',
            body: 'Use Clients when you need the customer record rather than only one lead, quote, or job.',
          },
          {
            title: 'Basic steps',
            items: [
              'Open Clients from the menu.',
              'Search by client name, company name, or alias.',
              'Use cleanup filters when reviewing records that need attention.',
              'Open the client record to view linked leads, tracked quotes, work orders, notes, and contact details.',
            ],
          },
          {
            title: 'Merge Review',
            body: 'Admins use Merge Review when the system finds possible duplicate client records that need human confirmation.',
          },
          {
            title: 'Simple rule',
            body: 'Clients is the customer history area. Use the module-specific pages when you need to capture a lead, send a quote link, or manage an active work order.',
          },
        ],
      }}
    />
  )
}
