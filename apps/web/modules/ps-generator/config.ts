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
