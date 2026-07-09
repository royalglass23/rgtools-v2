import { PS_GENERATOR_OPTION_CATEGORIES } from './config'

export type PsConfigState = 'draft' | 'published' | 'archived'
export type PsDocumentKind = 'ps1' | 'ps3'
export type PsTemplateVariantKind = 'standard_ps1' | 'pool_ps1' | 'ps3' | 'other'
export type PsFieldType = 'text' | 'checkbox'
export type PsFieldSourceType =
  | 'project_value'
  | 'selected_option'
  | 'system_rule'
  | 'description_template'
  | 'date'
  | 'fixed_value'

export interface PsSeedOptionValue {
  slug: string
  label: string
  sortOrder: number
  isActive?: boolean
  archived?: boolean
}

export interface PsSeedOptionCategory {
  slug: typeof PS_GENERATOR_OPTION_CATEGORIES[number]
  label: string
  sortOrder: number
  isActive?: boolean
  values: PsSeedOptionValue[]
}

export interface PsSeedSystem {
  slug: string
  displayName: string
  state: PsConfigState
  sortOrder: number
  heightRules: Record<string, unknown>
  metadata: Record<string, unknown>
  allowedOptions: Record<string, string[]>
}

export interface PsSeedTemplateVariant {
  key: string
  systemSlug: string
  documentKind: PsDocumentKind
  variantKind: PsTemplateVariantKind
  label: string
  r2ObjectKey: string
  originalFilename: string
  state: PsConfigState
  fieldDiscovery: Record<string, unknown>
}

export interface PsSeedFieldMapping {
  templateKey: string
  fieldName: string
  fieldType: PsFieldType
  sourceType: PsFieldSourceType
  sourceKey?: string
  fixedValue?: string
  checkboxValue?: boolean
  sortOrder: number
}

export interface PsSeedDescriptionTemplate {
  slug: string
  label: string
  pattern: string
  state: PsConfigState
}

export interface PsGeneratorSeed {
  version: {
    versionLabel: string
    state: PsConfigState
    metadata: Record<string, unknown>
  }
  optionCategories: PsSeedOptionCategory[]
  systems: PsSeedSystem[]
  templateVariants: PsSeedTemplateVariant[]
  fieldMappings: PsSeedFieldMapping[]
  descriptionTemplates: PsSeedDescriptionTemplate[]
}

export const PS_GENERATOR_LEGACY_PS1_FIELD_MAPPINGS = [
  { fieldName: 'Name', fieldType: 'text', sourceType: 'project_value', sourceKey: 'clientName' },
  { fieldName: 'Address', fieldType: 'text', sourceType: 'project_value', sourceKey: 'jobAddress' },
  { fieldName: 'Description', fieldType: 'text', sourceType: 'description_template', sourceKey: 'standard-balustrade' },
  { fieldName: 'Date0', fieldType: 'text', sourceType: 'date', sourceKey: 'today' },
  { fieldName: 'Thickness', fieldType: 'text', sourceType: 'selected_option', sourceKey: 'thickness' },
  { fieldName: 'Height', fieldType: 'text', sourceType: 'system_rule', sourceKey: 'heightRules.default.height' },
  { fieldName: 'HeightAboveFix', fieldType: 'text', sourceType: 'system_rule', sourceKey: 'heightRules.default.heightAboveFix' },
  { fieldName: 'TimberTB', fieldType: 'checkbox', sourceType: 'selected_option', sourceKey: 'structure_material.timber' },
  { fieldName: 'ConcreteTB', fieldType: 'checkbox', sourceType: 'selected_option', sourceKey: 'structure_material.concrete' },
  { fieldName: 'SteelTB', fieldType: 'checkbox', sourceType: 'selected_option', sourceKey: 'structure_material.steel' },
  { fieldName: 'InternalTB', fieldType: 'checkbox', sourceType: 'selected_option', sourceKey: 'location.internal' },
  { fieldName: 'ExternalTB', fieldType: 'checkbox', sourceType: 'selected_option', sourceKey: 'location.external' },
  { fieldName: 'NewTB', fieldType: 'checkbox', sourceType: 'selected_option', sourceKey: 'structure_built.new' },
  { fieldName: 'ExistingTB', fieldType: 'checkbox', sourceType: 'selected_option', sourceKey: 'structure_built.existing' },
  { fieldName: 'ToughenedTB', fieldType: 'checkbox', sourceType: 'selected_option', sourceKey: 'glass_type.toughened' },
  { fieldName: 'LaminatedTB', fieldType: 'checkbox', sourceType: 'selected_option', sourceKey: 'glass_type.laminated' },
  { fieldName: 'Direct', fieldType: 'checkbox', sourceType: 'fixed_value', fixedValue: 'true', checkboxValue: true },
  { fieldName: 'Cont', fieldType: 'checkbox', sourceType: 'fixed_value', fixedValue: 'true', checkboxValue: true },
] satisfies Array<Omit<PsSeedFieldMapping, 'templateKey' | 'sortOrder'>>

