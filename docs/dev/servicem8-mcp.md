# ServiceM8 MCP server (official)

ServiceM8 ships an official, OAuth-based **MCP server** that lets Claude Code (and
other MCP clients like ChatGPT) query the live ServiceM8 account conversationally.
It is wired into this repo via [`.mcp.json`](../../.mcp.json) at the project root.

> **Scope:** this is a **convenience layer for ad-hoc questions and light actions**,
> not a data pipeline. For dashboards, reports, work-order tracking, allocation and
> invoices, use the deterministic REST → DB sync described in
> [servicem8-sync-architecture.md](./servicem8-sync-architecture.md). See
> "When to use which" below.

## Setup

The server is already declared in `.mcp.json` (project scope, committed):

```json
{
  "mcpServers": {
    "servicem8": { "type": "http", "url": "https://go.servicem8.com/mcp" }
  }
}
```

No secret is stored — auth is **OAuth, managed by ServiceM8**.

1. Restart Claude Code so it picks up `.mcp.json`.
2. Verify it's registered: `claude mcp list` → `servicem8` should appear.
3. The **first time** you invoke a ServiceM8 tool, Claude Code opens a browser
   OAuth flow. Approve access on ServiceM8's own consent screen (sign in with the
   Royal Glass ServiceM8 account). Tokens are managed by the client — you don't
   store them.

## Tools exposed (the whole set)

The official server is intentionally narrow:

**Reads**
- Search Clients & Jobs
- List jobs
- List staff members
- List Job Templates

**Writes (safe by design)**
- Add a job Note
- Create a job using a Job Template

## What it does NOT cover

These objects are **not** reachable via the official MCP server — use the REST
client at [`lib/servicem8/client.ts`](../../lib/servicem8/client.ts) (full
`api_1.0` access via `SERVICEM8_API_KEY`) instead:

- Job line items (`jobmaterial`) — needed for quote subtotals + jobcard categories
- Quote PDF attachments (`attachment`)
- Company lookup by UUID (`company/{uuid}`)
- Inbox messages (`inboxmessage`)
- Writing custom fields (e.g. Leads Quality)
- Staff **allocation**/scheduling, invoices, payments

You cannot "pull all data" through this server — its toolset is the six tools above.

## When to use which

| Need | Use |
|------|-----|
| "Find job R260210" / "list open jobs for [client]" / "who's on staff" | **MCP** (ad-hoc chat) |
| "Add a note to job X" / "create a job from the [template]" | **MCP** (light write) |
| Quote pull / preview / share (PDF + line items) | **REST scripts** — `pnpm quote:*` |
| Jobcard line-item categorisation | **REST CLI** — `pnpm jobcard:*` |
| Lead → custom-field sync | **REST** — existing lead-sync flow |
| Work-order tracking, allocation, invoices, weekly reports, dashboards | **REST → DB sync** (see [architecture doc](./servicem8-sync-architecture.md)) |

## Verification

1. `claude mcp list` shows `servicem8` connected (after OAuth on first use).
2. Ask: "search ServiceM8 for client matching <known client>" → returns live data.
3. Safe write test on a **throwaway/test job**: "add a note to job <test job #>" →
   confirm the note appears in ServiceM8. Never test writes on a live customer job.
