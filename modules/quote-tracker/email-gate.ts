export type EmailGateSettingsInput = {
  enabled: boolean
  recipientEmails: string | null
}

export type EmailGateSettingsResult =
  | {
      ok: true
      value: {
        enabled: boolean
        recipientEmails: string[]
      }
    }
  | { ok: false; message: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

export function parseRecipientEmails(value: string | null | undefined): string[] {
  const recipients = new Set<string>()

  for (const part of (value ?? '').split(/[;,\n]/)) {
    const email = normalizeEmail(part)
    if (email) recipients.add(email)
  }

  return Array.from(recipients)
}

export function emailsMatch(viewerEmail: string, recipientEmail: string): boolean {
  return normalizeEmail(viewerEmail) === normalizeEmail(recipientEmail)
}

export function validateEmailGateSettings(input: EmailGateSettingsInput): EmailGateSettingsResult {
  if (!input.enabled) {
    return {
      ok: true,
      value: {
        enabled: false,
        recipientEmails: [],
      },
    }
  }

  const recipientEmails = parseRecipientEmails(input.recipientEmails)
  if (recipientEmails.length === 0) {
    return { ok: false, message: 'At least one recipient email is required when the email gate is enabled.' }
  }

  if (recipientEmails.some((email) => email.length > 254 || !EMAIL_RE.test(email))) {
    return { ok: false, message: 'Enter valid recipient email addresses.' }
  }

  return {
    ok: true,
    value: {
      enabled: true,
      recipientEmails,
    },
  }
}
