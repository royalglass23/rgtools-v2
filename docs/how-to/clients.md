# Client Records

The Clients area shows the canonical RG Tools client records that connect lead intake, quote tracking, and ServiceM8 job context.

## Who can use it

- Staff need access to the `clients` module.
- Admins can also use client merge review under **Admin -> Client Merge Review**.

## Client list

Open **Clients** from the navigation bar. The list is for finding the customer record before jumping into related work.

Use it to check:

- Client or company name.
- Aliases or alternate names from imports and merges.
- Phone and email details.
- Linked leads.
- Linked tracked quotes.
- ServiceM8 job context where available.

Use **Search** to find a client by canonical name or alias. Use **Cleanup filter** after a ServiceM8 import to narrow the list to imported clients, clients that need review, reviewed clients, possible duplicates, clients with no contact details, clients with no client type, or ServiceM8-linked clients.

Client matching is based on normalised phone and email values. When a new lead or tracked quote arrives, rgtools tries to connect it to the existing client record rather than creating a duplicate.

## Client detail

Open a client row to see the detail page at `/clients/[id]`.

The detail page is the best place to answer:

- Which leads came from this client?
- Which quote links have been sent to this client?
- What job or ServiceM8 context is already connected?
- Are there duplicate records that an admin should review?

Use the linked lead and quote rows to move into the workflow that needs action.

## Duplicate clients

Duplicate client records can happen when contact details are missing, typed differently, or imported from older jobs.

Admins review suspected duplicates from **Admin -> Client Merge Review**. Merge cleanup is intentionally admin-controlled because client records connect multiple workflows.

## Developer reference

| Thing | Location |
|-------|----------|
| Client list route | `apps/web/app/(dashboard)/clients/page.tsx` |
| Client detail route | `apps/web/app/(dashboard)/clients/[id]/page.tsx` |
| Client queries | `apps/web/modules/clients/queries.ts` |
| Client resolver | `apps/web/modules/clients/client-resolver.ts` |
| Merge planner | `apps/web/modules/clients/merge-planner.ts` |
| Merge cleanup | `apps/web/modules/clients/merge-cleanup.ts` |
| Admin merge review | `apps/web/app/(dashboard)/admin/client-merge-review/page.tsx` |
