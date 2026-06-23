export const LAST_UPDATED = '23 June 2026'

export function renderPrivacyNotice(): string {
  const cookiesAnchor = ' id="cookies"'
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Privacy &amp; Cookies Notice — Royal Glass</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #1a1b1d; color: #c7c7c7; line-height: 1.6; padding: 2rem 1rem; }
  .wrap { max-width: 720px; margin: 0 auto; }
  h1 { font-size: 1.4rem; color: #e8e8e8; margin-bottom: 0.25rem; }
  .meta { font-size: 0.8rem; color: #888; margin-bottom: 2rem; }
  h2 { font-size: 1rem; color: #e0e0e0; margin: 2rem 0 0.5rem; }
  p, li { font-size: 0.9rem; margin-bottom: 0.5rem; }
  ul { padding-left: 1.4rem; }
  a { color: #7ab4d8; }
  a:hover { color: #a8d0ec; }
  .back { display: inline-block; margin-bottom: 1.5rem; font-size: 0.85rem; color: #888; text-decoration: none; }
  .back:hover { color: #c7c7c7; }
  hr { border: none; border-top: 1px solid #333; margin: 2rem 0; }
</style>
</head>
<body>
<div class="wrap">
  <a class="back" href="javascript:history.back()">&larr; Back</a>
  <h1>Privacy &amp; Cookies Notice</h1>
  <p class="meta">Royal Glass Ltd &mdash; Last updated: ${LAST_UPDATED}</p>

  <p>When you open a Royal Glass quote through our quote viewer, we collect some information about you. This notice explains what we collect, why, and what happens to it. It is written in plain language so you can understand it without a legal background.</p>

  <h2>1. What we collect &amp; why</h2>
  <ul>
    <li><strong>Email address and name</strong> (gated quotes only) &mdash; to confirm you have authorised access and to notify Royal Glass that the quote has been opened.</li>
    <li><strong>IP address</strong> &mdash; to detect approximate location for geographic context and to detect forwarding (see below).</li>
    <li><strong>Approximate location</strong> (city/country derived from IP) &mdash; to give Royal Glass useful context about who is viewing the quote.</li>
    <li><strong>Device and browser type</strong> &mdash; to understand how the quote is being read.</li>
    <li><strong>Engagement behaviour</strong> &mdash; including when you open the quote, how long you spend on each page, scroll depth, downloads, prints, and whether the quote link appears to have been forwarded to someone else.</li>
  </ul>
  <p>We collect this information under the Information Privacy Principle 1 of the NZ Privacy Act 2020: it is necessary for Royal Glass to follow up on quotes and understand viewer intent.</p>

  <h2${cookiesAnchor}>2. Cookies &amp; tracking</h2>
  <p>The quote viewer uses <strong>localStorage / similar technologies</strong> (not traditional cookies) to store a session token so that gated quotes remember you between page loads. We do not use advertising cookies or any third-party tracking pixels.</p>
  <p>The viewer records the following signals to measure engagement:</p>
  <ul>
    <li>Time spent on each page and overall</li>
    <li>Scroll depth and page completion</li>
    <li>Download and print actions</li>
    <li>Time from quote creation to first open</li>
    <li>Return visits</li>
    <li>Distinct viewer count</li>
  </ul>
  <p><strong>Forwarding detection:</strong> the viewer compares IP addresses across sessions. If a quote appears to be opened from a different IP address than expected, this is flagged to Royal Glass as a possible forwarding event. This is disclosed here so nothing about the tracking is hidden from you.</p>

  <h2>3. Who we share it with</h2>
  <p>We do not sell your information. We share it only with the processors listed below, who handle it on our behalf:</p>
  <ul>
    <li><strong>Cloudflare</strong> &mdash; hosting, security, and geolocation (IP-to-city lookup). Data may be processed on Cloudflare's global network, including in the US.</li>
    <li><strong>Neon</strong> &mdash; database hosting. Data is stored in a Neon database, which may be located in the US.</li>
    <li><strong>Resend</strong> &mdash; transactional email. When a quote is opened, a notification email is sent to Royal Glass staff via Resend, which processes email in the US.</li>
  </ul>
  <p>Data may therefore be stored or processed in the United States. We take reasonable steps to ensure these processors provide comparable safeguards to the NZ Privacy Act 2020 (IPP 12).</p>
  <p>We also send Royal Glass staff an email alert that includes your city, device type, and engagement summary when you open a quote.</p>

  <h2>4. How long we keep it</h2>
  <ul>
    <li><strong>IP addresses</strong> are removed within 90 days of collection.</li>
    <li><strong>Personal engagement data and viewer emails</strong> are deleted or anonymised 12 months after the quote expires or is archived.</li>
    <li><strong>Aggregate statistics</strong> (total opens, page counts, etc.) are retained as anonymous business data with no time limit, as they no longer identify any individual.</li>
  </ul>

  <h2>5. Your rights &amp; contact</h2>
  <p>Under the NZ Privacy Act 2020 you have the right to access and correct personal information we hold about you.</p>
  <p>To make a request, email us at <a href="mailto:support@royalglass.co.nz">support@royalglass.co.nz</a> or call 0800 769 254. We will respond within 20 working days.</p>
  <p>If you are not satisfied with our response, you can contact the <strong>Office of the Privacy Commissioner</strong> at <a href="https://www.privacy.org.nz" target="_blank" rel="noopener">privacy.org.nz</a>.</p>

  <hr>

  <h2>6. Our broader privacy policy</h2>
  <p>This notice covers the quote viewer only. For the broader Royal Glass business privacy policy, visit <a href="https://royalglass.co.nz/privacy-policy" target="_blank" rel="noopener">royalglass.co.nz</a>.</p>
</div>
</body>
</html>`
}
