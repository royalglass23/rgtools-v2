export const PS_GENERATOR_DEFAULTS = {
  system: 'double-disc',
  structureMaterial: 'timber',
  structureType: 'deck',
  location: 'external',
  structureBuilt: 'new',
  glassType: 'toughened',
  thickness: '12mm',
  gateRequired: 'no',
} as const

export const PS_GENERATOR_OPTION_CATEGORIES = [
  'system',
  'structure_material',
  'structure_type',
  'location',
  'structure_built',
  'glass_type',
  'thickness',
  'gate_required',
] as const

export type PsGeneratorOptionCategory = (typeof PS_GENERATOR_OPTION_CATEGORIES)[number]

export const PS_GENERATOR_COMPATIBILITY_OPTIONS: Partial<Record<PsGeneratorOptionCategory, Array<{ slug: string; label: string }>>> = {
  structure_type: [
    { slug: 'deck', label: 'Deck' },
    { slug: 'balcony', label: 'Balcony' },
    { slug: 'pool', label: 'Pool Area' },
    { slug: 'stair', label: 'Stair Area' },
    { slug: 'landing', label: 'Landing' },
    { slug: 'stair-and-landing', label: 'Stair and Landing' },
    { slug: 'stair-and-balcony', label: 'Stair and Balcony Area' },
  ],
  location: [
    { slug: 'external', label: 'External' },
    { slug: 'internal', label: 'Internal' },
    { slug: 'both', label: 'External and Internal' },
  ],
}
