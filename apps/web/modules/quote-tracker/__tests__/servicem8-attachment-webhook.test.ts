import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  handleServiceM8AttachmentWebhook,
  type ServiceM8AttachmentWebhookDeps,
} from '../servicem8-attachment-webhook'

const request = vi.fn<ServiceM8AttachmentWebhookDeps['request']>()
const createTrackedQuote = vi.fn<ServiceM8AttachmentWebhookDeps['createTrackedQuote']>()
const getExpirySettings = vi.fn<ServiceM8AttachmentWebhookDeps['getExpirySettings']>()
const resolveOwnerUserId = vi.fn<ServiceM8AttachmentWebhookDeps['resolveOwnerUserId']>()
const getNotificationSettings = vi.fn<ServiceM8AttachmentWebhookDeps['getNotificationSettings']>()
const sendReadyLinkEmail = vi.fn<ServiceM8AttachmentWebhookDeps['sendReadyLinkEmail']>()
const authorizedHeaders = () => new Headers({ 'x-servicem8-webhook-secret': 'secret-1' })

function deps(): ServiceM8AttachmentWebhookDeps {
  return {
    secret: 'secret-1',
    request,
    createTrackedQuote,
    getExpirySettings,
    resolveOwnerUserId,
    getNotificationSettings,
    sendReadyLinkEmail,
  }
}

