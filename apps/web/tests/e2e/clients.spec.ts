import { expect, test, type Page } from '@playwright/test'

const e2eUser = process.env.E2E_USERNAME ?? 'rgadmin'
const e2ePassword = process.env.E2E_PASSWORD ?? '*royalglass23'

async function gotoWithRetry(page: Page, path: string) {
  let lastError: unknown
  for (let attempt = 0; attempt < 45; attempt++) {
    try {
      await page.goto(path, { timeout: 5_000 })
      return
    } catch (error) {
      if (error instanceof Error && error.message.includes('ERR_ABORTED')) return
      if (!(error instanceof Error) || !error.message.includes('ERR_CONNECTION_REFUSED')) throw error
      lastError = error
      await page.waitForTimeout(1_000)
    }
  }
  throw lastError
}

async function login(page: Page) {
  await gotoWithRetry(page, '/login')
  await page.getByLabel('Username').fill(e2eUser)
  await page.getByLabel('Password').fill(e2ePassword)
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000, waitUntil: 'commit' })
}

test.describe('clients cleanup', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('list search and cleanup filters render and update the route', async ({ page }) => {
    await page.goto('/clients')

    await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible()
    await expect(page.getByLabel('Search')).toBeVisible()
    await expect(page.getByLabel('Cleanup filter')).toBeVisible()

    await page.getByLabel('Search').fill('__no_client_result__')
    await page.getByLabel('Cleanup filter').selectOption('needs_review')
    await page.getByRole('button', { name: 'Apply' }).click()

    await expect(page).toHaveURL(/search=__no_client_result__/)
    await expect(page).toHaveURL(/filter=needs_review/)
    await expect(page.getByText('No clients found.')).toBeVisible()
  })

  test('admin client detail exposes cleanup form when client data exists', async ({ page }) => {
    await page.goto('/clients')

    const emptyState = page.getByText('No clients found.')
    test.skip(await emptyState.isVisible(), 'No clients exist in this environment.')

    await page.getByRole('table').getByRole('link').first().click()

    await expect(page).toHaveURL(/\/clients\/[0-9a-f-]+/i)
    await expect(page.getByRole('heading', { name: 'Client cleanup' })).toBeVisible()
    await expect(page.getByLabel('Display name')).toBeVisible()
    await expect(page.getByLabel('Client type')).toBeVisible()
    await expect(page.getByLabel('Primary contact name')).toBeVisible()
    await expect(page.getByLabel('Manual aliases')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save client' })).toBeVisible()
  })
})
