# Royal Glass Precision UI system

Royal Glass Precision is the shared presentation foundation for authenticated RG Tools pages. Phase 1 covers the application shell, Operations Dashboard, Leads list, and Work Order detail while preserving each module's existing data and workflows.

## Theme contract

The resolved theme is stored on the document root as `data-theme="light"` or `data-theme="dark"`. The account-area appearance control stores `light`, `dark`, or `system` under `rgtools-theme`. A small inline bootstrap applies the resolved theme before first paint; the React control then keeps System mode synchronized with operating-system changes.

Theme preference remains browser-local. It must not be added to the database or session without a separate product decision.

## Tokens

Semantic CSS variables live in `apps/web/app/globals.css`. They cover canvas and elevated surfaces, text hierarchy, borders, brand accents, focus, status colours, shadows, geometry, motion, spacing, typography, and shell dimensions. Light and dark redefine the same names, so page markup and geometry remain identical.

New presentation code must consume semantic variables such as `--surface-elevated`, `--text-secondary`, `--border-default`, and `--status-warning-text`. Raw palette values belong in the token definitions. Data-series colours may be separate tokens when their meaning is documented.

Status components must include readable text and may not communicate meaning by colour alone. Numeric summaries and identifiers should use tabular numerals where this improves scanning.

## Shared presentation seams

`apps/web/components/precision-ui/PrecisionUI.tsx` contains small presentation-only seams: page and section headings, data panels, KPI and priority cards, table shells, status badges, buttons, controls, and feedback states. Domain modules continue to own queries, actions, permissions, wording, and content order.

When extending the system:

1. Reuse an existing semantic token or shared seam when its meaning matches.
2. Add a semantic token before introducing a new raw colour or component-specific shadow.
3. Keep decision logic and server actions in the domain module.
4. Verify Light, Dark, keyboard focus, reduced motion, and narrow viewport behaviour.
5. Migrate one complete user-facing slice at a time; do not mix tokenized and literal palette styling within one surface.

## Verification

Theme-domain and control tests live under `apps/web/components/theme/__tests__`. Shared component tests live under `apps/web/components/precision-ui/__tests__`. `apps/web/tests/e2e/ui-themes.spec.ts` captures the three reference screens in Light and Dark and checks the mobile shell, overflow, keyboard focus, and reduced motion.
