import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireModule = vi.hoisted(() => vi.fn())

vi.mock('@/lib/guard', () => ({
  requireModule: (slug: string) => requireModule(slug),
}))

import ClientsLayout from '../layout'

describe('ClientsLayout', () => {
  beforeEach(() => {
    requireModule.mockReset()
    requireModule.mockResolvedValue(undefined)
  })

  it('guards direct Clients routes with Clients module access', async () => {
    await ClientsLayout({ children: <div /> })

    expect(requireModule).toHaveBeenCalledWith('clients')
  })

  it('stops rendering when Clients module access is denied', async () => {
    requireModule.mockRejectedValue(Object.assign(new Error('NEXT_REDIRECT'), { url: '/?denied=clients' }))

    await expect(ClientsLayout({ children: <div /> })).rejects.toMatchObject({
      url: '/?denied=clients',
    })
  })
})
