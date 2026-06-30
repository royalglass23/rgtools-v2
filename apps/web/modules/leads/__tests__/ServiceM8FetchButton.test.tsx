import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ServiceM8FetchButton } from '../ServiceM8FetchButton'

describe('ServiceM8FetchButton', () => {
  it('keeps Fetch from ServiceM8 available for a linked non-Quote lead', () => {
    render(
      <ServiceM8FetchButton
        leadId="lead-1"
        initialJobUuid="job-1"
        initialJobNumber="Q260001"
        initialJobStatus="Work Order"
        initialLeadsQuality="Leads Quality A"
      />,
    )

    expect(screen.getByText('Work Order')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fetch from ServiceM8' })).toBeEnabled()
  })
})
