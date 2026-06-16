import { describe, expect, it } from 'vitest'

import { emailsMatch, normalizeEmail, parseRecipientEmails, validateEmailGateSettings } from '../email-gate'

describe('quote email gate settings', () => {
  it('normalizes recipient emails before saving or comparing', () => {
    expect(normalizeEmail('  CLIENT@Example.CO.NZ  ')).toBe('client@example.co.nz')
  })

  it('parses comma, semicolon, and newline separated recipients', () => {
    expect(parseRecipientEmails(' Client@Example.co.nz, manager@example.co.nz; accounts@example.co.nz\nclient@example.co.nz ')).toEqual([
      'client@example.co.nz',
      'manager@example.co.nz',
      'accounts@example.co.nz',
    ])
  })

  it('requires a valid recipient email when the gate is enabled', () => {
    expect(validateEmailGateSettings({
      enabled: true,
      recipientEmails: '',
    })).toEqual({
      ok: false,
      message: 'At least one recipient email is required when the email gate is enabled.',
    })

    expect(validateEmailGateSettings({
      enabled: true,
      recipientEmails: 'client@example.co.nz; not-an-email',
    })).toEqual({
      ok: false,
      message: 'Enter valid recipient email addresses.',
    })
  })

  it('clears recipient fields when the gate is disabled', () => {
    expect(validateEmailGateSettings({
      enabled: false,
      recipientEmails: 'client@example.co.nz',
    })).toEqual({
      ok: true,
      value: {
        enabled: false,
        recipientEmails: [],
      },
    })
  })

  it('returns normalized unique recipients when the gate is enabled', () => {
    expect(validateEmailGateSettings({
      enabled: true,
      recipientEmails: 'CLIENT@example.co.nz; manager@example.co.nz, client@example.co.nz',
    })).toEqual({
      ok: true,
      value: {
        enabled: true,
        recipientEmails: ['client@example.co.nz', 'manager@example.co.nz'],
      },
    })
  })

  it('accepts matching viewer emails case-insensitively', () => {
    expect(emailsMatch(' Client@Example.co.nz ', 'client@example.co.nz')).toBe(true)
    expect(emailsMatch('other@example.co.nz', 'client@example.co.nz')).toBe(false)
  })
})
