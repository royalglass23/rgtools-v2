import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildPublishedPsConfigurationReadModel,
  createPsGeneratorSeedRows,
} from '../configuration'
import { GeneratePsForm } from '../GeneratePsForm'

const configuration = buildPublishedPsConfigurationReadModel(createPsGeneratorSeedRows())

describe('GeneratePsForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders a single-page form from published configuration with expected defaults', () => {
    render(<GeneratePsForm configuration={configuration} />)

    expect(screen.getByRole('heading', { name: 'Generate PS' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'PS1 only' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'PS3 only' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'PS1 + PS3' })).not.toBeChecked()

    expect(screen.getByLabelText('System')).toHaveValue('double-disc')
    expect(screen.getByLabelText('Structure material')).toHaveValue('timber')
    expect(screen.getByLabelText('Structure type')).toHaveValue('deck')
    expect(screen.getByLabelText('Location')).toHaveValue('external')
    expect(screen.getByLabelText('Structure built')).toHaveValue('new')
    expect(screen.getByLabelText('Glass type')).toHaveValue('toughened')
    expect(screen.getByLabelText('Thickness')).toHaveValue('12mm')
    expect(screen.getByLabelText('Gate required')).toHaveValue('no')
    expect(screen.getByLabelText('BC number')).toHaveValue('')
    expect(screen.getByLabelText('Lot description')).toHaveValue('')

    const systemOptions = within(screen.getByLabelText('System')).getAllByRole('option').map((option) => option.textContent)
    expect(systemOptions).toEqual(['Double Disc', 'Frameless Spigot'])
    expect(systemOptions).not.toContain('Legacy Face Fixed')
    expect(within(screen.getByLabelText('Structure type')).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Deck',
      'Balcony',
      'Pool Area',
      'Stair Area',
      'Landing',
      'Stair and Landing',
      'Stair and Balcony Area',
    ])
    expect(within(screen.getByLabelText('Location')).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'External',
      'Internal',
      'External and Internal',
    ])
  })

  it('keeps option choices global when a different published system is selected', () => {
    render(<GeneratePsForm configuration={configuration} />)

    fireEvent.change(screen.getByLabelText('System'), { target: { value: 'frameless-spigot' } })

    expect(screen.getByLabelText('System')).toHaveValue('frameless-spigot')
    expect(screen.getByLabelText('Location')).toHaveValue('external')
    expect(within(screen.getByLabelText('Location')).getAllByRole('option').map((option) => option.textContent)).toEqual(['External', 'Internal', 'External and Internal'])
    expect(screen.getByLabelText('Thickness')).toHaveValue('12mm')
    expect(within(screen.getByLabelText('Thickness')).getAllByRole('option').map((option) => option.textContent)).toEqual(['12mm', '15mm', '17.52mm'])
  })

  it('prefills only client name and job address for a matching job number', async () => {
    const lookupJob = vi.fn().mockResolvedValue({
      found: true,
      clientName: 'Jane Customer',
      jobAddress: '12 Glass Lane',
    })
    render(<GeneratePsForm configuration={configuration} lookupJob={lookupJob} />)

    fireEvent.change(screen.getByLabelText('Job number'), { target: { value: ' r260210 ' } })
    fireEvent.change(screen.getByLabelText('BC number'), { target: { value: 'BC-123' } })
    fireEvent.change(screen.getByLabelText('Lot description'), { target: { value: 'Lot 4 DP 12345' } })
    fireEvent.click(screen.getByRole('button', { name: 'Find job' }))

    await waitFor(() => expect(lookupJob).toHaveBeenCalledWith('R260210'))
    await waitFor(() => expect(screen.getByLabelText('Job address')).toHaveValue('12 Glass Lane'))
    expect(screen.getByLabelText('Client name')).toHaveValue('Jane Customer')
    expect(screen.getByLabelText('BC number')).toHaveValue('BC-123')
    expect(screen.getByLabelText('Lot description')).toHaveValue('Lot 4 DP 12345')
  })

  it('keeps manual entry usable when a job number does not match', async () => {
    const lookupJob = vi.fn().mockResolvedValue({
      found: false,
      message: 'No job found for R260999. You can keep entering details manually.',
    })
    render(<GeneratePsForm configuration={configuration} lookupJob={lookupJob} />)

    fireEvent.change(screen.getByLabelText('Job number'), { target: { value: 'R260999' } })
    fireEvent.change(screen.getByLabelText('Client name'), { target: { value: 'Manual Customer' } })
    fireEvent.change(screen.getByLabelText('Job address'), { target: { value: '99 Manual Road' } })
    fireEvent.click(screen.getByRole('button', { name: 'Find job' }))

    expect(await screen.findByText('No job found for R260999. You can keep entering details manually.')).toBeInTheDocument()
    expect(screen.getByLabelText('Client name')).toHaveValue('Manual Customer')
    expect(screen.getByLabelText('Job address')).toHaveValue('99 Manual Road')
  })

  it('keeps manual entry usable when job lookup fails', async () => {
    const lookupJob = vi.fn().mockRejectedValue(new Error('ServiceM8 unavailable'))
    render(<GeneratePsForm configuration={configuration} lookupJob={lookupJob} />)

    fireEvent.change(screen.getByLabelText('Job number'), { target: { value: 'R260210' } })
    fireEvent.change(screen.getByLabelText('Client name'), { target: { value: 'Manual Customer' } })
    fireEvent.click(screen.getByRole('button', { name: 'Find job' }))

    expect(await screen.findByText('Unable to look up job R260210. You can keep entering details manually.')).toBeInTheDocument()
    expect(screen.getByLabelText('Client name')).toHaveValue('Manual Customer')
  })

  it('fills the lot description from LINZ for the current job address', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        found: true,
        lotDescription: 'LOT 18 DP 192386 756M2, LOT 27 DP 192386 236M2',
        confidence: 'high',
      }),
    } as Response)
    render(<GeneratePsForm configuration={configuration} />)

    fireEvent.change(screen.getByLabelText('Job address'), { target: { value: '18 Lucia Glade Meadowbank, Auckland 1072' } })
    fireEvent.click(screen.getByRole('button', { name: 'Find lot' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/ps-generator/lot-description', expect.objectContaining({
      method: 'POST',
    })))
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      address: '18 Lucia Glade Meadowbank, Auckland 1072',
    })
    expect(await screen.findByText('Loaded lot description from LINZ.')).toBeInTheDocument()
    expect(screen.getByLabelText('Lot description')).toHaveValue('LOT 18 DP 192386 756M2, LOT 27 DP 192386 236M2')
  })

  it('warns staff when the LINZ lot description needs confirmation', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        found: true,
        lotDescription: 'LOT 1 DP 92924 5641M2, LOT 2 DP 92924 7473M2',
        confidence: 'needs_confirmation',
        warning: 'LINZ linked this property to multiple titles/parcels. Review before generating.',
      }),
    } as Response)
    render(<GeneratePsForm configuration={configuration} />)

    fireEvent.change(screen.getByLabelText('Job address'), { target: { value: '217 Kupe Street, Orakei, Auckland 1071' } })
    fireEvent.click(screen.getByRole('button', { name: 'Find lot' }))

    expect(await screen.findByText('LINZ linked this property to multiple titles/parcels. Review before generating.')).toBeInTheDocument()
    expect(screen.getByLabelText('Lot description')).toHaveValue('LOT 1 DP 92924 5641M2, LOT 2 DP 92924 7473M2')
  })

  it('does not generate from implicit form submit', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, outputs: [] }),
    } as Response)
    render(<GeneratePsForm configuration={configuration} />)

    fireEvent.change(screen.getByLabelText('Client name'), { target: { value: 'Jane Customer' } })
    fireEvent.change(screen.getByLabelText('Job address'), { target: { value: '12 Glass Lane' } })
    const form = screen.getByRole('button', { name: 'Generate PS' }).closest('form')
    expect(form).not.toBeNull()

    fireEvent.submit(form!)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('submits generation requests and downloads generated PDFs immediately', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        operationId: 'operation-1',
        outputs: [
          {
            documentKind: 'ps1',
            filename: 'PS1-Jane-Customer.pdf',
            contentType: 'application/pdf',
            base64: 'cHMx',
          },
          {
            documentKind: 'ps3',
            filename: 'PS3-Jane-Customer.pdf',
            contentType: 'application/pdf',
            base64: 'cHMz',
          },
        ],
      }),
    } as Response)
    const clickMock = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<GeneratePsForm configuration={configuration} />)

    fireEvent.change(screen.getByLabelText('Client name'), { target: { value: 'Jane Customer' } })
    fireEvent.change(screen.getByLabelText('Job address'), { target: { value: '12 Glass Lane' } })
    fireEvent.click(screen.getByRole('radio', { name: 'PS3 only' }))
    fireEvent.click(screen.getByRole('button', { name: 'Generate PS' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/ps-generator/generate', expect.objectContaining({
      method: 'POST',
    })))
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      mode: 'ps3_only',
      projectDetails: {
        clientName: 'Jane Customer',
        jobAddress: '12 Glass Lane',
        bcNumber: '',
        lotDescription: '',
      },
      selections: {
        system: 'double-disc',
        structure_material: 'timber',
        structure_type: 'deck',
        location: 'external',
        structure_built: 'new',
        glass_type: 'toughened',
        thickness: '12mm',
        gate_required: 'no',
      },
    })
    expect(await screen.findByText('Generated and downloaded 2 documents.')).toBeInTheDocument()
    expect(clickMock).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('link', { name: 'Download PS1' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Download PS3' })).not.toBeInTheDocument()
  })
})
