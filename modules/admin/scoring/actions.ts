'use server'

import { desc, eq, isNotNull, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditLog } from '@/drizzle/schema'
import { leadCategoryScores, scoringConfigVersions } from '@/drizzle/schema-leads'
import type { ScoringConfig } from '@/modules/lead-intake/scoring/score-lead'
import {
  buildRemovedOptionWarnings,
  nextScoringVersionLabel,
  validateScoringConfigDraft,
} from './config-admin'

export type SaveScoringConfigResult =
  | { success: true; versionLabel: string; warnings: string[] }
  | { error: string; warnings?: string[] }

export async function saveScoringConfigVersion(formData: FormData): Promise<SaveScoringConfigResult> {
  const session = await auth()
  if (session?.user?.role !== 'admin' || !session.user.id) {
    return { error: 'Forbidden' }
  }

  const rawConfig = formData.get('config')
  const activationNote = noteFromFormData(formData)
  if (!activationNote) {
    return { error: 'Activation note is required.' }
  }

  if (typeof rawConfig !== 'string') {
    return { error: 'Missing scoring config payload.' }
  }

  let nextConfig: ScoringConfig
  try {
    nextConfig = JSON.parse(rawConfig) as ScoringConfig
  } catch {
    return { error: 'Scoring config payload is not valid JSON.' }
  }

  const errors = validateScoringConfigDraft(nextConfig)
  if (errors.length > 0) {
    return { error: errors.join(' '), warnings: [] }
  }

  const [activeConfig] = await db
    .select({
      id: scoringConfigVersions.id,
      versionLabel: scoringConfigVersions.versionLabel,
      config: scoringConfigVersions.config,
    })
    .from(scoringConfigVersions)
    .where(eq(scoringConfigVersions.isActive, true))
    .limit(1)

  if (!activeConfig) {
    return { error: 'No active scoring config version found.' }
  }

  const [versionRows, scoredOptionRows] = await Promise.all([
    db.select({ versionLabel: scoringConfigVersions.versionLabel }).from(scoringConfigVersions),
    db
      .select({ answerKey: leadCategoryScores.answerKey })
      .from(leadCategoryScores)
      .where(isNotNull(leadCategoryScores.answerKey)),
  ])

  const warnings = buildRemovedOptionWarnings(
    activeConfig.config as ScoringConfig,
    nextConfig,
    new Set(scoredOptionRows.map((row) => row.answerKey).filter((key): key is string => Boolean(key))),
  )
  const existingLabels = versionRows.map((row) => row.versionLabel)
  const versionLabel = nextScoringVersionLabel(activeConfig.versionLabel, new Date(), existingLabels)

  if (existingLabels.includes(versionLabel)) {
    return { error: `Version label "${versionLabel}" already exists.`, warnings }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(scoringConfigVersions)
      .set({ isActive: false })
      .where(eq(scoringConfigVersions.isActive, true))

    const [createdVersion] = await tx
      .insert(scoringConfigVersions)
      .values({
        versionLabel,
        isActive: true,
        config: nextConfig,
        createdBy: session.user.id as string,
      })
      .returning({
        id: scoringConfigVersions.id,
      })

    await tx.insert(auditLog).values({
      actorId: session.user.id as string,
      action: 'scoring_config.activated',
      targetId: createdVersion.id,
      detail: {
        previousVersionId: activeConfig.id,
        previousVersionLabel: activeConfig.versionLabel,
        versionLabel,
        note: activationNote,
        warnings,
      },
    })
  })

  revalidatePath('/admin/lead-scoring')
  return { success: true, versionLabel, warnings }
}

