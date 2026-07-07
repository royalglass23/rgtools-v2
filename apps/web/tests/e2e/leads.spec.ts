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
  await expect(page.getByRole('button', { name: /^sign out$/i })).toBeVisible({ timeout: 15_000 })
}

test.describe('leads workflow', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('removed lead admin routes stay unavailable', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Lead Scoring' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Lead Import' })).toHaveCount(0)

    for (const path of ['/admin/lead-scoring', '/admin/lead-import']) {
      const response = await page.goto(path)
      expect(response?.status(), `${path} response status`).toBe(404)
    }
  })
})
