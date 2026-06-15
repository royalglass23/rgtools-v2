'use server'

import { desc, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditLog } from '@/drizzle/schema'
import { pricingConfigVersions } from '@/drizzle/schema-leads'
import {
  nextPricingVersionLabel,
  validatePricingConfigDraft,
  type PricingConfig,
} from './config-admin'

export type SavePricingConfigResult =
  | { success: true; versionLabel: string }
  | { error: string }

export async function savePricingConfigVersion(formData: FormData): Promise<SavePricingConfigResult> {
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
    return { error: 'Missing pricing config payload.' }
  }

  let nextConfig: PricingConfig
  try {
    nextConfig = JSON.parse(rawConfig) as PricingConfig
  } catch {
    return { error: 'Pricing config payload is not valid JSON.' }
  }

  const errors = validatePricingConfigDraft(nextConfig)
  if (errors.length > 0) {
    return { error: errors.join(' ') }
  }

  const [activeConfig] = await db
    .select({
      id: pricingConfigVersions.id,
      versionLabel: pricingConfigVersions.versionLabel,
    })
    .from(pricingConfigVersions)
    .where(eq(pricingConfigVersions.isActive, true))
    .limit(1)

  if (!activeConfig) {
    return { error: 'No active pricing config version found.' }
  }

  const versionRows = await db
    .select({ versionLabel: pricingConfigVersions.versionLabel })
    .from(pricingConfigVersions)

  const existingLabels = versionRows.map((row) => row.versionLabel)
  const versionLabel = nextPricingVersionLabel(activeConfig.versionLabel, new Date(), existingLabels)

  await db.transaction(async (tx) => {
    await tx
      .update(pricingConfigVersions)
      .set({ isActive: false })
      .where(eq(pricingConfigVersions.isActive, true))

    const [createdVersion] = await tx
      .insert(pricingConfigVersions)
      .values({
        versionLabel,
        isActive: true,
        config: nextConfig,
        createdBy: session.user.id as string,
      })
      .returning({ id: pricingConfigVersions.id })

    await tx.insert(auditLog).values({
      actorId: session.user.id as string,
      action: 'pricing_config.activated',
      targetId: createdVersion.id,
      detail: {
        previousVersionId: activeConfig.id,
        previousVersionLabel: activeConfig.versionLabel,
        versionLabel,
        note: activationNote,
      },
    })
  })

  revalidatePath('/admin/calculator-pricing')
  revalidatePath('/api/pricing')
  return { success: true, versionLabel }
}

export async function activatePricingConfigVersion(formData: FormData): Promise<SavePricingConfigResult> {
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
      id: pricingConfigVersions.id,
      versionLabel: pricingConfigVersions.versionLabel,
    })
    .from(pricingConfigVersions)
    .where(eq(pricingConfigVersions.isActive, true))
    .limit(1)

  const [targetVersion] = await db
    .select({
      id: pricingConfigVersions.id,
      versionLabel: pricingConfigVersions.versionLabel,
      isActive: pricingConfigVersions.isActive,
    })
    .from(pricingConfigVersions)
    .where(eq(pricingConfigVersions.id, versionId))
    .limit(1)

  if (!targetVersion) {
    return { error: 'Pricing config version not found.' }
  }

  if (targetVersion.isActive) {
    return { success: true, versionLabel: targetVersion.versionLabel }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(pricingConfigVersions)
      .set({ isActive: false })
      .where(eq(pricingConfigVersions.isActive, true))

    await tx
      .update(pricingConfigVersions)
      .set({ isActive: true })
      .where(eq(pricingConfigVersions.id, targetVersion.id))

    await tx.insert(auditLog).values({
      actorId: session.user.id as string,
      action: 'pricing_config.activated',
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

  revalidatePath('/admin/calculator-pricing')
  revalidatePath('/api/pricing')
  return { success: true, versionLabel: targetVersion.versionLabel }
}

export async function deletePricingConfigVersion(formData: FormData): Promise<SavePricingConfigResult> {
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
      id: pricingConfigVersions.id,
      versionLabel: pricingConfigVersions.versionLabel,
      isActive: pricingConfigVersions.isActive,
    })
    .from(pricingConfigVersions)
    .where(eq(pricingConfigVersions.id, versionId))
    .limit(1)

  if (!targetVersion) {
    return { error: 'Pricing config version not found.' }
  }

  if (targetVersion.isActive) {
    return { error: 'Cannot delete the active pricing config version.' }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(pricingConfigVersions)
      .set({ archivedAt: new Date() })
      .where(eq(pricingConfigVersions.id, targetVersion.id))

    await tx.insert(auditLog).values({
      actorId: session.user.id as string,
      action: 'pricing_config.deleted',
      targetId: targetVersion.id,
      detail: {
        versionLabel: targetVersion.versionLabel,
        note: deleteNote,
      },
    })
  })

  revalidatePath('/admin/calculator-pricing')
  return { success: true, versionLabel: targetVersion.versionLabel }
}

export async function getPricingVersionRows() {
  return db
    .select({
      id: pricingConfigVersions.id,
      versionLabel: pricingConfigVersions.versionLabel,
      isActive: pricingConfigVersions.isActive,
      config: pricingConfigVersions.config,
      createdBy: pricingConfigVersions.createdBy,
      createdAt: pricingConfigVersions.createdAt,
    })
    .from(pricingConfigVersions)
    .where(isNull(pricingConfigVersions.archivedAt))
    .orderBy(desc(pricingConfigVersions.createdAt))
}

function noteFromFormData(formData: FormData, fieldName = 'activationNote') {
  const rawNote = formData.get(fieldName)
  return typeof rawNote === 'string' ? rawNote.trim() : ''
}
