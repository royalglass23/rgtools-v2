'use server'

import { auth } from '@/lib/auth'
import { userCanAccessSlug } from '@/lib/access-db'
import {
  submitLeadIntakeForUser,
  type LeadIntakeInput,
  type LeadIntakeResult,
} from '@/modules/lead-intake/actions'

export async function submitQuickCaptureLead(formData: FormData): Promise<LeadIntakeResult> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Forbidden' }

  const allowed = await userCanAccessSlug(session.user.id, 'lead-intake')
  if (!allowed) return { error: 'Forbidden' }

  return submitLeadIntakeForUser(formDataToInput(formData), session.user.id)
}

function formDataToInput(formData: FormData): LeadIntakeInput {
  const phone = stringValue(formData, 'phone')
  const email = stringValue(formData, 'email')

  return {
    clientName: stringValue(formData, 'clientName'),
    phone,
    email,
    clientProfileKey: '',
    projectType: '',
    location: stringValue(formData, 'location'),
    buildingStage: stringValue(formData, 'buildingStage'),
    jobDescription: stringValue(formData, 'jobDescription'),
    source: phone ? 'phone' : email ? 'email' : 'phone',
  }
}

function stringValue(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}
