import type { WizardAnswers, PricingConfig, EstimateResult } from './types';
import { DEFAULT_PRICING } from './config';

export function calculateEstimate(
  answers: WizardAnswers,
  pricing: PricingConfig = DEFAULT_PRICING
): EstimateResult {
  const totalInputLength = answers.scenario === 'stair_balustrade'
    ? answers.length + (answers.landingLength ?? 0)
    : answers.length;
  const effectiveLength = Math.max(totalInputLength, pricing.minimumLength);

  if (!answers.scenario) {
    return {
      effectiveLength,
      subtotal: 0,
      low: 0,
      high: 0,
      needsCallUs: answers.callTriggers.length > 0,
      consultationFlags: [],
      breakdown: { base: 0, gates: 0, corners: 0, hardwareSurcharge: 0, fixingMethodSurcharge: 0, glassTypeSurcharge: 0, glassColourSurcharge: 0, interlikingRails: 0 },
    };
  }

  const scenarioPricing = pricing.scenarios[answers.scenario];

  const base = effectiveLength * scenarioPricing.ratePerMetre;

  const gates =
    scenarioPricing.gatePrice !== null
      ? answers.gates * scenarioPricing.gatePrice
      : 0;

  const corners = answers.corners * pricing.cornerSurcharge;

  const finishSurchargePerMetre =
    pricing.hardwareFinishSurcharge[answers.hardwareFinish ?? 'standard_chrome'] ?? 0;
  const hardwareSurcharge = effectiveLength * finishSurchargePerMetre;

  const glassTypeSurcharge =
    effectiveLength * (pricing.glassTypeSurcharge[answers.glassType ?? 'toughened_12mm'] ?? 0);

  const glassColourSurcharge =
    effectiveLength * (pricing.glassColourSurcharge[answers.glassColour] ?? 0);

  const interlikingRails =
    answers.interlikingRails ? effectiveLength * pricing.interlikingRailsSurcharge : 0;

  const fixingMethodSurchargePerMetre =
    pricing.fixingMethodSurcharge?.[answers.fixingMethod ?? 'not_sure'] ?? 0;
  const fixingMethodSurcharge = effectiveLength * fixingMethodSurchargePerMetre;

  const subtotal = base + gates + corners + hardwareSurcharge + fixingMethodSurcharge + glassTypeSurcharge + glassColourSurcharge + interlikingRails;

  const roundToNearest = (n: number, to = 50) => Math.round(n / to) * to;

  const low  = roundToNearest(subtotal * (pricing.rangeLowPercent  / 100));
  const high = roundToNearest(subtotal * (pricing.rangeHighPercent / 100));
  const consultationFlags: string[] = [];
    if (answers.fixingMethod === 'not_sure')   consultationFlags.push('Fixing method to be confirmed on site');
    if (answers.fixingMethod === 'sed')        consultationFlags.push('Special Engineer Design required — our team will be in touch to discuss requirements');
    if (answers.hardwareFinish === 'not_sure') consultationFlags.push('Hardware finish to be confirmed');
    if (answers.substrate === 'not_sure')      consultationFlags.push('Substrate to be confirmed on site');

  return {
    effectiveLength,
    subtotal,
    low,
    high,
    needsCallUs: answers.callTriggers.length > 0,
    consultationFlags, 
    breakdown: { base, gates, corners, hardwareSurcharge, fixingMethodSurcharge, glassTypeSurcharge, glassColourSurcharge, interlikingRails },
  };
}

export const formatNZD = (amount: number): string =>
  new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
    maximumFractionDigits: 0,
  }).format(amount);
