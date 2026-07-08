# Security-focused tests — everything (leads feature set)

Mode: retrofit · Date: 2026-06-30 · Playwright: available

## Existing coverage

| Test file | What it covers | Security-relevant? |
|-----------|---------------|-------------------|
| `modules/leads/__tests__/actions.test.ts` | batchDeleteLeadsAction, restoreLeadAction happy paths | Partial — tests admin path but not rejection of non-admin |
| `modules/leads/__tests__/queries.test.ts` | Filter parsing, getLeadsList, getLeadDetail | ✅ UUID validation, sort whitelist |
| `modules/leads/__tests__/servicem8-fetch.test.ts` | SM8 fetch/import/link — API and DB interactions | ✅ error shapes, job-not-found |
| `modules/leads/__tests__/lead-lifecycle.test.ts` | isServiceM8QuoteStatus, isLeadReadOnlyForLeadIntake | ✅ covers status gate |

## Gaps — tests that must be added

### AuthN gates (server actions)
```typescript
// actions.test.ts — add these cases

it('batchDeleteLeadsAction: rejects unauthenticated calls', async () => {
  vi.mocked(auth).mockResolvedValue(null)
  const fd = new FormData()
  fd.append('leadId', 'some-uuid')
  await expect(batchDeleteLeadsAction(fd)).rejects.toThrow('Forbidden')
})

it('batchDeleteLeadsAction: rejects non-admin session', async () => {
  vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'staff' } } as any)
  const fd = new FormData()
  fd.append('leadId', 'some-uuid')
  await expect(batchDeleteLeadsAction(fd)).rejects.toThrow('Forbidden')
})

it('deleteLeadAction: rejects non-admin session', async () => {
  vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'staff' } } as any)
  await expect(deleteLeadAction('some-uuid')).rejects.toThrow('Forbidden')
})

it('generateLeadSuggestionAction: rejects unauthenticated calls', async () => {
  vi.mocked(auth).mockResolvedValue(null)
  const result = await generateLeadSuggestionAction('some-uuid')
  expect(result).toHaveProperty('error')
})
```

### Input validation
```typescript
// queries.test.ts — add these cases

it('getLeadDetail: returns null for non-UUID leadId (prevents malformed DB query)', async () => {
  const result = await getLeadDetail('../etc/passwd')
  expect(result).toBeNull()
})

it('parseLeadsListFilters: rejects unknown sortColumn, falls back to default', () => {
  const filters = parseLeadsListFilters({ sortColumn: 'DROP TABLE leads--' })
  expect(filters.sortColumn).toBe('createdAt') // default
})
```

### Audit logging
```typescript
// actions.test.ts — add

it('generateLeadSuggestionAction: logs the AI generation event', async () => {
  // After this test is added, the logAudit gap (finding #1) must be fixed first
  vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role: 'staff' } } as any)
  // ... mock lead, SM8, OpenAI
  await generateLeadSuggestionAction('valid-lead-uuid')
  expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
    action: 'lead.ai_suggestion_generated',
    actorId: 'u1',
  }))
})
```

### Playwright (E2E authZ negative tests)
```typescript
// tests/e2e/leads-security.spec.ts

test('leads page: unauthenticated user is redirected to login', async ({ page }) => {
  await page.goto('/leads')
  await expect(page).toHaveURL(/\/login/)
})

test('leads detail: non-module user is redirected', async ({ page }) => {
  // Log in as user without leads grant, navigate to /leads/[valid-id]
  await expect(page).toHaveURL(/\/\?denied=leads/)
})

test('batch delete form: not rendered for non-admin', async ({ page }) => {
  // Log in as staff (non-admin)
  await page.goto('/leads')
  await expect(page.locator('#batch-delete-form')).toHaveCount(0)
})
```

## Priority

1. AuthN gate tests for server actions (Medium finding — covers security requirement #2)
2. Audit log test for `generateLeadSuggestionAction` (depends on fixing finding #1 first)
3. Playwright E2E authZ negative tests (route-level gate verification)
