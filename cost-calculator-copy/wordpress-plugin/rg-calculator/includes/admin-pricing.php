<?php
if (!defined('ABSPATH')) exit;

add_action('admin_menu', 'rg_admin_pricing_menu');

function rg_admin_pricing_menu(): void {
    add_menu_page(
        'RG Calculator',
        'RG Calculator',
        'manage_options',
        'rg-calculator',
        'rg_admin_pricing_page',
        'dashicons-calculator',
        56
    );
    add_submenu_page(
        'rg-calculator',
        'Pricing Settings',
        'Pricing',
        'manage_options',
        'rg-calculator',
        'rg_admin_pricing_page'
    );
}

function rg_admin_pricing_page(): void {
    if (!current_user_can('manage_options')) return;

    // Save
    if (isset($_POST['rg_pricing_nonce']) && wp_verify_nonce($_POST['rg_pricing_nonce'], 'rg_save_pricing')) {
        $saved = [
            'scenarios' => [
                'ground_level'       => [
                    'ratePerMetre' => (float) ($_POST['rate_ground_level']       ?? 280),
                    'gatePrice'    => null,
                ],
                'balcony_balustrade' => [
                    'ratePerMetre' => (float) ($_POST['rate_balcony_balustrade'] ?? 320),
                    'gatePrice'    => null,
                ],
                'premium_pool_fence' => [
                    'ratePerMetre' => (float) ($_POST['rate_premium_pool_fence'] ?? 380),
                    'gatePrice'    => (float) ($_POST['gate_premium_pool_fence'] ?? 680),
                ],
                'stair_balustrade'   => [
                    'ratePerMetre' => (float) ($_POST['rate_stair_balustrade']   ?? 330),
                    'gatePrice'    => null,
                ],
            ],
            'minimumLength'           => (int)   ($_POST['minimumLength']           ?? 5),
            'cornerSurcharge'         => (float) ($_POST['cornerSurcharge']         ?? 85),
            'hardwareFinishSurcharge' => [
                'standard_chrome' => 0,
                'matte_black'     => (float) ($_POST['finish_matte_black']      ?? 15),
                'brushed_chrome'  => (float) ($_POST['finish_brushed_chrome']   ?? 12),
                'powder_coated'   => (float) ($_POST['finish_powder_coated']    ?? 22),
                'not_sure'        => 0,
            ],
            'glassTypeSurcharge' => [
                'toughened_12mm' => 0,
                'laminated'      => (float) ($_POST['glass_type_laminated'] ?? 0),
            ],
            'glassColourSurcharge' => [
                'clear'    => 0,
                'tinted'   => (float) ($_POST['glass_colour_tinted']   ?? 0),
                'frosted'  => (float) ($_POST['glass_colour_frosted']  ?? 0),
                'low_iron' => (float) ($_POST['glass_colour_low_iron'] ?? 0),
            ],
            'fixingMethodSurcharge' => [
                'spigot_round'   => (float) ($_POST['fix_spigot_round']   ?? 0),
                'standoff_posts' => (float) ($_POST['fix_standoff_posts'] ?? 0),
                'viking'         => (float) ($_POST['fix_viking']         ?? 0),
                'side_channel'   => (float) ($_POST['fix_side_channel']   ?? 0),
                'top_channel'    => (float) ($_POST['fix_top_channel']    ?? 0),
                'aluminium_1'    => (float) ($_POST['fix_aluminium_1']    ?? 0),
                'aluminium_2'    => (float) ($_POST['fix_aluminium_2']    ?? 0),
                'jh_clamps'      => (float) ($_POST['fix_jh_clamps']      ?? 0),
                'sed'            => (float) ($_POST['fix_sed']            ?? 0),
                'not_sure'       => 0,
            ],
            'interlikingRailsSurcharge' => (float) ($_POST['interlinking_rails'] ?? 0),
            'rangeLowPercent'  => (int) ($_POST['rangeLowPercent']  ?? 90),
            'rangeHighPercent' => (int) ($_POST['rangeHighPercent'] ?? 120),
        ];
        update_option('rg_calculator_pricing', $saved);
        echo '<div class="notice notice-success is-dismissible"><p>Pricing saved.</p></div>';
    }

    // Load current values
    $defaults = [
        'scenarios' => [
            'ground_level'       => ['ratePerMetre' => 280, 'gatePrice' => null],
            'balcony_balustrade' => ['ratePerMetre' => 320, 'gatePrice' => null],
            'premium_pool_fence' => ['ratePerMetre' => 380, 'gatePrice' => 680],
            'stair_balustrade'   => ['ratePerMetre' => 330, 'gatePrice' => null],
        ],
        'minimumLength'            => 5,
        'cornerSurcharge'          => 85,
        'hardwareFinishSurcharge'  => ['standard_chrome' => 0, 'matte_black' => 15, 'brushed_chrome' => 12, 'powder_coated' => 22, 'not_sure' => 0],
        'glassTypeSurcharge'       => ['toughened_12mm' => 0, 'laminated' => 0],
        'glassColourSurcharge'     => ['clear' => 0, 'tinted' => 0, 'frosted' => 0, 'low_iron' => 0],
        'fixingMethodSurcharge'    => ['spigot_round' => 0, 'standoff_posts' => 0, 'viking' => 0, 'side_channel' => 0, 'top_channel' => 0, 'aluminium_1' => 0, 'aluminium_2' => 0, 'jh_clamps' => 0, 'sed' => 0],
        'interlikingRailsSurcharge' => 0,
        'rangeLowPercent'          => 90,
        'rangeHighPercent'         => 120,
    ];

    $saved_option = get_option('rg_calculator_pricing', []);
    if (!empty($saved_option['scenarios']) && !empty($saved_option['hardwareFinishSurcharge'])) {
        $p = array_replace_recursive($defaults, $saved_option);
    } else {
        $p = $defaults;
    }

    $sc  = $p['scenarios'];
    $hw  = $p['hardwareFinishSurcharge'];
    $fm  = $p['fixingMethodSurcharge'];
    $gt  = $p['glassTypeSurcharge'];
    $gc  = $p['glassColourSurcharge'];
    $ir  = $p['interlikingRailsSurcharge'];
    ?>
    <div class="wrap">
        <h1>RG Calculator — Pricing Settings</h1>
        <p style="color:#666">Changes here take effect immediately — no rebuild required. All prices are in NZD, excluding GST.</p>

        <form method="post" action="">
            <?php wp_nonce_field('rg_save_pricing', 'rg_pricing_nonce'); ?>

            <h2>Base Rates &amp; Gate Prices</h2>
            <table class="form-table" style="max-width:700px">
                <thead>
                    <tr>
                        <th>Scenario</th>
                        <th>Base rate ($/m)</th>
                        <th>Gate price ($)</th>
                    </tr>
                </thead>
                <tbody>
                <?php
                $scenario_rows = [
                    ['ground_level',       'Ground Level Fence (≤1m)',         false],
                    ['balcony_balustrade', 'Balcony / Patio Balustrade (>1m)', false],
                    ['premium_pool_fence', 'Premium Pool Fence (1.2m)',         true],
                    ['stair_balustrade',   'Stair Balustrade',                  false],
                ];
                foreach ($scenario_rows as [$key, $label, $has_gate]):
                    $rate = $sc[$key]['ratePerMetre'] ?? '';
                    $gate = $sc[$key]['gatePrice'] ?? '';
                ?>
                <tr>
                    <td><strong><?= esc_html($label) ?></strong></td>
                    <td>
                        <input type="number" name="rate_<?= esc_attr($key) ?>" value="<?= esc_attr($rate) ?>"
                               step="any" min="0" style="width:100px" class="regular-text">
                    </td>
                    <td>
                        <?php if ($has_gate): ?>
                            <input type="number" name="gate_<?= esc_attr($key) ?>" value="<?= esc_attr($gate) ?>"
                                   step="any" min="0" style="width:100px" class="regular-text">
                        <?php else: ?>
                            <span style="color:#999">N/A</span>
                        <?php endif; ?>
                    </td>
                </tr>
                <?php endforeach; ?>
                </tbody>
            </table>

            <h2 style="margin-top:2rem">Glass Type Surcharges ($/m)</h2>
            <p style="color:#666;font-size:13px">Applied per linear metre when selected. 12mm Toughened is always the base — no surcharge. Shown only for Balcony/Patio and Stair scenarios.</p>
            <table class="form-table" style="max-width:500px">
                <tbody>
                <tr>
                    <th scope="row"><label for="glass_type_laminated">Laminated Glass</label></th>
                    <td>
                        <input type="number" id="glass_type_laminated" name="glass_type_laminated"
                               value="<?= esc_attr($gt['laminated'] ?? 0) ?>" step="any" min="0" style="width:100px" class="regular-text">
                        <span class="description"> $/m</span>
                    </td>
                </tr>
                </tbody>
            </table>

            <h2 style="margin-top:2rem">Glass Colour Surcharges ($/m)</h2>
            <p style="color:#666;font-size:13px">Applied per linear metre when selected. Clear glass is always free. Frosted glass diffuses light for privacy.</p>
            <table class="form-table" style="max-width:500px">
                <tbody>
                <?php
                $colour_rows = [
                    ['tinted',   'Tinted Glass',           $gc['tinted']   ?? 0],
                    ['frosted',  'Frosted Glass',          $gc['frosted']  ?? 0],
                    ['low_iron', 'Low Iron / Ultra-Clear', $gc['low_iron'] ?? 0],
                ];
                foreach ($colour_rows as [$key, $label, $val]):
                ?>
                <tr>
                    <th scope="row"><label for="glass_colour_<?= esc_attr($key) ?>"><?= esc_html($label) ?></label></th>
                    <td>
                        <input type="number" id="glass_colour_<?= esc_attr($key) ?>" name="glass_colour_<?= esc_attr($key) ?>"
                               value="<?= esc_attr($val) ?>" step="any" min="0" style="width:100px" class="regular-text">
                        <span class="description"> $/m</span>
                    </td>
                </tr>
                <?php endforeach; ?>
                </tbody>
            </table>

            <h2 style="margin-top:2rem">Interlinking Rails Surcharge ($/m)</h2>
            <p style="color:#666;font-size:13px">Applied per linear metre when interlinking (top) rails are added. Only available with 12mm Toughened glass on Balcony/Patio and Stair scenarios.</p>
            <table class="form-table" style="max-width:500px">
                <tbody>
                <tr>
                    <th scope="row"><label for="interlinking_rails">Interlinking Rails</label></th>
                    <td>
                        <input type="number" id="interlinking_rails" name="interlinking_rails"
                               value="<?= esc_attr($ir) ?>" step="any" min="0" style="width:100px" class="regular-text">
                        <span class="description"> $/m</span>
                    </td>
                </tr>
                </tbody>
            </table>

            <h2 style="margin-top:2rem">Hardware Finish Surcharges ($/m)</h2>
            <p style="color:#666;font-size:13px">Added per linear metre when a premium finish is selected. Standard Chrome is always free.</p>
            <table class="form-table" style="max-width:500px">
                <tbody>
                <?php
                $finish_rows = [
                    ['matte_black',    'Matte Black',    $hw['matte_black']    ?? 15],
                    ['brushed_chrome', 'Brushed Chrome', $hw['brushed_chrome'] ?? 12],
                    ['powder_coated',  'Powder Coated',  $hw['powder_coated']  ?? 22],
                ];
                foreach ($finish_rows as [$key, $label, $val]):
                ?>
                <tr>
                    <th scope="row"><label for="finish_<?= esc_attr($key) ?>"><?= esc_html($label) ?></label></th>
                    <td>
                        <input type="number" id="finish_<?= esc_attr($key) ?>" name="finish_<?= esc_attr($key) ?>"
                               value="<?= esc_attr($val) ?>" step="any" min="0" style="width:100px" class="regular-text">
                        <span class="description"> $/m</span>
                    </td>
                </tr>
                <?php endforeach; ?>
                </tbody>
            </table>

            <h2 style="margin-top:2rem">Fixing Method Surcharges ($/m)</h2>
            <p style="color:#666;font-size:13px">Applied per linear metre based on the selected fixing method. Use negative values for cheaper methods (e.g. −100 = $100/m discount). Set to 0 to include cost in the base rate. SED always triggers a consultation flag regardless of surcharge.</p>
            <table class="form-table" style="max-width:500px">
                <tbody>
                <?php
                $fixing_rows = [
                    ['spigot_round',   'Spigot Round',    $fm['spigot_round']   ?? 0],
                    ['standoff_posts', 'Stand-off Posts', $fm['standoff_posts'] ?? 0],
                    ['viking',         'Viking System',   $fm['viking']         ?? 0],
                    ['side_channel',   'Side Channel',    $fm['side_channel']   ?? 0],
                    ['top_channel',    'Top Channel',     $fm['top_channel']    ?? 0],
                    ['aluminium_1',    'Aluminium 1',     $fm['aluminium_1']    ?? 0],
                    ['aluminium_2',    'Aluminium 2',     $fm['aluminium_2']    ?? 0],
                    ['jh_clamps',      'JH Clamps',       $fm['jh_clamps']      ?? 0],
                    ['sed',            'SED',             $fm['sed']            ?? 0],
                ];
                foreach ($fixing_rows as [$key, $label, $val]):
                ?>
                <tr>
                    <th scope="row"><label for="fix_<?= esc_attr($key) ?>"><?= esc_html($label) ?></label></th>
                    <td>
                        <input type="number" id="fix_<?= esc_attr($key) ?>" name="fix_<?= esc_attr($key) ?>"
                               value="<?= esc_attr($val) ?>" step="any" style="width:100px" class="regular-text">
                        <span class="description"> $/m</span>
                    </td>
                </tr>
                <?php endforeach; ?>
                </tbody>
            </table>

            <h2 style="margin-top:2rem">Other Settings</h2>
            <table class="form-table" style="max-width:500px">
                <tbody>
                <tr>
                    <th scope="row"><label for="cornerSurcharge">Corner surcharge ($)</label></th>
                    <td>
                        <input type="number" id="cornerSurcharge" name="cornerSurcharge"
                               value="<?= esc_attr($p['cornerSurcharge']) ?>" step="any" min="0" style="width:100px" class="regular-text">
                        <p class="description">Per 90° corner in the glass run.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="minimumLength">Minimum chargeable length (m)</label></th>
                    <td>
                        <input type="number" id="minimumLength" name="minimumLength"
                               value="<?= esc_attr($p['minimumLength']) ?>" step="1" min="1" style="width:100px" class="regular-text">
                        <p class="description">Jobs shorter than this are charged as if they were this length.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="rangeLowPercent">Estimate low band (%)</label></th>
                    <td>
                        <input type="number" id="rangeLowPercent" name="rangeLowPercent"
                               value="<?= esc_attr($p['rangeLowPercent']) ?>" step="1" min="50" max="100" style="width:100px" class="regular-text">
                        <p class="description">Low estimate = subtotal × this ÷ 100. E.g. 90 = –10%.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="rangeHighPercent">Estimate high band (%)</label></th>
                    <td>
                        <input type="number" id="rangeHighPercent" name="rangeHighPercent"
                               value="<?= esc_attr($p['rangeHighPercent']) ?>" step="1" min="100" max="200" style="width:100px" class="regular-text">
                        <p class="description">High estimate = subtotal × this ÷ 100. E.g. 120 = +20%.</p>
                    </td>
                </tr>
                </tbody>
            </table>

            <h2 style="margin-top:2rem">Formula Reference</h2>
            <div style="background:#f9f9f9;border:1px solid #e0e0e0;padding:16px;border-radius:4px;max-width:640px;font-size:13px;line-height:1.7">
                <code style="display:block;background:#fff;padding:12px;border-radius:3px;white-space:pre-wrap">
Billable length      = max(entered length, minimumLength)

Base cost            = billable length × scenario base rate
Corner cost          = number of corners × corner surcharge
Gate cost            = number of gates × gate price  (Pool Fence only)
Glass type surcharge = billable length × glass type surcharge/m
Glass colour surcharge = billable length × colour surcharge/m
Interlinking rails   = billable length × interlinking rails surcharge/m  (if ticked)
Fixing surcharge     = billable length × fixing method surcharge/m
Finish surcharge     = billable length × finish surcharge/m

Subtotal             = base + corners + gates + fixing + glass type + glass colour + interlinking + finish
Low estimate         = subtotal × rangeLowPercent  / 100
High estimate        = subtotal × rangeHighPercent / 100
                </code>
                <p style="margin-top:12px;color:#666"><strong>Standard heights assumed:</strong><br>
                Ground Level ≤1m · Balcony/Patio 1m (NZBC) · Pool Fence 1.2m (NZ Pool Safety Act) · Stair 1m (NZBC)</p>
            </div>

            <?php submit_button('Save pricing', 'primary', 'submit', true, ['style' => 'margin-top:1.5rem']); ?>
        </form>
    </div>
    <?php
}
