import type { PricingConfig } from './types';

export const DEFAULT_PRICING: PricingConfig = {
  scenarios: {
    ground_level:       { ratePerMetre: 280, gatePrice: null },
    balcony_balustrade: { ratePerMetre: 320, gatePrice: null },
    premium_pool_fence: { ratePerMetre: 380, gatePrice: 680 },
    stair_balustrade:   { ratePerMetre: 330, gatePrice: null },
  },
  minimumLength: 5,
  cornerSurcharge: 85,
  hardwareFinishSurcharge: {
    standard_chrome: 0,
    matte_black:     15,
    brushed_chrome:  12,
    powder_coated:   22,
    not_sure:        0,
  },
  fixingMethodSurcharge: {
    spigot_round:   0,
    standoff_posts: 0,
    viking:         0,
    jh_clamps:      0,
    side_channel:   0,
    top_channel:    0,
    aluminium_1:    0,
    aluminium_2:    0,
    sed:            0,
    
  },
  glassTypeSurcharge: {
    toughened_12mm: 0,
    laminated:      0,  // placeholder — set via WP admin
  },
  glassColourSurcharge: {
    clear:    0,
    low_iron: 0,  // placeholder — set via WP admin
    tinted:   0,  // placeholder — set via WP admin
    frosted:  0,
  },
  interlikingRailsSurcharge: 0,  // placeholder — set via WP admin
  rangeLowPercent:  90,
  rangeHighPercent: 120,
};

// Detect the plugin's asset URL.
// Primary: use the URL injected by wp_localize_script — works even when caching
// plugins rename or combine scripts.
// Fallback: parse it from the script tag src, then hardcoded default.
function getPluginBase(): string {
  if (typeof document === 'undefined') return '/wp-content/plugins/rg-calculator/assets/';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfg = (window as any).rgCalculatorConfig;
  if (cfg?.assetsUrl) return cfg.assetsUrl;

  // Fallback for Vite dev server (no WordPress present)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return '/wordpress-plugin/rg-calculator/assets/';
  }

  const script = document.querySelector('script[src*="rg-calculator.js"]') as HTMLScriptElement | null;
  if (script?.src) {
    try {
      const url = new URL(script.src, window.location.origin);
      const base = url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1);
      return `${url.origin}${base}`;
    } catch {
      // fall through
    }
  }

  return '/wp-content/plugins/rg-calculator/assets/';
}

const BASE = getPluginBase();
const img = (name: string) => BASE + name;

export const IMAGES = {
  // Scenario cards
  groundLevel: img('use-deck.jpg'),
  balcony:     img('use-balcony.jpg'),
  pool:        img('use-pool.jpg'),
  stairs:      img('use-stairs.jpg'),

  // Corners helper
  corners: img('feature-corner.jpg'),

  // Gates helper
  gates: img('feature-gate.jpg'),

  // Glass type
  toughened: img('glass-12mm.jpg'),
  laminated: img('glass-laminated.jpg'),

  // Glass colour
  colourClear:   img('clarity-standard.jpg'),
  colourLowIron: img('clarity-lowiron.jpg'),
  colourTinted:  img('clarity-tinted.jpg'),
  colourCustom:  img('finish-custom.jpg'),
  colourFrosted: img('clarity-frosted.jpg'),

  // Fixing method
  spigotRound:   img('fix-spigots.jpg'),
  standoff:      img('fix-standoff.jpg'),
  viking:        img('fix-viking.jpg'),
  jhClamps:      img('fix-jh-clamp.jpg'),
  sideChannel:   img('fix-side-channel.jpg'),
  topChannel:    img('fix-top-channel.jpg'),
  aluminiumOne:  img('fix-alu1.jpg'),
  aluminiumTwo:  img('fix-alu2.jpg'),
  sed:           img('not-sure.jpg'),

  // Hardware finish
  chrome:        img('finish-chrome.jpg'),
  matteBlack:    img('finish-black.jpg'),
  brushedChrome: img('finish-brushed.jpg'),
  powderCoated:  img('finish-powder.jpg'),
  finishCustom:  img('finish-custom.jpg'),
  notSure:       img('not-sure.jpg'),

  // Substrate
  substrateTimber:   img('substrate-timber.jpg'),
  substrateConcrete: img('substrate-concrete.jpg'),
  substrateTile:     img('substrate-tile.jpg'),
  substrateSteel:    img('substrate-steel.jpg'),
};
