import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { WorkOrderRefreshStatus } from '../WorkOrderRefreshStatus'

describe('WorkOrderRefreshStatus', () => {
  it('preserves last-success freshness and counts while showing the latest safe failure', () => {
    render(
      <WorkOrderRefreshStatus
        status={{
          lastSuccessfulAt: new Date('2026-07-14T00:00:00.000Z'),
          lastSuccessfulJobCount: 4,
          lastSuccessfulItemCount: 9,
          lastSuccessfulExcludedLineCount: 2,
          latestFailure: {
            at: new Date('2026-07-14T00:05:00.000Z'),
            message: 'ServiceM8 jobmaterial response was invalid: expected an array.',
          },
        }}
      />,
    )

    expect(screen.getByText(/Last successful sync:/)).toBeInTheDocument()
    expect(screen.getByText('4 jobs')).toBeInTheDocument()
    expect(screen.getByText('9 items')).toBeInTheDocument()
    expect(screen.getByText('2 billing lines excluded')).toBeInTheDocument()
    expect(screen.getByText(/Latest refresh failed:/)).toBeInTheDocument()
    expect(screen.getByText('ServiceM8 jobmaterial response was invalid: expected an array.')).toBeInTheDocument()
  })

  it('lets the user close the latest refresh failure', () => {
    render(
      <WorkOrderRefreshStatus
        status={{
          lastSuccessfulAt: new Date('2026-07-09T10:06:00+12:00'),
          lastSuccessfulJobCount: 48,
          lastSuccessfulItemCount: 0,
          lastSuccessfulExcludedLineCount: 0,
          latestFailure: {
            at: new Date('2026-07-14T15:00:00+12:00'),
            message: 'ServiceM8 item is invalid.',
          },
        }}
      />,
    )

    const failure = screen.getByRole('alert')
    fireEvent.click(within(failure).getByRole('button', { name: 'Close notification' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Last successful sync')
  })
})
