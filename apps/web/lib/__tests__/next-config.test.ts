import { describe, expect, it } from 'vitest'

import nextConfig from '../../next.config'

describe('Next.js app configuration', () => {
  it('allows PS Generator template PDFs through server actions', () => {
    expect(nextConfig.experimental?.serverActions?.bodySizeLimit).toBe('20mb')
  })
})
