<?php
/**
 * Plugin Name: RG Cost Calculator
 * Plugin URI: https://royalglass.co.nz
 * Description: Frameless glass cost calculator with lead capture. Use shortcode [rg_calculator] on any page.
 * Version: 2.3.0
 * Author: Royal Glass Limited
 * Text Domain: rg-calculator
 *
 * ── Setup ────────────────────────────────────────────────────────────────────
 * Add to wp-config.php (NEVER commit these to git):
 *
 *   define('RG_GOOGLE_MAPS_KEY',   'AIza...');       // Google Maps Platform API key
 *   define('RG_TURNSTILE_SITE_KEY','0x...');         // Cloudflare Turnstile site key
 *   define('RG_TURNSTILE_SECRET',  '0x...');         // Cloudflare Turnstile secret key
 *   define('RG_LEAD_NOTIFY_EMAIL', 'info@royalglass.co.nz'); // who gets new lead notifications
 *   define('RG_SM8_INBOX_EMAIL',   'de9f86@inbox.servicem8.com'); // ServiceM8 inbox (comma-separate to add test address)
 */

if (!defined('ABSPATH')) exit;

define('RG_CALC_VERSION',  '2.3.0');
define('RG_CALC_DIR',       plugin_dir_path(__FILE__));
define('RG_CALC_URL',       plugin_dir_url(__FILE__));

// ── Load includes ─────────────────────────────────────────────────────────────
require_once RG_CALC_DIR . 'includes/database.php';
require_once RG_CALC_DIR . 'includes/validation.php';
require_once RG_CALC_DIR . 'includes/email.php';
require_once RG_CALC_DIR . 'includes/api.php';
require_once RG_CALC_DIR . 'includes/servicem8.php';
require_once RG_CALC_DIR . 'includes/admin-pricing.php';
require_once RG_CALC_DIR . 'includes/admin-leads.php';

// ── Activation: create DB table ───────────────────────────────────────────────
register_activation_hook(__FILE__, 'rg_calc_activate');
function rg_calc_activate() {
    rg_create_leads_table();
    rg_sm8_schedule_cron();
}
// ── Deactivation: clear cron ──────────────────────────────────────────────────
register_deactivation_hook(__FILE__, 'rg_calc_deactivate');
function rg_calc_deactivate() {
    rg_sm8_unschedule_cron();
}

// ── Shortcode ─────────────────────────────────────────────────────────────────
add_shortcode('rg_calculator', 'rg_calc_shortcode');

function rg_calc_shortcode(): string {
    // Enqueue assets only when the shortcode is used
    rg_calc_enqueue_assets();

    ob_start();
    ?>
    <!-- RG Calculator SEO wrapper - indexed by Google, invisible to users when JS loads -->
    <noscript>
        <div style="padding:2rem;background:#f9fafb;border-radius:8px;text-align:center">
            <h2>Get an instant glass balustrade or pool fence estimate</h2>
            <p>Please enable JavaScript to use the cost calculator, or call us on
               <a href="tel:0800769254">0800 769 254</a>.</p>
        </div>
    </noscript>

    <!-- Calculator mount point -->
    <div id="rg-calculator-root" aria-label="Royal Glass cost calculator"></div>
    <?php
    return ob_get_clean();
}

// ── Asset enqueue ─────────────────────────────────────────────────────────────
function rg_calc_enqueue_assets() {
    static $enqueued = false;
    if ($enqueued) return;
    $enqueued = true;

    wp_enqueue_script(
        'rg-calculator',
        RG_CALC_URL . 'assets/rg-calculator.js',
        [],
        RG_CALC_VERSION,
        true // load in footer
    );

    wp_enqueue_style(
        'rg-calculator',
        RG_CALC_URL . 'assets/rg-calculator.css',
        [],
        RG_CALC_VERSION
    );

    // Pass config to the React app via window.rgCalculatorConfig
    wp_localize_script('rg-calculator', 'rgCalculatorConfig', [
        'restUrl'          => esc_url_raw(rest_url('royal-glass/v1')),
        'nonce'            => wp_create_nonce('wp_rest'),
        'googleMapsKey'    => defined('RG_GOOGLE_MAPS_KEY')    ? RG_GOOGLE_MAPS_KEY    : '',
        'turnstileSiteKey' => defined('RG_TURNSTILE_SITE_KEY') ? RG_TURNSTILE_SITE_KEY : '',
        'assetsUrl'        => RG_CALC_URL . 'assets/',
    ]);
}

// ── SEO: inject schema markup in <head> when calculator page is viewed ─────────
add_action('wp_head', 'rg_calc_schema_markup');

