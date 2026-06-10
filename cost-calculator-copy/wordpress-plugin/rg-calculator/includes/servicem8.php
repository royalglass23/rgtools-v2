<?php
if (!defined('ABSPATH')) exit;

// ── ServiceM8 Inbox Integration ───────────────────────────────────────────────
//
// Flow:
//   1. Lead saved to DB in api.php
//   2. rg_sm8_send_immediate() fires in the shutdown hook alongside the admin email
//   3. Sends plain-text email to RG_SM8_INBOX_EMAIL immediately
//   4. Staff sees it in SM8 inbox → "Convert to Job" auto-fills client details
//
// Required constant in wp-config.php:
//   define('RG_SM8_INBOX_EMAIL', 'de9f86@inbox.servicem8.com');
//   (Set to royalglass666@gmail.com for testing)
//
// Leave undefined to disable entirely — no leads will be sent.

define('RG_SM8_QUALITY_THRESHOLD', 6); // kept for reference — not used by immediate send

// ── Quality scoring ───────────────────────────────────────────────────────────

function rg_sm8_quality_score(array $lead, array $est, int $loaded_at): int {
    $score = 0;

    // Valid NZ phone: 02x, 04x, +64, 0800 (+2)
    $phone = preg_replace('/[\s\-()+]/', '', $lead['phone'] ?? '');
    if (preg_match('/^(640?|0)(2\d|4\d|800)\d{6,8}$/', $phone)) {
        $score += 2;
    }

    // Non-disposable email domain (+2)
    $disposable = [
        'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwam.com',
        'yopmail.com', 'sharklasers.com', 'grr.la', 'spam4.me',
        'trashmail.com', 'maildrop.cc', 'dispostable.com', 'getnada.com',
    ];
    $domain = strtolower(substr(strrchr($lead['email'] ?? '', '@'), 1));
    if ($domain && !in_array($domain, $disposable, true)) {
        $score += 2;
    }

    // Address provided (+2)
    if (!empty(trim($lead['address'] ?? ''))) {
        $score += 2;
    }

    // Estimate in plausible range $500–$200,000 (+2)
    $est_low = (float) ($est['low'] ?? 0);
    if ($est_low >= 500 && $est_low <= 200000) {
        $score += 2;
    }

    // Form time > 30 seconds (+2)
    if ($loaded_at > 0 && (time() * 1000 - $loaded_at) > 30000) {
        $score += 2;
    }

    return $score;
}

// ── Immediate send (called from shutdown hook in api.php) ─────────────────────
//
// Sends as soon as the lead is saved — no cron delay.
// Uses plain-text format so SM8 "Convert to Job" can parse Name/Phone/Email/Address.

function rg_sm8_send_immediate(int $lead_id, array $lead, array $answers, array $est): void {
    error_log("RG SM8: rg_sm8_send_immediate called for lead #{$lead_id}");
    if (!defined('RG_SM8_INBOX_EMAIL') || !RG_SM8_INBOX_EMAIL) {
        error_log('RG SM8: RG_SM8_INBOX_EMAIL is not defined or empty in wp-config.php — skipping send');
        return;
    }
    $l = rg_sanitize_lead($lead);
    $a = rg_sanitize_answers($answers);
    $e = rg_sanitize_estimate($est);

    $name     = trim("{$l['firstName']} {$l['lastName']}");
    $project  = rg_sm8_label_project($a['scenario']);
    $est_low  = number_format($e['low'],  0);
    $est_high = number_format($e['high'], 0);

    $subject = "New Enquiry — {$name} — {$project} — Est. \${$est_low}–\${$est_high}";

    $type_labels = [
        'homeowner'    => 'Homeowner',
        'builder'      => 'Builder',
        'developer'    => 'Developer',
        'architect'    => 'Architect',
        'pool_builder' => 'Pool Builder',
    ];
    $client_type = $type_labels[$l['customerType']] ?? ucfirst($l['customerType'] ?: 'Not specified');

    $lines = [
        "Name: {$name}",
        // "Phone: {$l['phone']}",  // removed — SM8 maps Mobile correctly
        "Mobile: {$l['phone']}",
        "Email: {$l['email']}",
        "Address: {$l['address']}",
    ];
    if (!empty($l['customerType']) && $l['customerType'] !== 'other') {
        $lines[] = "Notes: Client type — {$client_type}";
    }
    $lines = array_merge($lines, [
        "",
        "--- Project Details ---",
        "Type: {$project}",
        "Length: {$a['length']}m",
        "Corners: {$a['corners']}",
        "Gates: {$a['gates']}",
        "Fixing: " . rg_sm8_label_fixing($a['fixingMethod']),
        "Substrate: " . rg_sm8_label_substrate($a['substrate']),
        "Finish: " . rg_sm8_label_hardware($a['hardwareFinish']),
        "",
        "--- Estimate ---",
        "Low: \${$est_low}",
        "High: \${$est_high}",
    ]);

    if (!empty(trim($l['notes']))) {
        $lines[] = "";
        $lines[] = "--- Customer Notes ---";
        $lines[] = $l['notes'];
    }

    $lines[] = "";
    $lines[] = "--- Reference ---";
    $lines[] = "WP Lead #{$lead_id}";
    $lines[] = admin_url("admin.php?page=rg-leads&lead={$lead_id}");

    $body       = implode("\n", $lines);
    $recipients = array_filter(array_map('trim', explode(',', RG_SM8_INBOX_EMAIL)));
    $sent = true;
    foreach ($recipients as $recipient) {
        $result = wp_mail($recipient, $subject, $body, ['Content-Type: text/plain; charset=UTF-8']);
        if (!$result) {
            $sent = false;
            error_log("RG SM8: wp_mail failed for lead #{$lead_id} to {$recipient}");
        } else {
            error_log("RG SM8: wp_mail succeeded for lead #{$lead_id} to {$recipient}");
        }
    }

    global $wpdb;
    $wpdb->update(
        $wpdb->prefix . 'rg_leads',
        [
            'servicem8_status'  => $sent ? 'sent_to_inbox' : 'failed',
            'servicem8_sent_at' => $sent ? current_time('mysql') : null,
        ],
        ['id' => $lead_id],
        ['%s', '%s'],
        ['%d']
    );
}

