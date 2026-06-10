export type Scenario =
  | 'ground_level'
  | 'balcony_balustrade'
  | 'premium_pool_fence'
  | 'stair_balustrade';

export type GlassType = 'toughened_12mm' | 'laminated';
export type GlassColour = 'clear' | 'low_iron' | 'tinted' | 'frosted';
export type FixingMethod =
  | 'spigot_round'
  | 'standoff_posts'
  | 'viking'
  | 'jh_clamps'
  | 'side_channel'
  | 'top_channel'
  | 'aluminium_1'
  | 'aluminium_2'
  | 'sed';
export type SubstrateType = 'timber' | 'concrete' | 'tile' | 'steel' | 'not_sure';

export type HardwareFinish =
  | 'standard_chrome'
  | 'matte_black'
  | 'brushed_chrome'
  | 'powder_coated'
  | 'not_sure';

export type CustomerType = 'homeowner' | 'builder' | 'architect' | 'developer' | 'pool_builder' | 'other';
export type Timeframe = 'asap' | '1_3_months' | '3_6_months' | '6_plus_months' | 'just_planning';

export interface WizardAnswers {
  scenario: Scenario | null;
  length: number;
  landingLength: number;
  corners: number;
  gates: number;
  glassType: GlassType | null;
  glassColour: GlassColour;
  interlikingRails: boolean;
  fixingMethod: FixingMethod | null;
  substrate: SubstrateType | null;
  hardwareFinish: HardwareFinish | null;
  callTriggers: string[];
}

export interface LeadData {
  fullName: string;
  phone: string;
  email: string;
  customerType: CustomerType | null;
  timeframe: Timeframe | null;
  address: string;
  notes: string;
  consent: boolean;
  marketingConsent: boolean;
}

export interface ScenarioPricing {
  ratePerMetre: number;
  gatePrice: number | null;
}

export interface PricingConfig {
  scenarios: Record<Scenario, ScenarioPricing>;
  minimumLength: number;
  cornerSurcharge: number;
  hardwareFinishSurcharge: Record<HardwareFinish, number>;
  fixingMethodSurcharge: Record<FixingMethod, number>;
  glassTypeSurcharge: Record<GlassType, number>;
  glassColourSurcharge: Record<GlassColour, number>;
  interlikingRailsSurcharge: number;
  rangeLowPercent: number;
  rangeHighPercent: number;
}

export interface EstimateResult {
  effectiveLength: number;
  subtotal: number;
  low: number;
  high: number;
  needsCallUs: boolean;
  consultationFlags: string[];
  breakdown: {
    base: number;
    gates: number;
    corners: number;
    hardwareSurcharge: number;
    fixingMethodSurcharge: number;
    glassTypeSurcharge: number;
    glassColourSurcharge: number;
    interlikingRails: number;
  };
}

export interface LeadPayload {
  answers: WizardAnswers;
  lead: LeadData;
  estimate: EstimateResult;
  turnstileToken: string;
  loadedAt: number;
}

export interface LeadResponse {
  ok: boolean;
  leadId?: number;
  error?: string;
}
