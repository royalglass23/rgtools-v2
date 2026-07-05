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

  test('captures a lead from the dashboard and continues full intake', async ({ page }) => {
    const stamp = Date.now()
    const clientName = `E2E Lead ${stamp}`
    const jobAddress = `1 Queen Street, Auckland Central, Auckland ${stamp}`

    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Quick Capture' })).toBeVisible()
    await page.getByLabel('Client name').fill(clientName)
    await page.getByLabel('Phone').fill('021 555 0101')
    await page.getByLabel('Email').fill(`lead-${stamp}@example.com`)
    await page.getByLabel('Job address').fill(jobAddress)
    await page.getByLabel('Job Description').fill('E2E dashboard quick capture lead')
    await page.getByRole('button', { name: 'Capture lead' }).click()

    await expect(page.getByText(/Created lead\./)).toBeVisible({ timeout: 20_000 })
    await page.getByRole('link', { name: 'Continue full intake' }).click()

    await expect(page).toHaveURL(/\/lead-intake\?leadId=/)
    await expect(page.getByRole('heading', { name: 'Lead Intake' })).toBeVisible()
    await expect(page.getByLabel(/Client Name\/Business Name/)).toHaveValue(clientName)

    await page.getByLabel(/Free notes/).fill('Full intake continued from dashboard e2e.')
    await page.getByLabel(/Reason for edit/).fill('E2E verification of full intake continuation.')
    await page.getByRole('button', { name: 'Save and score' }).click()

    await expect(page).toHaveURL(/\/leads\/[0-9a-f-]+\?intakeSaved=updated/i, { timeout: 20_000 })
    await expect(page.getByRole('heading', { name: clientName })).toBeVisible()
    await expect(page.getByText('Lead updated and scored successfully.')).toBeVisible()
    await expect(page.getByText(jobAddress)).toBeVisible()

    await page.goto(`/leads?q=${encodeURIComponent(clientName)}`)
    await expect(page.getByRole('heading', { name: 'Leads' })).toBeVisible()
    await expect(page.getByRole('table')).toContainText(clientName)
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
