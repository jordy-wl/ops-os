# Browserbase MCP Integration Guide

**Status:** See `mcp/server-registry.md`
**What it enables:** Run browser automation for E2E tests, visual regression checks, and scraping from within agent workflows — no local browser required

---

## Primary Use Case

QA Engineer runs E2E tests against deployed preview URLs using a cloud browser. Removes the dependency on a local browser setup. Session IDs are logged as Gate 6 evidence in `gate-results.md`.

Secondary use: Researcher scrapes competitor sites or product pages as part of competitive analysis (within ToS — no login-gating, no circumventing access controls).

---

## What This Integration Enables

| Action | Who Uses It | When |
|--------|------------|------|
| Run E2E test session | QA | After feature deploy to preview URL |
| Visual regression screenshot | QA / FE | After UI changes, before Gate 4 sign-off |
| Scrape public competitor pages | Researcher | During competitive analysis research |
| Verify critical user paths | QA | Gate 6 evidence collection |
| Screenshot for stakeholder reports | Orchestrator | During `/interpret` for investors/cofounders |

---

## E2E Test Workflow

```
1. Feature deployed to preview URL (Vercel or equivalent)

2. Start Browserbase session:
   /mcp-connect browserbase start-session
     url: [preview URL]

3. Run E2E test steps (agent controls browser):
   /mcp-connect browserbase navigate
     session-id: [returned ID]
     url: [URL path]

   /mcp-connect browserbase click
     session-id: [ID]
     selector: [CSS selector or text]

   /mcp-connect browserbase fill
     session-id: [ID]
     selector: [input selector]
     value: [test value]

   /mcp-connect browserbase screenshot
     session-id: [ID]
     name: [descriptive-name]

4. Assert on page state:
   /mcp-connect browserbase get-text
     session-id: [ID]
     selector: [selector]

5. End session:
   /mcp-connect browserbase end-session
     session-id: [ID]

6. Log session ID in gate-results.md
```

---

## Required E2E Coverage

Per `prd/11-testing-strategy.md`, E2E tests must cover at minimum:

1. **Happy path** — user accomplishes the core value action successfully
2. **Error path** — user encounters an error and can recover (e.g. form validation, failed API call)
3. **Permission boundary** — unauthenticated user cannot access authenticated pages

Document each scenario in `tests/e2e/` before running the Browserbase session.

---

## Gate Evidence Format

```
GATE 6 — PEER REVIEW (E2E Evidence)
Task: [ID]
Reviewer: QA-ENGINEER
Date: [date]
Browserbase Session ID: [session-id]
Scenarios run:
  ✓ Happy path: [description] — PASS
  ✓ Error path: [description] — PASS
  ✓ Permission boundary: [description] — PASS
Screenshots: [list of named screenshots]
```

---

## Visual Regression Workflow

For UI changes, take before/after screenshots:
```
1. Screenshot before change (from last deployed version)
2. Deploy new version to preview
3. Screenshot after change (same viewport, same path)
4. Compare — flag regressions to FE engineer before Gate 4 sign-off
```

---

## Research Scraping — Constraints

When Researcher uses Browserbase for competitive research:
- Only scrape publicly accessible pages — no login bypass
- Respect `robots.txt` — do not scrape pages disallowed for bots
- Do not scrape at high frequency — one page at a time, human-paced
- Log scraped URLs in `research/inputs/` so findings are traceable
- Store structured findings in `research/findings/competitive-analysis.md` — not raw HTML

---

## Setting Up

1. Create a Browserbase account
2. Generate an API key from the dashboard
3. Note your Project ID
4. Configure MCP server with API key and Project ID
5. Test: `/mcp-connect browserbase start-session url:https://example.com`
6. Mark active in `server-registry.md`

---

## Caution

Do not:
- Use Browserbase to automate actions on production databases or admin panels
- Log in to third-party services using stored credentials in test sessions
- Run Browserbase sessions against production — always use preview/staging URLs
- Leave sessions open — always call `end-session` when done (sessions are billed by time)

---

## `.mcp.json` Configuration

Add this block to `.mcp.json` at the project root (already present as a template):

```json
"browserbase": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@browserbasehq/mcp@latest"],
  "env": {
    "BROWSERBASE_API_KEY": "${BROWSERBASE_API_KEY}",
    "BROWSERBASE_PROJECT_ID": "${BROWSERBASE_PROJECT_ID}"
  }
}
```

**Required env vars:**
- `BROWSERBASE_API_KEY` — from Browserbase Dashboard → API Keys
- `BROWSERBASE_PROJECT_ID` — from Browserbase Dashboard → Project Settings

**To activate:**
1. Set both env vars in your shell profile
2. Add `"browserbase"` to `enabledMcpjsonServers` in `.claude/settings.json`
3. Update registry status to `active`
