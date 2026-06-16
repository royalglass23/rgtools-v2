# Quote tracking privacy note

This is an internal engineering note for rgtools quote tracking. It is not legal advice or customer-facing policy text.

## What is collected

Quote tracking stores the viewer's IP address, Cloudflare-derived geolocation details where available (country, city, region, and ISP/organisation), device type, page view events, time spent viewing, scroll depth, PDF download/print and CTA events, and a per-browser session ID. If an email gate is enabled for a quote, intended recipient email addresses are stored before sharing. Successful gate submissions also store the viewer's matched email address, optional name, recipient ID, session ID, IP address, and capture timestamp.

## Purpose and legal basis

The purpose is internal B2B quote engagement tracking for Royal Glass staff. It helps staff understand whether a commercial quote has been opened, reviewed, forwarded, or revisited so follow-up can be timely and relevant.

The intended NZ Privacy Act 2020 basis is legitimate business interest, with data minimisation applied to avoid collecting more than is needed for the quote workflow. Tracking data is not sold, rented, or shared with third parties for marketing. Cloudflare and Neon process the data only as infrastructure providers for rgtools.

## Retention

Raw IP addresses in `quote_events.ip` are purged automatically after 90 days by the cleanup cron. Less sensitive aggregate and context fields, such as geolocation, device type, page counts, scroll depth, and time-spent metrics, are retained for up to 12 months for internal reporting and quote performance review.

PDF files are deleted from R2 when a quote expires, and the quote row is archived by clearing `pdf_storage_key` and setting `archived_at`.

## Access and opt-out

Access is limited to internal Royal Glass staff through the rgtools dashboard and operational database access. Captured viewer emails are for internal quote workflow use only.

Opt-out is not offered in the viewer because the feature is used for B2B commercial quotes sent to business clients. Staff should disable tracking or the email gate for a quote before sending it when a client relationship or project context requires a lighter privacy posture.
