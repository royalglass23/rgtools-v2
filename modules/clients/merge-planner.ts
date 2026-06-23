export type ClientMergePlanRow = {
  id: string
  name: string
  companyName: string | null
  email: string | null
  phoneNormalized: string | null
  servicem8CompanyUuid: string | null
  resolvedServiceM8CompanyUuid: string | null
  createdAt: Date
}

export type AutoMergeGroup = {
  key: string
  reason: 'same_servicem8_company_uuid'
  survivorId: string
  loserIds: string[]
  rows: ClientMergePlanRow[]
}

export type ReviewGroup = {
  key: string
  reason: 'same_name' | 'same_contact'
  rows: ClientMergePlanRow[]
}

export type MergePlan = {
  autoMergeGroups: AutoMergeGroup[]
  reviewGroups: ReviewGroup[]
}

export function planClientMerges(rows: ClientMergePlanRow[]): MergePlan {
  const autoMergeGroups = groupBy(
    rows.filter((row) => row.resolvedServiceM8CompanyUuid),
    (row) => row.resolvedServiceM8CompanyUuid!,
  )
    .filter((group) => group.rows.length > 1)
    .map((group) => {
      const survivor = chooseSurvivor(group.rows)
      return {
        key: `servicem8:${group.key}`,
        reason: 'same_servicem8_company_uuid' as const,
        survivorId: survivor.id,
        loserIds: group.rows.filter((row) => row.id !== survivor.id).map((row) => row.id),
        rows: group.rows,
      }
    })
  const autoMergedIds = new Set(autoMergeGroups.flatMap((group) => group.rows.map((row) => row.id)))
  const reviewCandidates = rows.filter((row) => !autoMergedIds.has(row.id))
  const reviewedIds = new Set<string>()
  const reviewGroups: ReviewGroup[] = []

  for (const group of groupBy(
    reviewCandidates.filter((row) => row.phoneNormalized),
    (row) => row.phoneNormalized!,
  )) {
    if (group.rows.length < 2) continue
    reviewGroups.push({ key: `contact:${group.key}`, reason: 'same_contact', rows: group.rows })
    for (const row of group.rows) reviewedIds.add(row.id)
  }

  for (const group of groupBy(
    reviewCandidates.filter((row) => normalizedName(row)),
    (row) => normalizedName(row),
  )) {
    const groupRows = group.rows.filter((row) => !reviewedIds.has(row.id))
    if (groupRows.length < 2) continue
    reviewGroups.push({ key: `name:${group.key}`, reason: 'same_name', rows: groupRows })
  }

  return {
    autoMergeGroups,
    reviewGroups,
  }
}

function normalizedName(row: ClientMergePlanRow): string {
  return (row.companyName || row.name).trim().toLowerCase().replace(/\s+/g, ' ')
}

function chooseSurvivor(rows: ClientMergePlanRow[]): ClientMergePlanRow {
  return [...rows].sort((left, right) => {
    const linkedDelta = Number(Boolean(right.servicem8CompanyUuid)) - Number(Boolean(left.servicem8CompanyUuid))
    if (linkedDelta !== 0) return linkedDelta
    return left.createdAt.getTime() - right.createdAt.getTime()
  })[0]
}

function groupBy<T>(rows: T[], keyFor: (row: T) => string): Array<{ key: string; rows: T[] }> {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const key = keyFor(row)
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  return [...groups.entries()].map(([key, groupRows]) => ({ key, rows: groupRows }))
}
