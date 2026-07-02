import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function pageSource() {
  return readFileSync(
    join(process.cwd(), 'app/(dashboard)/work-orders/[id]/page.tsx'),
    'utf8',
  )
}

describe('work order detail page', () => {
  it('renders job summary, client context, contacts, and timeline surfaces without internal ServiceM8 identifiers', () => {
    const source = pageSource()

    for (const text of [
      'Job Summary',
      'Job number',
      'Address',
      'Status',
      'Lead score',
      'Description',
      'Operational State',
      'Maintenance Program',
      'Client Context',
      'Client notes',
      'Client Context Summary',
      'Contacts',
      'Job contact',
      'Project Timeline',
    ]) {
      expect(source).toContain(text)
    }
    expect(source).toContain('{detail.companyName &&')
    expect(source).not.toContain('No job number')
    expect(source).not.toContain('ServiceM8 job UUID')
    expect(source).not.toContain('Client Approach Note')
  })

  it('keeps edit controls permission-sensitive for manage users', () => {
    const source = pageSource()

    expect(source).toContain('permissions.canManage &&')
    expect(source).toContain('Manage Work Order')
    expect(source).toContain('name="maintenanceProgram"')
    expect(source).toContain('Yes')
    expect(source).toContain('No')
    expect(source).toContain('Save changes')
    expect(source).toContain('Add note')
  })
})