// ── Queue lead after quality check (kept for retry use) ───────────────────────

function rg_sm8_maybe_queue(int $lead_id, array $lead, array $est, int $loaded_at): void {
    if (!defined('RG_SM8_INBOX_EMAIL') || !RG_SM8_INBOX_EMAIL) return;

    $score  = rg_sm8_quality_score($lead, $est, $loaded_at);
    $status = ($score >= RG_SM8_QUALITY_THRESHOLD) ? 'pending_inbox' : 'skipped';

    global $wpdb;
    $wpdb->update(
        $wpdb->prefix . 'rg_leads',
        ['servicem8_status' => $status],
        ['id' => $lead_id],
        ['%s'],
        ['%d']
    );

    if ($status === 'skipped') {
        error_log(sprintf('RG SM8: lead #%d skipped (quality score %d/10)', $lead_id, $score));
    }
}

// ── Cron: process pending leads ───────────────────────────────────────────────

function rg_sm8_process_queue(): void {
    if (!defined('RG_SM8_INBOX_EMAIL') || !RG_SM8_INBOX_EMAIL) return;

    global $wpdb;

    // Only pick up leads that are at least 10 minutes old
    $cutoff = gmdate('Y-m-d H:i:s', time() - 600);
    $leads  = $wpdb->get_results(
        $wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}rg_leads
             WHERE servicem8_status = 'pending_inbox'
             AND created_at <= %s
             ORDER BY created_at ASC
             LIMIT 20",
            $cutoff
        )
    );

    foreach ($leads as $lead) {
        rg_sm8_send_to_inbox((int) $lead->id, $lead);
    }
}

// ── Send a single lead to the SM8 inbox ──────────────────────────────────────

function rg_sm8_send_to_inbox(int $lead_id, object $lead): void {
    $sent = wp_mail(
        RG_SM8_INBOX_EMAIL,
        rg_sm8_email_subject($lead),
        rg_sm8_email_body($lead),
        ['Content-Type: text/plain; charset=UTF-8']
    );

    global $wpdb;

    if ($sent) {
        $wpdb->update(
            $wpdb->prefix . 'rg_leads',
            [
                'servicem8_status' => 'sent_to_inbox',
                'servicem8_sent_at' => current_time('mysql'),
            ],
            ['id' => $lead_id],
            ['%s', '%s'],
            ['%d']
        );
        return;
    }

    // Retry up to 3 times before marking permanently failed
    $retries = (int) get_transient('rg_sm8_retry_' . $lead_id) + 1;
    if ($retries >= 3) {
        $wpdb->update(
            $wpdb->prefix . 'rg_leads',
            ['servicem8_status' => 'failed'],
            ['id' => $lead_id],
            ['%s'],
            ['%d']
        );
        error_log(sprintf('RG SM8: lead #%d permanently failed after 3 send attempts', $lead_id));
    } else {
        set_transient('rg_sm8_retry_' . $lead_id, $retries, DAY_IN_SECONDS);
        error_log(sprintf('RG SM8: lead #%d send failed (attempt %d/3)', $lead_id, $retries));
    }
}

