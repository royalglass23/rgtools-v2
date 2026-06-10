import { useState, useEffect } from 'react';
import type { PricingConfig } from '../lib/calculator/types';
import { DEFAULT_PRICING } from '../lib/calculator/config';

declare const rgCalculatorConfig: {
  restUrl: string;
  nonce: string;
  googleMapsKey: string;
  turnstileSiteKey: string;
  assetsUrl: string;
};

export function usePricing(): { pricing: PricingConfig; loading: boolean } {
  const [pricing, setPricing] = useState<PricingConfig>(DEFAULT_PRICING);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restUrl =
      typeof rgCalculatorConfig !== 'undefined'
        ? rgCalculatorConfig.restUrl
        : '/wp-json/royal-glass/v1';

    fetch(`${restUrl}/pricing`)
      .then((r) => r.json())
      .then((data: unknown) => {
        // Validate that the response has the expected nested structure before using it.
        // If the WordPress option still holds the old flat V1 shape, fall through to defaults.
        const d = data as Partial<PricingConfig>;
        if (d && typeof d === 'object' && d.scenarios && d.hardwareFinishSurcharge) {
          setPricing({ ...DEFAULT_PRICING, ...d });
        }
      })
      .catch(() => {
        // Silently fall back to compiled defaults
      })
      .finally(() => setLoading(false));
  }, []);

  return { pricing, loading };
}

export function getConfig() {
  if (typeof rgCalculatorConfig !== 'undefined') return rgCalculatorConfig;
  return {
    restUrl: '/wp-json/royal-glass/v1',
    nonce: '',
    googleMapsKey: '',
    turnstileSiteKey: '',
  };
}