describe('handleServiceM8AttachmentWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createTrackedQuote.mockResolvedValue({
      ok: true,
      quoteId: 'quote-1',
      shortCode: 'ABC12345',
      link: 'https://quotes.example/q/ABC12345',
      expiresAt: new Date('2026-06-23T00:00:00Z'),
      clientName: 'Acme Ltd',
      jobAddress: '12 Glass St',
      quoteValue: '100.00',
      storageDriver: 'memory',
    })
    getExpirySettings.mockResolvedValue({ defaultPreset: '30d' })
    resolveOwnerUserId.mockResolvedValue(null)
    getNotificationSettings.mockResolvedValue({ enabled: true, to: ['support@royalglass.co.nz'] })
    sendReadyLinkEmail.mockResolvedValue({ ok: true })
  })

  it('echoes a ServiceM8 subscribe challenge when the query token matches', async () => {
    const result = await handleServiceM8AttachmentWebhook({
      url: 'https://app.example/api/servicem8/attachment?mode=subscribe&challenge=abc',
      headers: authorizedHeaders(),
      body: {},
      deps: deps(),
    })

    expect(result).toEqual({ status: 200, body: 'abc' })
    expect(request).not.toHaveBeenCalled()
    expect(createTrackedQuote).not.toHaveBeenCalled()
  })

  it('rejects requests without the configured query token or header secret', async () => {
    const result = await handleServiceM8AttachmentWebhook({
      url: 'https://app.example/api/servicem8/attachment',
      headers: new Headers(),
      body: {},
      deps: deps(),
    })

    expect(result).toEqual({ status: 401, body: { error: 'Unauthorized' } })
    expect(request).not.toHaveBeenCalled()
  })

  it('no-ops when the refetched attachment is not a live Quote PDF', async () => {
    request.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        uuid: 'attachment-1',
        attachment_source: 'PHOTO',
        file_type: '.jpg',
        active: 1,
        related_object_uuid: 'job-1',
      }),
    })

    const result = await handleServiceM8AttachmentWebhook({
      url: 'https://app.example/api/servicem8/attachment',
      headers: authorizedHeaders(),
      body: { entry: [{ uuid: 'attachment-1', attachment_source: 'QUOTE' }] },
      deps: deps(),
    })

    expect(result).toEqual({ status: 200, body: { ok: true, minted: 0, refreshed: 0, ignored: 1 } })
    expect(request).toHaveBeenCalledWith('/attachment/attachment-1.json')
    expect(createTrackedQuote).not.toHaveBeenCalled()
  })

  it('Mints the first live Quote PDF by refetched job UUID', async () => {
    request.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        uuid: 'attachment-1',
        attachment_source: 'QUOTE',
        file_type: '.pdf',
        active: 1,
        related_object_uuid: 'job-1',
      }),
    })

    const result = await handleServiceM8AttachmentWebhook({
      url: 'https://app.example/api/servicem8/attachment',
      headers: authorizedHeaders(),
      body: { entry: [{ uuid: 'attachment-1', related_object_uuid: 'payload-job' }] },
      deps: deps(),
    })

    expect(result).toEqual({ status: 200, body: { ok: true, minted: 1, refreshed: 0, ignored: 0 } })
    expect(createTrackedQuote).toHaveBeenCalledWith({
      jobUuid: 'job-1',
      ownerUserId: null,
      expiry: '30d',
      refresh: false,
    })
  })

  it('uses the configured expiry setting when Minting a first live Quote PDF', async () => {
    request.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        uuid: 'attachment-1',
        attachment_source: 'QUOTE',
        file_type: '.pdf',
        active: 1,
        related_object_uuid: 'job-1',
      }),
    })
    getExpirySettings.mockResolvedValue({ defaultPreset: '7d' })

    await handleServiceM8AttachmentWebhook({
      url: 'https://app.example/api/servicem8/attachment',
      headers: authorizedHeaders(),
      body: { entry: [{ uuid: 'attachment-1' }] },
      deps: deps(),
    })

    expect(createTrackedQuote).toHaveBeenCalledWith({
      jobUuid: 'job-1',
      ownerUserId: null,
      expiry: '7d',
      refresh: false,
    })
  })

  it('attributes an auto-Minted Tracked Quote to the mapped ServiceM8 staff user', async () => {
    request.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        uuid: 'attachment-1',
        attachment_source: 'QUOTE',
        file_type: '.pdf',
        active: 1,
        related_object_uuid: 'job-1',
      }),
    })
    resolveOwnerUserId.mockResolvedValue('user-1')

    await handleServiceM8AttachmentWebhook({
      url: 'https://app.example/api/servicem8/attachment',
      headers: authorizedHeaders(),
      body: { auth: { staffUUID: 'staff-1' }, entry: [{ uuid: 'attachment-1' }] },
      deps: deps(),
    })

    expect(resolveOwnerUserId).toHaveBeenCalledWith('staff-1')
    expect(createTrackedQuote).toHaveBeenCalledWith({
      jobUuid: 'job-1',
      ownerUserId: 'user-1',
      expiry: '30d',
      refresh: false,
    })
  })

  it('still Mints with a null Owner when the ServiceM8 staff user is unmapped', async () => {
    request.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        uuid: 'attachment-1',
        attachment_source: 'QUOTE',
        file_type: '.pdf',
        active: 1,
        related_object_uuid: 'job-1',
      }),
    })
    resolveOwnerUserId.mockResolvedValue(null)

    await handleServiceM8AttachmentWebhook({
      url: 'https://app.example/api/servicem8/attachment',
      headers: authorizedHeaders(),
      body: { auth: { staffUUID: 'staff-missing' }, entry: [{ uuid: 'attachment-1' }] },
      deps: deps(),
    })

    expect(createTrackedQuote).toHaveBeenCalledWith({
      jobUuid: 'job-1',
      ownerUserId: null,
      expiry: '30d',
      refresh: false,
    })
  })

  it('Refreshes an existing Tracked Quote when a live Quote PDF is regenerated', async () => {
    request.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        uuid: 'attachment-1',
        attachment_source: 'QUOTE',
        file_type: '.pdf',
        active: 1,
        related_object_uuid: 'job-1',
      }),
    })
    createTrackedQuote
      .mockResolvedValueOnce({
        ok: false,
        reason: 'quote_exists',
        message: 'A live tracked quote already exists for this job.',
        link: 'https://quotes.example/q/ABC12345',
        expiresAt: new Date('2026-06-23T00:00:00Z'),
      })
      .mockResolvedValueOnce({
        ok: true,
        quoteId: 'quote-1',
        shortCode: 'ABC12345',
        link: 'https://quotes.example/q/ABC12345',
        expiresAt: new Date('2026-06-23T00:00:00Z'),
        clientName: 'Acme Ltd',
        jobAddress: '12 Glass St',
        quoteValue: '120.00',
        storageDriver: 'memory',
      })

    const result = await handleServiceM8AttachmentWebhook({
      url: 'https://app.example/api/servicem8/attachment',
      headers: authorizedHeaders(),
      body: { entry: [{ uuid: 'attachment-1' }] },
      deps: deps(),
    })

    expect(result).toEqual({ status: 200, body: { ok: true, minted: 0, refreshed: 1, ignored: 0 } })
    expect(createTrackedQuote).toHaveBeenNthCalledWith(1, {
      jobUuid: 'job-1',
      ownerUserId: null,
      expiry: '30d',
      refresh: false,
    })
    expect(createTrackedQuote).toHaveBeenNthCalledWith(2, {
      jobUuid: 'job-1',
      ownerUserId: null,
      refresh: true,
    })
    expect(sendReadyLinkEmail).not.toHaveBeenCalled()
  })

  it('emails the configured recipients when a Tracked Quote is first auto-Minted', async () => {
    request.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        uuid: 'attachment-1',
        attachment_source: 'QUOTE',
        file_type: '.pdf',
        active: 1,
        related_object_uuid: 'job-1',
      }),
    })
    getNotificationSettings.mockResolvedValue({ enabled: true, to: ['support@royalglass.co.nz', 'sales@royalglass.co.nz'] })

    await handleServiceM8AttachmentWebhook({
      url: 'https://app.example/api/servicem8/attachment',
      headers: authorizedHeaders(),
      body: { entry: [{ uuid: 'attachment-1' }] },
      deps: deps(),
    })

    expect(sendReadyLinkEmail).toHaveBeenCalledWith({
      to: ['support@royalglass.co.nz', 'sales@royalglass.co.nz'],
      quote: expect.objectContaining({
        link: 'https://quotes.example/q/ABC12345',
        clientName: 'Acme Ltd',
        jobAddress: '12 Glass St',
      }),
    })
  })

  it('does not email when quote notifications are disabled', async () => {
    request.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        uuid: 'attachment-1',
        attachment_source: 'QUOTE',
        file_type: '.pdf',
        active: 1,
        related_object_uuid: 'job-1',
      }),
    })
    getNotificationSettings.mockResolvedValue({ enabled: false, to: ['support@royalglass.co.nz'] })

    await handleServiceM8AttachmentWebhook({
      url: 'https://app.example/api/servicem8/attachment',
      headers: authorizedHeaders(),
      body: { entry: [{ uuid: 'attachment-1' }] },
      deps: deps(),
    })

    expect(sendReadyLinkEmail).not.toHaveBeenCalled()
  })
})