export async function activateScoringConfigVersion(formData: FormData): Promise<SaveScoringConfigResult> {
  const session = await auth()
  if (session?.user?.role !== 'admin' || !session.user.id) {
    return { error: 'Forbidden' }
  }

  const versionId = formData.get('versionId')
  const activationNote = noteFromFormData(formData)
  if (!activationNote) {
    return { error: 'Activation note is required.' }
  }

  if (typeof versionId !== 'string' || !versionId) {
    return { error: 'Missing version id.' }
  }

  const [activeConfig] = await db
    .select({
      id: scoringConfigVersions.id,
      versionLabel: scoringConfigVersions.versionLabel,
    })
    .from(scoringConfigVersions)
    .where(eq(scoringConfigVersions.isActive, true))
    .limit(1)

  const [targetVersion] = await db
    .select({
      id: scoringConfigVersions.id,
      versionLabel: scoringConfigVersions.versionLabel,
      isActive: scoringConfigVersions.isActive,
    })
    .from(scoringConfigVersions)
    .where(eq(scoringConfigVersions.id, versionId))
    .limit(1)

  if (!targetVersion) {
    return { error: 'Scoring config version not found.' }
  }

  if (targetVersion.isActive) {
    return { success: true, versionLabel: targetVersion.versionLabel, warnings: [] }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(scoringConfigVersions)
      .set({ isActive: false })
      .where(eq(scoringConfigVersions.isActive, true))

    await tx
      .update(scoringConfigVersions)
      .set({ isActive: true })
      .where(eq(scoringConfigVersions.id, targetVersion.id))

    await tx.insert(auditLog).values({
      actorId: session.user.id as string,
      action: 'scoring_config.activated',
      targetId: targetVersion.id,
      detail: {
        previousVersionId: activeConfig?.id ?? null,
        previousVersionLabel: activeConfig?.versionLabel ?? null,
        versionLabel: targetVersion.versionLabel,
        note: activationNote,
        rollback: true,
      },
    })
  })

  revalidatePath('/admin/lead-scoring')
  return { success: true, versionLabel: targetVersion.versionLabel, warnings: [] }
}

export async function deleteScoringConfigVersion(formData: FormData): Promise<SaveScoringConfigResult> {
  const session = await auth()
  if (session?.user?.role !== 'admin' || !session.user.id) {
    return { error: 'Forbidden' }
  }

  const versionId = formData.get('versionId')
  const deleteNote = noteFromFormData(formData, 'deleteNote')
  if (!deleteNote) {
    return { error: 'Delete remarks are required.' }
  }

  if (typeof versionId !== 'string' || !versionId) {
    return { error: 'Missing version id.' }
  }

  const [targetVersion] = await db
    .select({
      id: scoringConfigVersions.id,
      versionLabel: scoringConfigVersions.versionLabel,
      isActive: scoringConfigVersions.isActive,
    })
    .from(scoringConfigVersions)
    .where(eq(scoringConfigVersions.id, versionId))
    .limit(1)

  if (!targetVersion) {
    return { error: 'Scoring config version not found.' }
  }

  if (targetVersion.isActive) {
    return { error: 'Cannot delete the active scoring config version.' }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(scoringConfigVersions)
      .set({ archivedAt: new Date() })
      .where(eq(scoringConfigVersions.id, targetVersion.id))

    await tx.insert(auditLog).values({
      actorId: session.user.id as string,
      action: 'scoring_config.deleted',
      targetId: targetVersion.id,
      detail: {
        versionLabel: targetVersion.versionLabel,
        note: deleteNote,
      },
    })
  })

  revalidatePath('/admin/lead-scoring')
  return { success: true, versionLabel: targetVersion.versionLabel, warnings: [] }
}

export async function getScoringVersionRows() {
  return db
    .select({
      id: scoringConfigVersions.id,
      versionLabel: scoringConfigVersions.versionLabel,
      isActive: scoringConfigVersions.isActive,
      config: scoringConfigVersions.config,
      createdBy: scoringConfigVersions.createdBy,
      createdAt: scoringConfigVersions.createdAt,
    })
    .from(scoringConfigVersions)
    .where(isNull(scoringConfigVersions.archivedAt))
    .orderBy(desc(scoringConfigVersions.createdAt))
}

function noteFromFormData(formData: FormData, fieldName = 'activationNote') {
  const rawNote = formData.get(fieldName)
  return typeof rawNote === 'string' ? rawNote.trim() : ''
}
