<?php
if (!defined('ABSPATH')) exit;

/**
 * Validate and sanitize a submitted lead array.
 * Returns WP_Error on failure, true on success.
 *
 * @param array $lead Raw lead data from request body.
 * @return true|WP_Error
 */
function rg_validate_lead(array $lead) {
    // Required fields
    $required = ['firstName', 'phone', 'email', 'address'];
    foreach ($required as $field) {
        if (empty(trim($lead[$field] ?? ''))) {
            return new WP_Error('missing_field', "Missing required field: {$field}");
        }
    }

    // Email
    if (!is_email($lead['email'])) {
        return new WP_Error('invalid_email', 'Invalid email address');
    }

    // Phone — allow NZ formats: 021 000 000, +64 21 000 000, 09-000-0000 etc.
    $phone = preg_replace('/[\s\-\(\)\.]/', '', (string) ($lead['phone'] ?? ''));
    if (!preg_match('/^(\+64|0)(2\d{7,9}|[3-9]\d{7}|800\d{6,7}|900\d{6,7})$/', $phone)) {
        return new WP_Error('invalid_phone', 'Invalid NZ phone number');
    }

    // Consent must be true
    if (empty($lead['consent'])) {
        return new WP_Error('no_consent', 'Consent was not given');
    }

    return true;
}

/**
 * Sanitize a lead array for database storage.
 */
function rg_sanitize_lead(array $lead): array {
    $consented     = !empty($lead['consent']);
    $allowed_types = ['homeowner', 'builder', 'developer', 'architect', 'pool_builder', 'other'];
    $raw_type      = sanitize_text_field($lead['customerType'] ?? '');
    return [
        'firstName'      => sanitize_text_field($lead['firstName']   ?? ''),
        'lastName'       => sanitize_text_field($lead['lastName']    ?? ''),
        'phone'          => sanitize_text_field($lead['phone']       ?? ''),
        'email'          => sanitize_email($lead['email']            ?? ''),
        'customerType'   => in_array($raw_type, $allowed_types, true) ? $raw_type : '',
        'address'        => sanitize_text_field($lead['address']     ?? ''),
        'callPreference' => sanitize_text_field($lead['callPreference'] ?? 'anytime'),
        'notes'          => sanitize_textarea_field($lead['notes']   ?? ''),
        'consentGiven'   => $consented ? 1 : 0,
        'consentedAt'    => $consented ? current_time('mysql') : null,
    ];
}

/**
 * Sanitize answers for storage.
 */
function rg_sanitize_answers(array $answers): array {
    $allowed_scenarios    = ['ground_level', 'balcony_balustrade', 'premium_pool_fence', 'stair_balustrade'];
    $allowed_glass_types  = ['toughened_12mm', 'laminated'];
    $allowed_glass_colours = ['clear', 'low_iron', 'tinted', 'frosted'];

    $scenario     = sanitize_text_field($answers['scenario']    ?? '');
    $glass_type   = sanitize_text_field($answers['glassType']   ?? 'toughened_12mm');
    $glass_colour = sanitize_text_field($answers['glassColour'] ?? 'clear');

    $raw_triggers  = $answers['callTriggers'] ?? [];
    $call_triggers = is_array($raw_triggers)
        ? array_map('sanitize_text_field', $raw_triggers)
        : [];

    return [
        'scenario'         => in_array($scenario,     $allowed_scenarios,     true) ? $scenario     : '',
        'length'           => (int)   ($answers['length']          ?? 0),
        'landingLength'    => (int)   ($answers['landingLength']   ?? 0),
        'corners'          => (int)   ($answers['corners']         ?? 0),
        'gates'            => (int)   ($answers['gates']           ?? 0),
        'glassType'        => in_array($glass_type,   $allowed_glass_types,   true) ? $glass_type   : 'toughened_12mm',
        'glassColour'      => in_array($glass_colour, $allowed_glass_colours, true) ? $glass_colour : 'clear',
        'interlikingRails' => !empty($answers['interlikingRails']),
        'fixingMethod'     => sanitize_text_field($answers['fixingMethod']    ?? ''),
        'substrate'        => sanitize_text_field($answers['substrate']       ?? ''),
        'hardwareFinish'   => sanitize_text_field($answers['hardwareFinish']  ?? ''),
        'callTriggers'     => $call_triggers,
    ];
}

/**
 * Sanitize estimate data for storage.
 */
function rg_sanitize_estimate(array $est): array {
    $low  = max(0.0, min((float) ($est['low']  ?? $est['estimate_low']  ?? 0), 999999.0));
    $high = max(0.0, min((float) ($est['high'] ?? $est['estimate_high'] ?? 0), 999999.0));
    if ($low > $high) { $high = $low; }
    return [
        'low'         => $low,
        'high'        => $high,
        'subtotal'    => max(0.0, min((float) ($est['subtotal'] ?? 0), 999999.0)),
        'needsCallUs' => (bool) ($est['needsCallUs'] ?? false),
    ];
}

/**
 * Normalize incoming lead payload to canonical keys used by PHP.
 */
function rg_normalize_lead(array $lead): array {
    if (empty($lead['firstName']) && !empty($lead['fullName'])) {
        $full = trim((string) $lead['fullName']);
        $parts = preg_split('/\s+/', $full);
        $lead['firstName'] = $parts[0] ?? '';
        $lead['lastName'] = count($parts) > 1 ? implode(' ', array_slice($parts, 1)) : '';
    }

    if (empty($lead['address']) && !empty($lead['suburb'])) {
        $lead['address'] = $lead['suburb'];
    }

    if (!array_key_exists('websiteUrl', $lead) && array_key_exists('website_url', $lead)) {
        $lead['websiteUrl'] = $lead['website_url'];
    }

    if (!array_key_exists('websiteUrl', $lead) && array_key_exists('website', $lead)) {
        $lead['websiteUrl'] = $lead['website'];
    }

    return $lead;
}

/**
 * Validate calculator answers shape and bounds.
 */
function rg_validate_answers(array $answers) {
    $allowed_scenarios    = ['ground_level', 'balcony_balustrade', 'premium_pool_fence', 'stair_balustrade'];
    $allowed_glass_types  = ['toughened_12mm', 'laminated'];
    $allowed_glass_colours = ['clear', 'low_iron', 'tinted', 'frosted'];

    $scenario = sanitize_text_field($answers['scenario'] ?? '');
    if ($scenario === '' || !in_array($scenario, $allowed_scenarios, true)) {
        return new WP_Error('invalid_scenario', 'Invalid scenario');
    }

    $glass_type = sanitize_text_field($answers['glassType'] ?? '');
    if ($glass_type !== '' && !in_array($glass_type, $allowed_glass_types, true)) {
        return new WP_Error('invalid_glass_type', 'Invalid glass type');
    }

    $glass_colour = sanitize_text_field($answers['glassColour'] ?? '');
    if ($glass_colour !== '' && !in_array($glass_colour, $allowed_glass_colours, true)) {
        return new WP_Error('invalid_glass_colour', 'Invalid glass colour');
    }

    $length = (int) ($answers['length'] ?? 0);
    if ($length < 1 || $length > 200) {
        return new WP_Error('invalid_length', 'Invalid project length');
    }

    $corners = (int) ($answers['corners'] ?? 0);
    $gates   = (int) ($answers['gates']   ?? 0);
    if ($corners < 0 || $corners > 50 || $gates < 0 || $gates > 20) {
        return new WP_Error('invalid_counts', 'Invalid corner or gate count');
    }

    return true;
}
