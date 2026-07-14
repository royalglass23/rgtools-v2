# MT-200 shakedown

## Scope exercised

- Light, Dark, and System theme resolution, persistence, invalid-value fallback, operating-system changes, and hydration-safe control state.
- Authenticated shell theme control and existing collapse/navigation behaviour.
- Shared Precision UI presentation seams and status text semantics.
- Dashboard, Leads list, and Work Order detail regression seams.
- Repository lint, workspace/web tests, app-scoped Next production build, and whitespace validation.
- Playwright suite discovery for desktop theme parity, mobile navigation/overflow, keyboard focus, and reduced motion.

## Results

- Theme/shell focused tests: 12 passed.
- Full workspace tests: 4 passed.
- Full web tests: 708 passed, 16 existing skips across 122 passing files and 2 skipped files.
- Lint: passed with 5 pre-existing warnings and no errors.
- App-scoped Next build: passed. Existing Turbopack NFT tracing warning remains in the PS Generator local-storage route.
- Raw palette scan: no literal palette values found in the converted Phase 1 surfaces outside the global token layer.

## Live checks not exercised

`apps/web/tests/e2e/ui-themes.spec.ts` ran and reported three skips because this checkout has neither `E2E_USERNAME` nor `E2E_PASSWORD`. No app environment file or deterministic Work Order record is available here. Consequently, authenticated Light/Dark screenshots, the real mobile shell flow, live focus/reduced-motion inspection, and live contrast review remain partial.

Run the suite in an environment with valid test credentials and representative data:

```powershell
pnpm --filter @rgtools/web test:e2e -- tests/e2e/ui-themes.spec.ts --project=chromium
```

Expected screenshots are written to `apps/web/output/playwright/mt-200/` and are intentionally gitignored test output.
