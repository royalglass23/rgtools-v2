# Quote Tracking Privacy Note

This is an internal engineering note for rgtools quote tracking. It is not legal advice or customer-facing policy text.

## What Is Collected

Quote tracking stores the viewer's IP address when enabled, a hashed IP copy, Cloudflare-derived geolocation details where available (country, city, region, and ISP/organisation), device type, page view events, time spent viewing, scroll depth, PDF download/print and CTA events, and a per-browser session ID.

If an email gate is enabled for a quote, intended recipient email addresses are stored before sharing. Successful gate submissions also store the viewer's matched email address, optional name, recipient ID, session ID, IP address, and capture timestamp.

Quote AI Guidance may store a ServiceM8 conversation/context snapshot, an AI-generated next viable move, confidence and timing notes, phone talking points, an email draft, and failure metadata. This content is staff-facing and used only to guide follow-up. It does not automatically send email or change quote status.

## Purpose And Legal Basis

The purpose is internal B2B quote engagement tracking for Royal Glass staff. It helps staff understand whether a commercial quote has been opened, reviewed, forwarded, or revisited so follow-up can be timely and relevant.

The intended NZ Privacy Act 2020 basis is legitimate business interest, with data minimisation applied to avoid collecting more than is needed for the quote workflow. Tracking data is not sold, rented, or shared with third parties for marketing. Cloudflare and Neon process the data as infrastructure providers for rgtools. OpenAI is used only when AI guidance is explicitly generated and `OPENAI_API_KEY` is configured.

## Retention

Raw IP addresses in `quote_events.ip` are purged automatically after 90 days by the cleanup cron. Less sensitive aggregate and context fields, such as geolocation, device type, page counts, scroll depth, and time-spent metrics, are retained for up to 12 months for internal reporting and quote performance review.

PDF files are deleted from R2 when a quote expires, and the quote row is archived by clearing `pdf_storage_key` and setting `archived_at`.

Audit rows are archived by cleanup retention after their operational window. AI guidance records remain tied to the tracked quote history unless a future retention job removes them.

## Access And Opt-Out

Access is limited to internal Royal Glass staff through the rgtools dashboard and operational database access. Captured viewer emails are for internal quote workflow use only.

Opt-out is not offered in the viewer because the feature is used for B2B commercial quotes sent to business clients. Staff should disable tracking or the email gate for a quote before sending it when a client relationship or project context requires a lighter privacy posture.

## Public Privacy Surfaces

The viewer worker serves `/privacy` and links to it from the email gate and viewer footer. The viewer also includes an in-page privacy/cookie modal so recipients can inspect the notice without leaving the quote.

The email gate should be enabled before the quote is sent. When enabled, the worker checks the submitted email against the configured recipients and requires a signed gate proof before serving the PDF.

## Operational Controls

Admins control tracking settings from **Admin -> Tracking Settings**:

- Raw IP storage.
- Geo enrichment.
- Page completion and active-time tracking.
- Return-visit and distinct-viewer signals.
- Download, print, and CTA event capture.
- Viewer download/print/accept/contact buttons.
- Open and high-interest notification emails.

Changes are cached briefly by the tracker worker, so allow up to about a minute for settings to apply to new events.
