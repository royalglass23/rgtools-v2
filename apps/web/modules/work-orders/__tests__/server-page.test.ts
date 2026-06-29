import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('work orders server page', () => {
  it('does not pass browser event handlers from the server component tree', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/(dashboard)/work-orders/page.tsx'),
      'utf8',
    )

    expect(source).not.toContain('onChange=')
    expect(source).not.toContain('requestSubmit()')
  })
})
