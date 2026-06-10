<?php
if (!defined('ABSPATH')) exit;

function rg_send_lead_email(int $lead_id, array $lead, array $answers, array $est): void {
    $to      = defined('RG_LEAD_NOTIFY_EMAIL') ? RG_LEAD_NOTIFY_EMAIL : get_option('admin_email');
    $l       = rg_sanitize_lead($lead);
    $a       = rg_sanitize_answers($answers);
    $e       = rg_sanitize_estimate($est);

    $project_labels = [
        'ground_level'       => 'Ground Level Fence',
        'balcony_balustrade' => 'Balcony / Patio Balustrade',
        'premium_pool_fence' => 'Premium Pool Fence',
        'stair_balustrade'   => 'Stair Balustrade',
    ];
    $customer_type_labels = [
        'homeowner'    => 'Homeowner',
        'builder'      => 'Builder',
        'developer'    => 'Developer',
        'architect'    => 'Architect',
        'pool_builder' => 'Pool Builder',
    ];
    $project       = $project_labels[$a['scenario']] ?? $a['scenario'];
    $customer_type = $customer_type_labels[$l['customerType'] ?? ''] ?? ($l['customerType'] ?? '');
    $name          = "{$l['firstName']} {$l['lastName']}";
    $est_range = '$' . number_format($e['low'], 0) . ' – $' . number_format($e['high'], 0) . ' excl. GST';

    $subject = "New Enquiry Lead#{$lead_id} - {$project} - {$name}";

    $notes_block = $l['notes'] ? "\nNotes from customer:\n{$l['notes']}\n" : '';

    $body = <<<TEXT
New lead received via the cost calculator.

─── Contact ──────────────────────────────────────
Name:       {$name}
Phone:      {$l['phone']}
Email:      {$l['email']}
Type:       {$customer_type}
Address:    {$l['address']}

─── Project ──────────────────────────────────────
Type:       {$project}
Length:     {$a['length']}m
Corners:    {$a['corners']}
Gates:      {$a['gates']}
Glass type: {$a['glassType']}
Colour:     {$a['glassColour']}
Fixing:     {$a['fixingMethod']}
Substrate:  {$a['substrate']}
Finish:     {$a['hardwareFinish']}

─── Estimate ─────────────────────────────────────
Range:      {$est_range}
{$notes_block}
─── Action ───────────────────────────────────────
View lead in WordPress admin:

TEXT;

    $body .= admin_url("admin.php?page=rg-leads&lead={$lead_id}");

    $headers = ['Content-Type: text/plain; charset=UTF-8'];
    wp_mail($to, $subject, $body, $headers);
}