function rg_calc_schema_markup() {
    // Only output on pages/posts that use the shortcode
    global $post;
    if (!$post || !has_shortcode($post->post_content, 'rg_calculator')) return;

    $schema = [
        '@context' => 'https://schema.org',
        '@graph'   => [
            // LocalBusiness
            [
                '@type'       => 'LocalBusiness',
                '@id'         => 'https://royalglass.co.nz/#organization',
                'name'        => 'Royal Glass Limited',
                'url'         => 'https://royalglass.co.nz',
                'telephone'   => '+6480076925',
                'email'       => 'support@royalglass.co.nz',
                'address'     => [
                    '@type'           => 'PostalAddress',
                    'streetAddress'   => '13E Paul Matthews Road, Rosedale',
                    'addressLocality' => 'Auckland',
                    'postalCode'      => '0632',
                    'addressCountry'  => 'NZ',
                ],
                'aggregateRating' => [
                    '@type'       => 'AggregateRating',
                    'ratingValue' => '4.9',
                    'reviewCount' => '66',
                ],
                'priceRange'  => '$$',
                'areaServed'  => ['Auckland', 'North Shore', 'Waitakere', 'Manukau'],
            ],
            // Service
            [
                '@type'       => 'Service',
                'name'        => 'Frameless Glass Balustrade Installation Auckland',
                'provider'    => ['@id' => 'https://royalglass.co.nz/#organization'],
                'areaServed'  => 'Auckland, New Zealand',
                'description' => 'Supply and installation of frameless glass balustrades and pool fences in Auckland. Compliant with NZ Building Code.',
                'url'         => get_permalink(),
            ],
            // FAQPage — AEO (answers AI-powered search snippets)
            [
                '@type'       => 'FAQPage',
                'mainEntity'  => [
                    [
                        '@type'          => 'Question',
                        'name'           => 'How much does a glass balustrade cost in Auckland?',
                        'acceptedAnswer' => [
                            '@type' => 'Answer',
                            'text'  => 'Glass balustrades in Auckland typically start from $500 per linear metre for frameless designs using 12mm toughened clear glass, with a 5-metre minimum. The total cost depends on length, number of corners, gates, fixing method, and hardware finish. Use our instant calculator for an estimate, or call 0800 769 254.',
                        ],
                    ],
                    [
                        '@type'          => 'Question',
                        'name'           => 'How much does a glass pool fence cost in NZ?',
                        'acceptedAnswer' => [
                            '@type' => 'Answer',
                            'text'  => 'A frameless glass pool fence in New Zealand typically costs from $500 per linear metre. Pool fences must be 1.2m high to meet NZ building regulations. Gates are priced separately and must include compliant self-closing hardware. Get an instant estimate using the calculator above.',
                        ],
                    ],
                    [
                        '@type'          => 'Question',
                        'name'           => 'What is the minimum height for a glass balustrade in NZ?',
                        'acceptedAnswer' => [
                            '@type' => 'Answer',
                            'text'  => 'Under the New Zealand Building Code (Clause F4), balustrades on decks or balconies more than 1 metre above ground must be at least 1 metre high. Pool fences must be a minimum of 1.2 metres high under NZ pool safety regulations.',
                        ],
                    ],
                    [
                        '@type'          => 'Question',
                        'name'           => 'Do I need a producer statement (PS1) for a glass balustrade?',
                        'acceptedAnswer' => [
                            '@type' => 'Answer',
                            'text'  => 'A producer statement (PS1) is required when a building consent is needed — typically for upper-floor balustrades, new builds, or larger decks. Royal Glass is registered with Auckland Council to sign PS1 documents for balustrades and pool fences.',
                        ],
                    ],
                    [
                        '@type'          => 'Question',
                        'name'           => 'How long does it take to install a glass balustrade?',
                        'acceptedAnswer' => [
                            '@type' => 'Answer',
                            'text'  => 'Most residential glass balustrade or pool fence installations are completed in a single day. Larger or more complex projects may take 1–2 days. Royal Glass will confirm the timeline in the formal quote after the free site visit.',
                        ],
                    ],
                ],
            ],
        ],
    ];

    echo '<script type="application/ld+json">' . wp_json_encode($schema, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . '</script>' . "\n";
}

// ── Header: dark background on calculator page only ───────────────────────────
add_action('wp_head', 'rg_calc_header_styles');

function rg_calc_header_styles() {
    global $post;
    if (!$post || !has_shortcode($post->post_content, 'rg_calculator')) return;
    ?>
    <style>
      #masthead {
        background-color: #3d3d3d !important;
      }
      #masthead a,
      #masthead .main-header-menu .menu-item > a,
      #masthead .ast-builder-menu-1 .menu-item > a {
        color: #ffffff !important;
      }
      #masthead .menu-toggle,
      #masthead .ast-mobile-menu-trigger-toggle,
      #masthead .ast-mobile-menu-trigger-toggle span {
        color: #ffffff !important;
      }
      
      #rg-calculator-root {
        margin-top: 100px;
      }
    </style>
    <?php
}

// ── REST: fix 404 on first install (flush rewrite rules) ─────────────────────
add_action('init', 'rg_calc_register_routes_init');
function rg_calc_register_routes_init() {
    // Routes are registered inside api.php's rest_api_init hook
}
