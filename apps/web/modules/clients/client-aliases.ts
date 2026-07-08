import { clientAliases, type clientAliasSourceEnum } from '@rgtools/db/schema-leads'
import { db } from '@/lib/db'

export type ClientAliasSource = typeof clientAliasSourceEnum.enumValues[number]

export function collectClientAliases(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const aliases: string[] = []

  for (const value of values) {
    const alias = value?.trim()
    if (!alias) continue
    const key = alias.toLowerCase().replace(/\s+/g, ' ')
    if (seen.has(key)) continue
    seen.add(key)
    aliases.push(alias)
  }

  return aliases
}

export async function addClientAliases(
  clientId: string,
  aliases: string[],
  source: ClientAliasSource,
): Promise<void> {
  const values = collectClientAliases(aliases).map((alias) => ({ clientId, alias, source }))
  if (values.length === 0) return

  await db
    .insert(clientAliases)
    .values(values)
    .onConflictDoNothing()
}
