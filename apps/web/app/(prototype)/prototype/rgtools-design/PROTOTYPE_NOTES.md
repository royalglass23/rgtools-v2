# RGTools design prototype

> PROTOTYPE - throwaway review code. Do not promote directly to production.

## Question

Does one Royal Glass Workbench design system support all 27 current RGTools pages while keeping needs-attention, next action, status, ownership, source, and history easy to scan?

## Direction under review

- Workbench layout as the core structure
- Persistent Royal Glass navigation and priority-first dashboard
- Contextual inspector for next action, source, ownership, and history
- Light, Dark, and System themes
- Responsive desktop and mobile previews
- Fake data and no live mutations
- Quote Tracker represents tracking of ServiceM8 quotes only

## Run

```powershell
pnpm dev
```

Open `http://localhost:3000/prototype/rgtools-design`.

## Verdict

Approved as the implementation direction. Keep the established page patterns, responsive previews, and theme behavior.

The Business performance graph must identify each plotted series, explain that the lines show relative movement, and label the 30-day time range. This clarification is incorporated in the prototype and should carry into MT-201 implementation.
