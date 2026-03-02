# MCP Server Registry

> Single source of truth for all connected MCP servers.
> Agents: check this at session start to know what external tools are available.
> A server listed as `inactive` must be configured before use — do not attempt to use it.
>
> **To activate a server:** Set the required env var(s), add the server key to `enabledMcpjsonServers` in `.claude/settings.json`, and update status below.

---

## Registry

| Server | Type | What It Enables | Agent Roles | Commands | Status | Added |
|--------|------|----------------|------------|---------|--------|-------|
| GitHub | Official | Create PRs, read issues, check CI, manage branches | All (PRs), Orchestrator (branches), QA (CI) | /mcp-connect github [action] | **inactive** | — |
| Linear | Official | Create/update issues, sync sprint status | Orchestrator, all engineers | /mcp-connect linear [action] | **inactive** | — |
| Notion | Official | Publish interpret/ docs to Notion pages | Researcher, PM | /mcp-connect notion [action] | **inactive** | — |
| Vercel | Official | Trigger deployments, check status, preview URLs | DevOps, all (preview URLs) | /mcp-connect vercel [action] | **inactive** | — |
| Supabase | Official | Run queries, manage migrations, check schema | Data Engineer, Backend | /mcp-connect supabase [action] | **inactive** | — |
| Browserbase | Official | E2E browser automation, visual regression, research scraping | QA, Researcher, Frontend | /mcp-connect browserbase [action] | **inactive** | — |

---

## How to Activate a Server

1. Read the integration guide in `mcp/integrations/[server-name].md` — see the `.mcp.json` Configuration section
2. Set the required environment variable(s) in your shell profile (`~/.zshrc` or equivalent)
3. Add the server key (lowercase) to `enabledMcpjsonServers` in `.claude/settings.json`
4. Restart Claude Code — it reads `.mcp.json` at startup
5. Test the connection (see testing protocol in the integration guide)
6. Change status in this registry from `inactive` to `active` and add the activation date

**Config files:**
- `.mcp.json` (project root) — server connection config, checked into git, uses `${ENV_VAR}` for secrets
- `.claude/settings.json` — controls which servers are enabled via `enabledMcpjsonServers`

---

## Configuration Reference

| Server | Env Var(s) | Where to Get Credentials | `.mcp.json` Key |
|--------|-----------|--------------------------|-----------------|
| GitHub | `GITHUB_TOKEN` | GitHub Settings → Developer Settings → PATs (repo scope) | `github` |
| Linear | `LINEAR_API_KEY` | Linear Settings → API → Personal API Keys | `linear` |
| Notion | `NOTION_TOKEN` | Notion Settings → Connections → Integrations | `notion` |
| Vercel | `VERCEL_TOKEN` | Vercel Account Settings → Tokens | `vercel` |
| Supabase | `SUPABASE_ACCESS_TOKEN` | Supabase Dashboard → Account → Access Tokens | `supabase` |
| Browserbase | `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID` | Browserbase Dashboard | `browserbase` |

**Security:** Set env vars in your shell profile — never paste credentials into `.mcp.json` or this file.
`.mcp.json` uses `${ENV_VAR}` syntax — the actual value is never stored in the file.

---

## Adding a Custom Server

Use `mcp/integrations/custom-server-template.md` — complete every section before adding here.
Custom servers added to the registry must have an integration guide in `mcp/integrations/`.

---

## Status Values

| Status | Meaning |
|--------|---------|
| `active` | Configured, tested, ready to use |
| `inactive` | Not yet configured — cannot be used |
| `testing` | Configuration in progress — do not rely on it |
| `deprecated` | Being replaced — do not use for new work |
