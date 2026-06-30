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
    expect(screen.getByRole('radio', { name: 'PS1 only' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'PS3 only' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'PS1 + PS3' })).toBeChecked()

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
  })

  it('updates option choices when a different published system is selected', () => {
    render(<GeneratePsForm configuration={configuration} />)

    fireEvent.change(screen.getByLabelText('System'), { target: { value: 'frameless-spigot' } })

    expect(screen.getByLabelText('System')).toHaveValue('frameless-spigot')
    expect(screen.getByLabelText('Location')).toHaveValue('external')
    expect(within(screen.getByLabelText('Location')).getAllByRole('option').map((option) => option.textContent)).toEqual(['External'])
    expect(screen.getByLabelText('Thickness')).toHaveValue('12mm')
    expect(within(screen.getByLabelText('Thickness')).getAllByRole('option').map((option) => option.textContent)).toEqual(['12mm'])
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
    expect(screen.getByLabelText('Client name')).toHaveValue('Jane Customer')
    expect(screen.getByLabelText('Job address')).toHaveValue('12 Glass Lane')
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

  it('submits generation requests and exposes separate downloads', async () => {
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
    expect(await screen.findByRole('link', { name: 'Download PS1' })).toHaveAttribute('download', 'PS1-Jane-Customer.pdf')
    expect(screen.getByRole('link', { name: 'Download PS3' })).toHaveAttribute('download', 'PS3-Jane-Customer.pdf')
  })
})