export function legacyPs1FieldMappingsForDiscovery(fieldDiscovery: unknown) {
  const fields = discoveredFieldNames(fieldDiscovery)
  if (!fields.has('Name') || !fields.has('Address') || !fields.has('Description')) return []

  return PS_GENERATOR_LEGACY_PS1_FIELD_MAPPINGS
    .filter((mapping) => fields.has(mapping.fieldName))
    .map((mapping, index) => ({
      ...mapping,
      sortOrder: (index + 1) * 10,
    }))
}

export const PS_GENERATOR_SEED_VERSION = {
  versionLabel: 'wordpress-plugin-v1',
  state: 'published' as const,
  metadata: {
    source: 'current-wordpress-plugin',
    sourceCoverage: 'Repo contains MT-90/MT-93 defaults and categories, but not the private plugin export.',
  },
}

function discoveredFieldNames(fieldDiscovery: unknown) {
  if (!fieldDiscovery || typeof fieldDiscovery !== 'object') return new Set<string>()
  const discovery = fieldDiscovery as { text?: unknown; checkbox?: unknown; fields?: unknown }
  const names = [
    ...(Array.isArray(discovery.text) ? discovery.text : []),
    ...(Array.isArray(discovery.checkbox) ? discovery.checkbox : []),
    ...(Array.isArray(discovery.fields) ? discovery.fields : []),
  ]
  return new Set(names.filter((name): name is string => typeof name === 'string'))
}

