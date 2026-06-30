import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function pageSource() {
  return readFileSync(
    join(process.cwd(), 'app/(dashboard)/work-orders/page.tsx'),
    'utf8',
  )
}

describe('work orders server page', () => {
  it('does not pass browser event handlers from the server component tree', () => {
    const source = pageSource()

    expect(source).not.toContain('onChange=')
    expect(source).not.toContain('requestSubmit()')
  })

  it('uses the v1 default summary columns without internal AI or ServiceM8 fields', () => {
    const source = pageSource()

    for (const heading of [
      'Client',
      'Job number',
      'Address',
      'Score',
      'Importance',
      'Risk',
      'Installer',
      'Stage',
      'Hardware',
      'Install date',
      'Date completed',
    ]) {
      expect(source).toContain(`>${heading}<`)
    }

    expect(source).not.toContain('>Created<')
    expect(source).not.toContain('>AI suggestion<')
    expect(source).not.toContain('>Client notes<')
    expect(source).not.toContain('>SM8 Status<')
  })

  it('keeps installer visible but out of the default filter bar', () => {
    const source = pageSource()

    expect(source).toContain('name="q"')
    expect(source).toContain('name="risk"')
    expect(source).toContain('name="importance"')
    expect(source).toContain('name="stage"')
    expect(source).toContain('name="hardware"')
    expect(source).not.toContain('name="installer"')
    expect(source).not.toContain('name="servicem8Status"')
  })

  it('has distinct empty and no-results copy for the summary table', () => {
    const source = pageSource()

    expect(source).toContain('No current Work Orders yet.')
    expect(source).toContain('No Work Orders match these filters.')
    expect(source).toContain('Work Orders could not refresh from ServiceM8')
  })

  it('shows operational controls only for manage users', () => {
    const source = pageSource()

    expect(source).toContain('getCurrentWorkOrderPermissions')
    expect(source).toContain('permissions.canManage &&')
    expect(source).toContain('Refresh from ServiceM8')
  })
})
