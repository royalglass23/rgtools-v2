<?php
if (!defined('ABSPATH')) exit;

add_action('admin_menu', 'rg_admin_leads_menu');

function rg_admin_leads_menu(): void {
    add_submenu_page(
        'rg-calculator',
        'Leads',
        'Leads',
        'manage_options',
        'rg-leads',
        'rg_admin_leads_page'
    );
}

function rg_admin_leads_page(): void {
    if (!current_user_can('manage_options')) return;
    global $wpdb;
    $table = $wpdb->prefix . 'rg_leads';

    // Status update
    if (
        isset($_GET['action'], $_GET['lead'], $_GET['_wpnonce']) &&
        wp_verify_nonce($_GET['_wpnonce'], 'rg_lead_action')
    ) {
        $allowed = ['REVIEWED', 'ACCEPTED', 'REJECTED'];
        $action  = strtoupper(sanitize_text_field($_GET['action']));
        if (in_array($action, $allowed, true)) {
            rg_update_lead_status((int) $_GET['lead'], $action);
            echo '<div class="notice notice-success is-dismissible"><p>Lead updated to ' . esc_html($action) . '.</p></div>';
        }
    }

    // Single lead view
    if (isset($_GET['lead']) && (int) $_GET['lead'] > 0) {
        rg_render_lead_detail((int) $_GET['lead']);
        return;
    }

    // List
    $status_filter = sanitize_text_field($_GET['status'] ?? '');
    $where         = $status_filter ? $wpdb->prepare('WHERE status = %s', $status_filter) : '';
    $leads         = $wpdb->get_results("SELECT * FROM {$table} {$where} ORDER BY created_at DESC LIMIT 200");

    $counts = $wpdb->get_results("SELECT status, COUNT(*) as c FROM {$table} GROUP BY status");
    $count_map = [];
    foreach ($counts as $row) $count_map[$row->status] = (int) $row->c;

    $total = array_sum($count_map);

    ?>
    <div class="wrap">
        <h1>RG Calculator — Leads</h1>

        <!-- Status filter tabs -->
        <ul class="subsubsub">
            <li><a href="?page=rg-leads" class="<?= !$status_filter ? 'current' : '' ?>">All <span class="count">(<?= $total ?>)</span></a> |</li>
            <?php foreach (['NEW' => 'New', 'REVIEWED' => 'Reviewed', 'ACCEPTED' => 'Accepted', 'REJECTED' => 'Rejected'] as $s => $label): ?>
            <li><a href="?page=rg-leads&status=<?= $s ?>" class="<?= $status_filter === $s ? 'current' : '' ?>"><?= $label ?> <span class="count">(<?= $count_map[$s] ?? 0 ?>)</span></a> |</li>
            <?php endforeach; ?>
        </ul>

        <table class="wp-list-table widefat fixed striped" style="margin-top:1rem">
            <thead>
                <tr>
                    <th style="width:40px">#</th>
                    <th>Name</th>
                    <th>Contact</th>
                    <th>Project</th>
                    <th>Estimate</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
            <?php if (empty($leads)): ?>
                <tr><td colspan="8" style="text-align:center;padding:2rem;color:#999">No leads yet.</td></tr>
            <?php else: ?>
            <?php foreach ($leads as $lead): ?>
                <?php
                $est_range = $lead->needs_consult
                    ? 'Consultation needed'
                    : '$' . number_format($lead->est_low, 0) . ' – $' . number_format($lead->est_high, 0);
                $status_colours = [
                    'NEW'      => '#2271b1',
                    'REVIEWED' => '#d97706',
                    'ACCEPTED' => '#16a34a',
                    'REJECTED' => '#dc2626',
                ];
                $colour = $status_colours[$lead->status] ?? '#666';
                ?>
                <tr>
                    <td><?= $lead->id ?></td>
                    <td><a href="?page=rg-leads&lead=<?= $lead->id ?>"><?= esc_html("{$lead->first_name} {$lead->last_name}") ?></a></td>
                    <td><?= esc_html($lead->phone) ?><br><small><?= esc_html($lead->email) ?></small></td>
                    <td><?= esc_html(ucwords(str_replace('_', ' ', $lead->project_type))) ?><br><small><?= $lead->length_m ?>m · <?= $lead->gates ?> gates</small></td>
                    <td><?= esc_html($est_range) ?></td>
                    <td><span style="color:<?= $colour ?>;font-weight:600"><?= esc_html($lead->status) ?></span></td>
                    <td><?= date('d M Y', strtotime($lead->created_at)) ?></td>
                    <td>
                        <?php
                        $nonce = wp_create_nonce('rg_lead_action');
                        foreach (['REVIEWED', 'ACCEPTED', 'REJECTED'] as $a):
                            if ($lead->status !== $a):
                        ?>
                        <a href="?page=rg-leads&lead=<?= $lead->id ?>&action=<?= $a ?>&_wpnonce=<?= $nonce ?>" style="margin-right:4px;font-size:12px"><?= ucfirst(strtolower($a)) ?></a>
                        <?php
                            endif;
                        endforeach;
                        ?>
                    </td>
                </tr>
            <?php endforeach; ?>
            <?php endif; ?>
            </tbody>
        </table>
    </div>
    <?php
}