// ── Email formatting ──────────────────────────────────────────────────────────
//
// Plain-text format so ServiceM8 "Convert to Job" can reliably extract
// Name / Phone / Email / Address for client auto-fill.

function rg_sm8_email_subject(object $lead): string {
    $name     = trim($lead->first_name . ' ' . $lead->last_name);
    $type     = rg_sm8_label_project($lead->project_type);
    $est_low  = number_format((float) $lead->est_low, 0);
    $est_high = number_format((float) $lead->est_high, 0);
    return "New Enquiry — {$name} — {$type} — Est. \${$est_low}–\${$est_high}";
}

function rg_sm8_email_body(object $lead): string {
    $name     = trim($lead->first_name . ' ' . $lead->last_name);
    $est_low  = number_format((float) $lead->est_low, 0);
    $est_high = number_format((float) $lead->est_high, 0);
    $est_sub  = number_format((float) $lead->est_subtotal, 0);

    $lines = [
        "Name:      {$name}",
        "Phone:     {$lead->phone}",
        "Email:     {$lead->email}",
        "Address:   {$lead->address}",
        "",
        "--- Project Details ---",
        "Type:      " . rg_sm8_label_project($lead->project_type),
        "Length:    {$lead->length_m}m",
        "Corners:   {$lead->corners}",
        "Gates:     {$lead->gates}",
        "Fixing:    " . rg_sm8_label_fixing($lead->fixing_method),
        "Substrate: " . rg_sm8_label_substrate($lead->substrate ?? ''),
        "Finish:    " . rg_sm8_label_hardware($lead->hardware),
        "",
        "--- Estimate ---",
        "Low:       \${$est_low}",
        "High:      \${$est_high}",
        "Subtotal:  \${$est_sub}",
    ];

    if (!empty(trim($lead->notes ?? ''))) {
        $lines[] = "";
        $lines[] = "--- Customer Notes ---";
        $lines[] = $lead->notes;
    }

    if (!empty($lead->needs_consult)) {
        $lines[] = "";
        $lines[] = "--- On-Site Review Required ---";
        $lines[] = "One or more items need confirming on site before final pricing.";
    }

    $lines[] = "";
    $lines[] = "--- Reference ---";
    $lines[] = "WP Lead #{$lead->id} | Submitted: " . date('d/m/Y H:i', strtotime($lead->created_at));
    $lines[] = get_admin_url(null, "admin.php?page=rg-leads&action=view&id={$lead->id}");

    return implode("\n", $lines);
}

// ── Label helpers ─────────────────────────────────────────────────────────────

function rg_sm8_label_project(string $v): string {
    return [
        'ground_level'       => 'Ground Level Balustrade',
        'balcony_balustrade' => 'Balcony / Deck Balustrade',
        'premium_pool_fence' => 'Pool Fence',
        'stair_balustrade'   => 'Stair Balustrade',
    ][$v] ?? $v;
}

function rg_sm8_label_fixing(string $v): string {
    return [
        'spigots'        => 'Spigots',
        'standoff_posts' => 'Stand-off Posts',
        'hidden_channel' => 'Hidden Channel',
        'viking'         => 'Viking System',
        'not_sure'       => 'To be confirmed on site',
    ][$v] ?? $v;
}

function rg_sm8_label_substrate(string $v): string {
    return [
        'timber'   => 'Timber',
        'concrete' => 'Concrete',
        'tile'     => 'Tile',
        'steel'    => 'Steel',
        'not_sure' => 'To be confirmed on site',
    ][$v] ?? ($v ?: 'Not specified');
}

function rg_sm8_label_hardware(string $v): string {
    return [
        'standard_chrome' => 'Standard Chrome',
        'matte_black'     => 'Matte Black',
        'brushed_chrome'  => 'Brushed Chrome',
        'powder_coated'   => 'Powder Coated',
        'not_sure'        => 'To be confirmed',
    ][$v] ?? $v;
}

// ── Cron registration ─────────────────────────────────────────────────────────

add_filter('cron_schedules', 'rg_sm8_add_cron_interval');
function rg_sm8_add_cron_interval(array $schedules): array {
    $schedules['rg_every_15min'] = [
        'interval' => 900,
        'display'  => 'Every 15 Minutes',
    ];
    return $schedules;
}

add_action('rg_sm8_cron_hook', 'rg_sm8_process_queue');

function rg_sm8_schedule_cron(): void {
    if (!wp_next_scheduled('rg_sm8_cron_hook')) {
        wp_schedule_event(time(), 'rg_every_15min', 'rg_sm8_cron_hook');
    }
}

function rg_sm8_unschedule_cron(): void {
    $ts = wp_next_scheduled('rg_sm8_cron_hook');
    if ($ts) wp_unschedule_event($ts, 'rg_sm8_cron_hook');
}