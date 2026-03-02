# MCP Integrations

> MCP (Model Context Protocol) servers extend Claude Code's reach to external tools without leaving the workflow.
> All agents: check `mcp/server-registry.md` at session start to know what external actions are available.

---

## What MCP Is Used For Here

MCP servers let agents take external actions — creating GitHub PRs, updating Linear tickets, triggering Vercel deployments, running Supabase queries — from inside the Claude Code workflow.

**Philosophy:** Use MCP for external state changes that would otherwise require manual steps. This keeps the audit trail complete (all actions logged in `shared-state.md`) and reduces context-switching.

---

## How It Works

1. **Check registry**: Read `mcp/server-registry.md` to see what's configured and active
2. **Read integration guide**: Read `mcp/integrations/[server].md` for usage conventions
3. **Run /mcp-connect**: Use `/mcp-connect [server] [action]` to execute actions
4. **Log outcome**: All state-changing actions are logged in `shared-state.md` MCP Actions table

---

## How to Add a New MCP Server

1. Read `mcp/integrations/custom-server-template.md` — fill in every section
2. Configure the server connection (see integration guide)
3. Test the connection before marking it active
4. Add the server to `mcp/server-registry.md` with status `active`
5. Update relevant agent persona files to mention the new server
6. **Do not use a server that is not in the registry** — an undocumented server creates invisible dependencies

---

## Current Integration Philosophy

Prefer MCP for:
- Creating and updating GitHub PRs (traceability)
- Updating Linear tickets to mirror shared-state.md status
- Triggering Vercel deployments (DevOps workflow)
- Running Supabase migrations in staging (Data Engineer workflow)
- Running E2E tests via Browserbase (QA workflow)

Do NOT use MCP for:
- Actions that require human judgment (approvals, major config changes)
- Actions where the blast radius is large and not reversible (prod database deletes)
- Workarounds for access control issues — fix the access, don't bypass it

---

## Security Note

MCP servers have real access to real systems. Every action is consequential.
- All MCP actions logged in `shared-state.md` MCP Actions table
- Never use MCP to bypass permissions or approval gates
- If a server action fails unexpectedly: investigate before retrying, log in shared-state.md
- Prod database operations via Supabase MCP require explicit PM/orchestrator approval in shared-state.md

---

## Registry Status

See `mcp/server-registry.md` for current status of all servers.
All servers are inactive by default — configure before use.