function rg_send_estimate_email_to_customer(
    string $to_email,
    string $first_name,
    array  $answers,
    array  $estimate
): bool {
    $a = rg_sanitize_answers($answers);
    $e = rg_sanitize_estimate($estimate);

    $project_labels = [
        'ground_level'       => 'Ground Level Fence',
        'balcony_balustrade' => 'Balcony / Patio Balustrade',
        'premium_pool_fence' => 'Premium Pool Fence',
        'stair_balustrade'   => 'Stair Balustrade',
    ];
    $project = $project_labels[$a['scenario']] ?? 'Glass Project';
    $length  = (int) $a['length'];

    $low      = '$' . number_format($e['low'],  0);
    $high     = '$' . number_format($e['high'], 0);
    $est_html = "<p style=\"color:#ffffff;font-size:38px;font-weight:700;margin:0 0 4px 0;letter-spacing:-0.02em;\">{$low} &ndash; {$high}</p>";
    $est_sub  = "Excluding GST &middot; based on {$length}m effective length";

    $glass_type_labels = [
        'toughened_12mm' => '12mm Toughened + Capping',
        'laminated'      => 'Laminated Glass',
    ];
    $glass_colour_labels = [
        'clear'    => 'Clear',
        'low_iron' => 'Low Iron / Ultra-Clear',
        'tinted'   => 'Tinted',
        'frosted'  => 'Frosted',
    ];
    $fixing_map = [
        'spigots'        => 'Spigots',
        'standoff_posts' => 'Stand-off posts',
        'hidden_channel' => 'Hidden channel',
        'viking'         => 'Viking System',
        'not_sure'       => 'To be confirmed',
    ];
    $finish_map = [
        'standard_chrome' => 'Standard chrome',
        'matte_black'     => 'Matte black',
        'brushed_chrome'  => 'Brushed chrome',
        'powder_coated'   => 'Powder coated',
        'not_sure'        => 'To be confirmed',
    ];

    $rows = [];
    $rows[] = ['Project type',    $project];
    $rows[] = ['Length',          "{$length}m"];
    if ($a['scenario'] !== 'stair_balustrade') {
        $rows[] = ['Corners', (string) $a['corners']];
    }
    if ($a['scenario'] === 'premium_pool_fence') {
        $rows[] = ['Gates', (string) $a['gates']];
    } else {
        $rows[] = ['Gates', 'N/A'];
    }
    if (!empty($a['glassType'])) {
        $rows[] = ['Glass type',   $glass_type_labels[$a['glassType']]     ?? $a['glassType']];
    }
    $rows[] = ['Glass colour',     $glass_colour_labels[$a['glassColour']] ?? $a['glassColour']];
    if (!empty($a['fixingMethod'])) {
        $rows[] = ['Fixing method',  $fixing_map[$a['fixingMethod']]  ?? $a['fixingMethod']];
    }
    if (!empty($a['hardwareFinish'])) {
        $rows[] = ['Hardware finish', $finish_map[$a['hardwareFinish']] ?? $a['hardwareFinish']];
    }

    $rows_html = '';
    $last = count($rows) - 1;
    foreach ($rows as $i => [$label, $value]) {
        $border     = ($i < $last) ? '1px solid #f3f4f6' : 'none';
        $label_safe = esc_html($label);
        $value_safe = esc_html($value);
        $rows_html .= <<<ROW
<tr>
  <td style="padding:9px 0;color:#6b7280;font-size:13px;border-bottom:{$border};">{$label_safe}</td>
  <td style="padding:9px 0;color:#111827;font-size:13px;font-weight:500;text-align:right;border-bottom:{$border};">{$value_safe}</td>
</tr>
ROW;
    }

    $name       = sanitize_text_field($first_name ?: 'there');
    $name_html  = esc_html($name);
    $from_email = sanitize_email(defined('RG_LEAD_NOTIFY_EMAIL') ? RG_LEAD_NOTIFY_EMAIL : get_option('admin_email'));
    $subject    = "{$name}, your Royal Glass estimate is here";

    $html = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Your Royal Glass Estimate</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;-webkit-font-smoothing:antialiased;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:32px auto;padding:0 12px 40px;">
<div style="border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.10);">

<!-- Header -->
<div style="background:linear-gradient(135deg,#152f4a 0%,#1a3c5e 55%,#20496f 100%);padding:40px 36px 36px;">
  <p style="color:#7cb9f5;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;margin:0 0 10px 0;">Royal Glass Limited</p>
  <h1 style="color:#ffffff;font-size:27px;font-weight:700;margin:0;line-height:1.3;">Your {$project} estimate<br>is ready, {$name_html}.</h1>
</div>

<!-- Body -->
<div style="background:#ffffff;padding:36px;">

  <p style="font-size:15px;color:#374151;line-height:1.75;margin:0 0 26px 0;">
    We've looked at your project details and we know exactly what needs to happen to make this a success.
    This is the kind of work we do every single day &mdash; and we're genuinely good at it.
  </p>

  <!-- Estimate band -->
  <div style="background:linear-gradient(135deg,#152f4a 0%,#1a3c5e 100%);border-radius:14px;margin:0 0 30px 0;padding:30px 28px;text-align:center;">
    <p style="color:#7cb9f5;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;margin:0 0 12px 0;">Your indicative estimate</p>
    {$est_html}
    <p style="color:#7cb9f5;font-size:13px;margin:6px 0 0 0;">{$est_sub}</p>
  </div>

  <p style="font-size:15px;color:#374151;line-height:1.75;margin:0 0 16px 0;">
    <strong style="color:#1a3c5e;">You don't need to worry about a thing from here.</strong>
    NZ Building Code compliance, producer statements, council paperwork &mdash; we handle all of it, end to end.
  </p>

  <p style="font-size:15px;color:#374151;line-height:1.75;margin:0 0 28px 0;">
    We've completed hundreds of projects just like yours across Auckland and we know how to get it right &mdash;
    on time, on budget, and looking exactly how you envisioned it.
  </p>

  <!-- Steps -->
  <div style="background:#f8fafc;border:1px solid #e5eaf0;border-radius:12px;padding:26px;margin:0 0 30px 0;">
    <p style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.12em;margin:0 0 20px 0;">What happens from here</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="38" valign="top" style="padding-bottom:18px;">
          <div style="background:#1a3c5e;color:#fff;font-size:12px;font-weight:700;width:28px;height:28px;border-radius:50%;text-align:center;line-height:28px;">1</div>
        </td>
        <td valign="top" style="padding-bottom:18px;padding-left:8px;">
          <p style="font-size:14px;font-weight:600;color:#111827;margin:0 0 4px 0;">We'll be in touch within 1 business day</p>
          <p style="font-size:13px;color:#6b7280;margin:0;line-height:1.6;">One of our team will call to answer any questions and lock in a time to visit your site.</p>
        </td>
      </tr>
      <tr>
        <td width="38" valign="top" style="padding-bottom:18px;">
          <div style="background:#1a3c5e;color:#fff;font-size:12px;font-weight:700;width:28px;height:28px;border-radius:50%;text-align:center;line-height:28px;">2</div>
        </td>
        <td valign="top" style="padding-bottom:18px;padding-left:8px;">
          <p style="font-size:14px;font-weight:600;color:#111827;margin:0 0 4px 0;">Site visit &mdash; no obligation, no pressure</p>
          <p style="font-size:13px;color:#6b7280;margin:0;line-height:1.6;">We come to you, take precise measurements, and sort out every site-specific detail on the spot.</p>
        </td>
      </tr>
      <tr>
        <td width="38" valign="top">
          <div style="background:#1a3c5e;color:#fff;font-size:12px;font-weight:700;width:28px;height:28px;border-radius:50%;text-align:center;line-height:28px;">3</div>
        </td>
        <td valign="top" style="padding-left:8px;">
          <p style="font-size:14px;font-weight:600;color:#111827;margin:0 0 4px 0;">A clear, fixed-price quote in writing</p>
          <p style="font-size:13px;color:#6b7280;margin:0;line-height:1.6;">No surprises, no hidden costs. You'll know exactly what you're getting before you commit to anything.</p>
        </td>
      </tr>
    </table>
  </div>

  <!-- CTA -->
  <div style="text-align:center;margin:0 0 36px 0;">
    <a href="tel:0800769254" style="display:inline-block;background:#1a3c5e;color:#ffffff;font-size:15px;font-weight:600;padding:15px 34px;border-radius:9px;text-decoration:none;letter-spacing:0.01em;">Call us: 0800 769 254</a>
    <p style="font-size:13px;color:#9ca3af;margin:10px 0 0 0;">Or just reply to this email &mdash; we read every one.</p>
  </div>

  <!-- Project summary -->
  <div style="border-top:1px solid #e5e7eb;padding-top:24px;">
    <p style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.12em;margin:0 0 14px 0;">Your project summary</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      {$rows_html}
    </table>
  </div>

</div>

<!-- Footer -->
<div style="background:#f8fafc;border-top:1px solid #e5eaf0;padding:22px 36px;text-align:center;">
  <p style="font-size:13px;color:#374151;font-weight:600;margin:0 0 5px 0;">Royal Glass Limited</p>
  <p style="font-size:12px;color:#9ca3af;margin:0 0 5px 0;">13E Paul Matthews Road, Rosedale, Auckland 0632</p>
  <p style="font-size:12px;margin:0 0 12px 0;">
    <a href="tel:0800769254" style="color:#1a3c5e;text-decoration:none;font-weight:500;">0800 769 254</a>
    &nbsp;&middot;&nbsp;
    <a href="https://royalglass.co.nz" style="color:#1a3c5e;text-decoration:none;font-weight:500;">royalglass.co.nz</a>
  </p>
  <p style="font-size:11px;color:#d1d5db;margin:0;">This is an indicative estimate only. Final pricing is confirmed after our free site visit. Prices exclude GST.</p>
</div>

</div>
</div>
</body>
</html>
HTML;

    $headers = [
        'Content-Type: text/html; charset=UTF-8',
        'From: Royal Glass Limited <support@royalglass.co.nz>',
        "Reply-To: <support@royalglass.co.nz>",
    ];

    return (bool) wp_mail(sanitize_email($to_email), $subject, $html, $headers);
}
