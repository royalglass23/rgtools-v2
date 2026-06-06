import { eq } from 'drizzle-orm'
import { scoringConfigVersions } from '@/drizzle/schema-leads'
import { db } from '@/lib/db'
import type { ScoringConfig } from './score-lead'

export type ActiveScoringConfigRow = {
  id: string
  config: ScoringConfig
}

export type FormOption = {
  key: string
  label: string
}

export type ScoringCategoryOptions = {
  label: string
  options: FormOption[]
}

export type ActiveScoringOptionLists = {
  configVersionId: string
  categories: Record<string, ScoringCategoryOptions>
  config: ScoringConfig
}

export async function getActiveScoringOptionLists(): Promise<ActiveScoringOptionLists> {
  const [activeConfig] = await db
    .select({
      id: scoringConfigVersions.id,
      config: scoringConfigVersions.config,
    })
    .from(scoringConfigVersions)
    .where(eq(scoringConfigVersions.isActive, true))
    .limit(1)

  if (!activeConfig) {
    throw new Error('No active scoring config version found')
  }

  return scoringConfigToOptionLists({
    id: activeConfig.id,
    config: activeConfig.config as ScoringConfig,
  })
}

export function scoringConfigToOptionLists(
  activeConfig: ActiveScoringConfigRow,
): ActiveScoringOptionLists {
  return {
    configVersionId: activeConfig.id,
    config: activeConfig.config,
    categories: Object.fromEntries(
      Object.entries(activeConfig.config.categories).map(([categoryKey, category]) => [
        categoryKey,
        {
          label: category.label,
          options: Object.keys(category.options).map((optionKey) => ({
            key: optionKey,
            label: formatOptionLabel(optionKey),
          })),
        },
      ]),
    ),
  }
}

function formatOptionLabel(optionKey: string): string {
  return optionKey.replaceAll('_', ' ')
}