function rg_render_lead_detail(int $id): void {
    $lead = rg_get_lead($id);
    if (!$lead) { echo '<div class="wrap"><p>Lead not found.</p></div>'; return; }

    $nonce = wp_create_nonce('rg_lead_action');
    ?>
    <div class="wrap">
        <h1>Lead #<?= $id ?> — <?= esc_html("{$lead->first_name} {$lead->last_name}") ?></h1>
        <p><a href="?page=rg-leads">← Back to all leads</a></p>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:2rem;max-width:900px;margin-top:1.5rem">
            <div style="background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:1.5rem">
                <h3 style="margin-top:0">Contact details</h3>
                <table class="form-table"><tbody>
                    <?php foreach ([
                        'Name'      => "{$lead->first_name} {$lead->last_name}",
                        'Phone'     => $lead->phone,
                        'Email'     => $lead->email,
                        'Address'   => $lead->address,
                        'Best time' => $lead->call_pref,
                        'Consent'   => $lead->consent_given
                            ? '✓ Given — ' . date('d M Y H:i', strtotime($lead->consented_at)) . ' NZST'
                            : '✗ Not recorded',
                    ] as $label => $value): ?>
                    <tr><th style="width:100px"><?= esc_html($label) ?></th><td><?= esc_html($value) ?></td></tr>
                    <?php endforeach; ?>
                    <?php if ($lead->notes): ?>
                    <tr><th>Notes</th><td><?= nl2br(esc_html($lead->notes)) ?></td></tr>
                    <?php endif; ?>
                </tbody></table>
            </div>

            <div style="background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:1.5rem">
                <h3 style="margin-top:0">Project details</h3>
                <table class="form-table"><tbody>
                    <?php foreach ([
                        'Project type' => ucwords(str_replace('_', ' ', $lead->project_type)),
                        'Length'       => "{$lead->length_m}m",
                        'Height'       => $lead->height,
                        'Corners'      => $lead->corners,
                        'Gates'        => $lead->gates,
                        'Fixing'       => str_replace('_', ' ', $lead->fixing_method),
                        'Finish'       => str_replace('_', ' ', $lead->hardware),
                    ] as $label => $value): ?>
                    <tr><th style="width:120px"><?= esc_html($label) ?></th><td><?= esc_html($value) ?></td></tr>
                    <?php endforeach; ?>
                </tbody></table>

                <h3>Estimate</h3>
                <?php if ($lead->needs_consult): ?>
                    <p style="color:#d97706;font-weight:600">⚠ Consultation needed</p>
                    <p style="white-space:pre-wrap;font-size:13px"><?= esc_html($lead->consult_notes) ?></p>
                <?php else: ?>
                    <p style="font-size:1.2rem;font-weight:700;color:#1a3c5e">
                        $<?= number_format($lead->est_low, 0) ?> – $<?= number_format($lead->est_high, 0) ?> <small style="font-size:.75rem;font-weight:400">excl. GST</small>
                    </p>
                <?php endif; ?>
            </div>
        </div>

        <!-- Status actions -->
        <div style="margin-top:1.5rem;display:flex;gap:.75rem">
            <?php foreach (['REVIEWED' => 'Mark Reviewed', 'ACCEPTED' => 'Accept', 'REJECTED' => 'Reject'] as $action => $label):
                if ($lead->status !== $action): ?>
            <a href="?page=rg-leads&lead=<?= $id ?>&action=<?= $action ?>&_wpnonce=<?= $nonce ?>"
               class="button <?= $action === 'ACCEPTED' ? 'button-primary' : ($action === 'REJECTED' ? '' : 'button-secondary') ?>">
               <?= esc_html($label) ?>
            </a>
            <?php endif; endforeach; ?>
        </div>
    </div>
    <?php
}
