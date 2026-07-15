// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import {
  fingerprintSourceDescription,
  refreshWorkOrderItemLabels,
  type WorkOrderItemLabelStore,
} from '../item-label-lifecycle'

describe('refreshWorkOrderItemLabels', () => {
  it('generates and persists one label for one new unlabelled ServiceM8 item', async () => {
    const store = createStore()
    const generateLabel = vi.fn(async () => 'Frameless shower screen, 1200 x 900 mm, chrome')

    await expect(refreshWorkOrderItemLabels([{
      id: 'item-1',
      originalDescription: 'Supply and install frameless shower screen 1200 x 900 with chrome hardware',
      generatedLabel: null,
      manualLabelOverride: null,
      labelStatus: 'pending',
      sourceDescriptionFingerprint: null,
    }], store, generateLabel)).resolves.toEqual({ generated: 1, failed: 0, sourceChanged: 0 })

    expect(generateLabel).toHaveBeenCalledOnce()
    expect(store.saveGenerated).toHaveBeenCalledWith(
      'item-1',
      'Frameless shower screen, 1200 x 900 mm, chrome',
      expect.any(String),
    )
  })

  it('preserves a manual label and flags a changed ServiceM8 description', async () => {
    const store = createStore()
    const generateLabel = vi.fn(async () => 'Replacement generated label')

    await expect(refreshWorkOrderItemLabels([{
      id: 'item-1',
      originalDescription: 'Updated ServiceM8 description',
      generatedLabel: 'Previous generated label',
      manualLabelOverride: 'Staff-approved production label',
      labelStatus: 'manual',
      sourceDescriptionFingerprint: fingerprintSourceDescription('Original ServiceM8 description'),
    }], store, generateLabel)).resolves.toEqual({ generated: 0, failed: 0, sourceChanged: 1 })

    expect(generateLabel).not.toHaveBeenCalled()
    expect(store.markSourceChanged).toHaveBeenCalledWith('item-1')
    expect(store.saveGenerated).not.toHaveBeenCalled()
  })

  it('regenerates when ServiceM8 changes the source description and no manual override exists', async () => {
    const store = createStore()
    const generateLabel = vi.fn(async () => 'Updated generated production label')

    await refreshWorkOrderItemLabels([{
      id: 'item-1',
      originalDescription: 'Updated ServiceM8 description',
      generatedLabel: 'Old generated label',
      manualLabelOverride: null,
      labelStatus: 'generated',
      sourceDescriptionFingerprint: fingerprintSourceDescription('Original ServiceM8 description'),
    }], store, generateLabel)

    expect(store.markPending).toHaveBeenCalledWith('item-1')
    expect(generateLabel).toHaveBeenCalledWith('Updated ServiceM8 description')
    expect(store.saveGenerated).toHaveBeenCalledWith(
      'item-1',
      'Updated generated production label',
      fingerprintSourceDescription('Updated ServiceM8 description'),
    )
  })

  it('keeps a current manual label untouched during an ordinary refresh', async () => {
    const store = createStore()
    const generateLabel = vi.fn(async () => 'Unwanted generated label')
    const originalDescription = 'Current ServiceM8 description'

    await refreshWorkOrderItemLabels([{
      id: 'item-1',
      originalDescription,
      generatedLabel: 'Earlier generated label',
      manualLabelOverride: 'Staff-approved production label',
      labelStatus: 'manual',
      sourceDescriptionFingerprint: fingerprintSourceDescription(originalDescription),
    }], store, generateLabel)

    expect(generateLabel).not.toHaveBeenCalled()
    expect(store.markPending).not.toHaveBeenCalled()
    expect(store.markSourceChanged).not.toHaveBeenCalled()
    expect(store.saveGenerated).not.toHaveBeenCalled()
  })

  it('rejects malformed generated output without failing the label refresh pass', async () => {
    const store = createStore()

    await expect(refreshWorkOrderItemLabels([{
      id: 'item-1',
      originalDescription: 'Current ServiceM8 description',
      generatedLabel: null,
      manualLabelOverride: null,
      labelStatus: 'pending',
      sourceDescriptionFingerprint: null,
    }], store, vi.fn(async () => 'First label\nSecond label'))).resolves.toEqual({
      generated: 0,
      failed: 1,
      sourceChanged: 0,
    })

    expect(store.saveGenerated).not.toHaveBeenCalled()
    expect(store.markFailed).toHaveBeenCalledWith('item-1')
  })

  it('retries a failed label on a later manual refresh', async () => {
    const store = createStore()
    const generateLabel = vi.fn(async () => 'Recovered production label')

    await refreshWorkOrderItemLabels([{
      id: 'item-1',
      originalDescription: 'Current ServiceM8 description',
      generatedLabel: null,
      manualLabelOverride: null,
      labelStatus: 'failed',
      sourceDescriptionFingerprint: null,
    }], store, generateLabel)

    expect(generateLabel).toHaveBeenCalledOnce()
    expect(store.saveGenerated).toHaveBeenCalledWith(
      'item-1',
      'Recovered production label',
      fingerprintSourceDescription('Current ServiceM8 description'),
    )
  })
})

function createStore(): WorkOrderItemLabelStore {
  return {
    markPending: vi.fn(async () => undefined),
    saveGenerated: vi.fn(async () => undefined),
    markFailed: vi.fn(async () => undefined),
    markSourceChanged: vi.fn(async () => undefined),
  }
}