export const PS_GENERATOR_WORDPRESS_SEED: PsGeneratorSeed = {
  version: PS_GENERATOR_SEED_VERSION,
  optionCategories: [
    {
      slug: 'system',
      label: 'System',
      sortOrder: 10,
      values: [
        { slug: 'double-disc', label: 'Double Disc', sortOrder: 10 },
        { slug: 'frameless-spigot', label: 'Frameless Spigot', sortOrder: 20 },
        { slug: 'legacy-face-fixed', label: 'Legacy Face Fixed', sortOrder: 90, isActive: false, archived: true },
      ],
    },
    {
      slug: 'structure_material',
      label: 'Structure material',
      sortOrder: 20,
      values: [
        { slug: 'timber', label: 'Timber', sortOrder: 10 },
        { slug: 'concrete', label: 'Concrete', sortOrder: 20 },
        { slug: 'steel', label: 'Steel', sortOrder: 30 },
        { slug: 'aluminium', label: 'Aluminium', sortOrder: 90, isActive: false, archived: true },
      ],
    },
    {
      slug: 'structure_type',
      label: 'Structure type',
      sortOrder: 30,
      values: [
        { slug: 'deck', label: 'Deck', sortOrder: 10 },
        { slug: 'balcony', label: 'Balcony', sortOrder: 20 },
        { slug: 'stair', label: 'Stair', sortOrder: 30 },
        { slug: 'pool-fence', label: 'Pool fence', sortOrder: 40 },
      ],
    },
    {
      slug: 'location',
      label: 'Location',
      sortOrder: 40,
      values: [
        { slug: 'external', label: 'External', sortOrder: 10 },
        { slug: 'internal', label: 'Internal', sortOrder: 20 },
      ],
    },
    {
      slug: 'structure_built',
      label: 'Structure built',
      sortOrder: 50,
      values: [
        { slug: 'new', label: 'New', sortOrder: 10 },
        { slug: 'existing', label: 'Existing', sortOrder: 20 },
      ],
    },
    {
      slug: 'glass_type',
      label: 'Glass type',
      sortOrder: 60,
      values: [
        { slug: 'toughened', label: 'Toughened', sortOrder: 10 },
        { slug: 'laminated', label: 'Laminated', sortOrder: 20 },
      ],
    },
    {
      slug: 'thickness',
      label: 'Thickness',
      sortOrder: 70,
      values: [
        { slug: '12mm', label: '12mm', sortOrder: 10 },
        { slug: '15mm', label: '15mm', sortOrder: 20 },
        { slug: '17-52mm', label: '17.52mm', sortOrder: 30 },
      ],
    },
    {
      slug: 'gate_required',
      label: 'Gate required',
      sortOrder: 80,
      values: [
        { slug: 'no', label: 'No', sortOrder: 10 },
        { slug: 'yes', label: 'Yes', sortOrder: 20 },
      ],
    },
  ],
  systems: [
    {
      slug: 'double-disc',
      displayName: 'Double Disc',
      state: 'published',
      sortOrder: 10,
      heightRules: {
        default: { height: '1.00', heightAboveFix: '1.05' },
        pool: { height: '1.20', heightAboveFix: '1.25' },
      },
      metadata: { default: true, seededVisibility: 'active-published' },
      allowedOptions: {
        system: ['double-disc'],
        structure_material: ['timber', 'concrete', 'steel'],
        structure_type: ['deck', 'balcony', 'stair', 'pool-fence'],
        location: ['external', 'internal'],
        structure_built: ['new', 'existing'],
        glass_type: ['toughened', 'laminated'],
        thickness: ['12mm', '15mm', '17-52mm'],
        gate_required: ['no', 'yes'],
      },
    },
    {
      slug: 'frameless-spigot',
      displayName: 'Frameless Spigot',
      state: 'published',
      sortOrder: 20,
      heightRules: {
        default: { height: '1.00', heightAboveFix: '1.00' },
        pool: { height: '1.20', heightAboveFix: '1.20' },
      },
      metadata: { seededVisibility: 'active-published' },
      allowedOptions: {
        system: ['frameless-spigot'],
        structure_material: ['timber', 'concrete', 'steel'],
        structure_type: ['deck', 'balcony', 'pool-fence'],
        location: ['external'],
        structure_built: ['new', 'existing'],
        glass_type: ['toughened', 'laminated'],
        thickness: ['12mm'],
        gate_required: ['no', 'yes'],
      },
    },
    {
      slug: 'legacy-face-fixed',
      displayName: 'Legacy Face Fixed',
      state: 'archived',
      sortOrder: 90,
      heightRules: {},
      metadata: { seededVisibility: 'archived' },
      allowedOptions: { system: ['legacy-face-fixed'] },
    },
  ],
  templateVariants: [
    {
      key: 'double-disc-standard-ps1',
      systemSlug: 'double-disc',
      documentKind: 'ps1',
      variantKind: 'standard_ps1',
      label: 'Double Disc PS1',
      r2ObjectKey: 'templates/ps-generator/wordpress/double-disc/ps1-standard.pdf',
      originalFilename: 'Double Disc PS1.pdf',
      state: 'published',
      fieldDiscovery: {
        text: ['Name', 'Address', 'Description', 'Height', 'Thickness', 'HeightAboveFix', 'Date0'],
        checkbox: ['TimberTB', 'ConcreteTB', 'SteelTB', 'InternalTB', 'ExternalTB', 'NewTB', 'ExistingTB', 'ToughenedTB', 'LaminatedTB', 'Direct', 'Cont'],
      },
    },
    {
      key: 'double-disc-ps3',
      systemSlug: 'double-disc',
      documentKind: 'ps3',
      variantKind: 'ps3',
      label: 'Double Disc PS3',
      r2ObjectKey: 'templates/ps-generator/wordpress/double-disc/ps3.pdf',
      originalFilename: 'Double Disc PS3.pdf',
      state: 'published',
      fieldDiscovery: { fields: ['client_name', 'job_address', 'bc_number', 'description', 'completion_date'] },
    },
    {
      key: 'frameless-spigot-pool-ps1',
      systemSlug: 'frameless-spigot',
      documentKind: 'ps1',
      variantKind: 'pool_ps1',
      label: 'Frameless Spigot Pool PS1',
      r2ObjectKey: 'templates/ps-generator/wordpress/frameless-spigot/ps1-pool.pdf',
      originalFilename: 'Frameless Spigot Pool PS1.pdf',
      state: 'published',
      fieldDiscovery: { fields: ['client_name', 'job_address', 'pool_description'] },
    },
  ],
  fieldMappings: [
    ...PS_GENERATOR_LEGACY_PS1_FIELD_MAPPINGS.map((mapping, index) => ({
      templateKey: 'double-disc-standard-ps1',
      ...mapping,
      sortOrder: (index + 1) * 10,
    })),
    { templateKey: 'double-disc-ps3', fieldName: 'completion_date', fieldType: 'text', sourceType: 'date', sourceKey: 'today', sortOrder: 10 },
    { templateKey: 'double-disc-ps3', fieldName: 'description', fieldType: 'text', sourceType: 'description_template', sourceKey: 'standard-balustrade', sortOrder: 20 },
  ],
  descriptionTemplates: [
    {
      slug: 'standard-balustrade',
      label: 'Standard balustrade wording',
      pattern: '{system} glass balustrade to {structure_type}, {location}, fixed to {structure_material}; {glass_type} glass at {thickness}.',
      state: 'published',
    },
    {
      slug: 'gate-balustrade',
      label: 'Gate wording',
      pattern: '{system} glass balustrade with gate to {structure_type}, {location}, fixed to {structure_material}; {glass_type} glass at {thickness}.',
      state: 'published',
    },
  ],
}
