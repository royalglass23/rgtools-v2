<?php
if (!defined('ABSPATH')) exit;

define('RG_DB_VERSION', '2.4.0');

function rg_create_leads_table(): void {
    global $wpdb;
    $table   = $wpdb->prefix . 'rg_leads';
    $charset = $wpdb->get_charset_collate();

    $sql = "CREATE TABLE IF NOT EXISTS {$table} (
        id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        status        VARCHAR(20)     NOT NULL DEFAULT 'NEW',
        first_name    VARCHAR(100)    NOT NULL DEFAULT '',
        last_name     VARCHAR(100)    NOT NULL DEFAULT '',
        phone         VARCHAR(50)     NOT NULL DEFAULT '',
        email         VARCHAR(255)    NOT NULL DEFAULT '',
        address       TEXT            NOT NULL DEFAULT '',
        customer_type VARCHAR(30)     NOT NULL DEFAULT '',
        call_pref     VARCHAR(20)     NOT NULL DEFAULT 'anytime',
        notes         TEXT            NOT NULL DEFAULT '',
        project_type  VARCHAR(50)     NOT NULL DEFAULT '',
        length_m      SMALLINT        NOT NULL DEFAULT 0,
        height        VARCHAR(50)     NOT NULL DEFAULT '',
        corners       TINYINT         NOT NULL DEFAULT 0,
        gates         TINYINT         NOT NULL DEFAULT 0,
        fixing_method VARCHAR(50)     NOT NULL DEFAULT '',
        hardware      VARCHAR(50)     NOT NULL DEFAULT '',
        est_low       DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
        est_high      DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
        est_subtotal  DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
        needs_consult TINYINT(1)      NOT NULL DEFAULT 0,
        consult_notes TEXT            NOT NULL DEFAULT '',
        consent_given TINYINT(1)      NOT NULL DEFAULT 0,
        consented_at  DATETIME        NULL,
        servicem8_status  VARCHAR(20)     NOT NULL DEFAULT '',
        servicem8_sent_at DATETIME        NULL,
        created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY status (status),
        KEY servicem8_status (servicem8_status),
        KEY created_at (created_at)
    ) {$charset};";

    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta($sql);

    // dbDelta silently skips adding columns to existing tables in some environments.
    // Explicitly ALTER TABLE for any columns that are missing.
    $existing = $wpdb->get_col("SHOW COLUMNS FROM {$table}", 0);
    if (!in_array('consent_given', $existing, true)) {
        $wpdb->query("ALTER TABLE {$table} ADD COLUMN consent_given TINYINT(1) NOT NULL DEFAULT 0 AFTER consult_notes");
    }
    if (!in_array('consented_at', $existing, true)) {
        $wpdb->query("ALTER TABLE {$table} ADD COLUMN consented_at DATETIME NULL AFTER consent_given");
    }
    if (!in_array('substrate', $existing, true)) {
        $wpdb->query("ALTER TABLE {$table} ADD COLUMN substrate VARCHAR(50) NOT NULL DEFAULT '' AFTER fixing_method");
    }
    if (!in_array('servicem8_status', $existing, true)) {
        $wpdb->query("ALTER TABLE {$table} ADD COLUMN servicem8_status VARCHAR(20) NOT NULL DEFAULT '' AFTER consented_at");
    }
    if (!in_array('servicem8_sent_at', $existing, true)) {
        $wpdb->query("ALTER TABLE {$table} ADD COLUMN servicem8_sent_at DATETIME NULL AFTER servicem8_status");
    }
    if (!in_array('customer_type', $existing, true)) {
        $wpdb->query("ALTER TABLE {$table} ADD COLUMN customer_type VARCHAR(30) NOT NULL DEFAULT '' AFTER email");
    }
}

// Run schema migrations automatically when any admin page loads and the DB version is stale.
add_action('admin_init', 'rg_maybe_migrate_db');
function rg_maybe_migrate_db(): void {
    if (get_option('rg_db_version') !== RG_DB_VERSION) {
        rg_create_leads_table();
        update_option('rg_db_version', RG_DB_VERSION);
    }
}

/**
 * Save a new lead. Returns the inserted row ID or 0 on failure.
 */
function rg_save_lead(array $lead, array $answers, array $est): int {
    global $wpdb;

    $l = rg_sanitize_lead($lead);
    $a = rg_sanitize_answers($answers);
    $e = rg_sanitize_estimate($est);

    $result = $wpdb->insert(
        $wpdb->prefix . 'rg_leads',
        [
            'status'        => 'NEW',
            'first_name'    => $l['firstName'],
            'last_name'     => $l['lastName'],
            'phone'         => $l['phone'],
            'email'         => $l['email'],
            'customer_type' => $l['customerType'],
            'address'       => $l['address'],
            'call_pref'     => $l['callPreference'],
            'notes'         => $l['notes'],
            'project_type'  => $a['scenario'],
            'length_m'      => $a['length'],
            'height'        => '',
            'corners'       => $a['corners'],
            'gates'         => $a['gates'],
            'fixing_method' => $a['fixingMethod'],
            'substrate'     => $a['substrate'],
            'hardware'      => $a['hardwareFinish'],
            'est_low'       => $e['low'],
            'est_high'      => $e['high'],
            'est_subtotal'  => $e['subtotal'],
            'needs_consult' => $e['needsCallUs'] ? 1 : 0,
            'consult_notes' => '',
            'consent_given' => $l['consentGiven'],
            'consented_at'  => $l['consentedAt'],
        ],
        ['%s','%s','%s','%s','%s','%s','%s','%s','%s','%s','%d','%s','%d','%d','%s','%s','%s','%f','%f','%f','%d','%s','%d','%s']
    );

    return $result ? (int) $wpdb->insert_id : 0;
}

/**
 * Fetch a single lead by ID.
 */
function rg_get_lead(int $id): ?object {
    global $wpdb;
    return $wpdb->get_row(
        $wpdb->prepare("SELECT * FROM {$wpdb->prefix}rg_leads WHERE id = %d", $id)
    );
}

/**
 * Update lead status.
 */
function rg_update_lead_status(int $id, string $status): void {
    global $wpdb;
    $allowed = ['NEW', 'REVIEWED', 'ACCEPTED', 'REJECTED'];
    if (!in_array($status, $allowed, true)) return;
    $wpdb->update(
        $wpdb->prefix . 'rg_leads',
        ['status' => $status],
        ['id'     => $id],
        ['%s'],
        ['%d']
    );
}
