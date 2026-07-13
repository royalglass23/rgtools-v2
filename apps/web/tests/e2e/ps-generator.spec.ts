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
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 45_000, waitUntil: 'commit' })
  await expect(page.getByRole('button', { name: /^sign out$/i })).toBeVisible({ timeout: 45_000 })
}

test.describe('ps generator', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('loads generate workflow and configuration navigation', async ({ page }) => {
    await page.goto('/ps-generator')

    await expect(page.getByRole('heading', { name: 'Generate PS' })).toBeVisible()
    await expect(page.getByLabel('System')).toBeVisible()
    await expect(page.getByLabel('Client name')).toHaveAttribute('required', '')
    await expect(page.getByLabel('Job address')).toHaveAttribute('required', '')
    await expect(page.getByRole('button', { name: 'Generate PS' })).toBeVisible()

    await page.goto('/ps-generator/configuration')
    await expect(page.getByRole('heading', { name: 'PS Configuration' })).toBeVisible()
    await expect(page.getByText('System', { exact: true })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Height above floor' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Height above fixing' })).toBeVisible()
    const doubleDiscRow = page.getByRole('row').filter({ hasText: 'Double Disc' }).first()
    await expect(doubleDiscRow).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Add option value' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add option' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save draft' })).toBeVisible()
  })
})
