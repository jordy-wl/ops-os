---
allowed-tools: Read
---

Protocol for using MCP servers. Usage: /mcp-connect [server-name] [action]

Examples:
- /mcp-connect github create-pr
- /mcp-connect linear update-status P1-S1-BE-04 done
- /mcp-connect vercel deploy staging
- /mcp-connect supabase run-migration 20240101-120000

---

## Protocol

### Step 1 — Verify Server Registration
Read `.claude/mcp/server-registry.md`.
Confirm the server exists and its status is `active`.

If not found: "Server '[name]' not in registry. Add it using `.claude/mcp/integrations/custom-server-template.md` first."
If status is `inactive`: "Server '[name]' is registered but inactive. Configure it before use."

### Step 2 — Read Integration Guide
Read `.claude/mcp/integrations/[server-name].md` for:
- What this integration enables
- Usage conventions and workflow
- What NOT to use it for (safety constraints)

### Step 3 — Execute the Action
Use the MCP server's tools to perform the requested action.
Follow the conventions in the integration guide exactly.

### Step 4 — Log Outcome in shared-state.md
If the action changes project state, log it:
```
MCP ACTION — [date] — [server]
Action: [what was done]
Outcome: [result — PR URL, deployment ID, issue link, etc.]
Task ID: [task-id if action relates to a task]
Agent: [ROLE]
```

Log all of these:
- GitHub PR created
- Linear ticket created or updated
- Vercel deployment triggered (include deployment ID)
- Supabase migration applied (include migration name)

---

## Safety Constraints by Server

**GitHub:** Create PRs, read issues, check CI status. Do NOT: force push, delete branches, close PRs on behalf of others.

**Linear:** Create and update issues, sync status. Do NOT: delete projects, change other agents' ticket assignments without coordination.

**Notion:** Publish interpret/ docs to Notion pages. Do NOT: overwrite pages that aren't owned by this system.

**Vercel:** Trigger deploys, check deploy status, get preview URLs. Do NOT: change production environment variables without DevOps role involvement.

**Supabase:** Run migrations (staging only unless explicitly authorised for prod), run read queries, check schema. Do NOT: run DELETE or DROP on production without named PM/orchestrator approval logged in shared-state.md.

**Browserbase:** Run E2E tests, capture screenshots for QA. Do NOT: scrape competitor sites in ways that violate ToS. Ethical scraping only.

---

## Error Handling

If an MCP action fails:
1. Note the exact error
2. Check if it's a configuration issue (server not configured correctly) or a permission issue
3. For permission issues: escalate to orchestrator before retrying
4. Log the failure in `shared-state.md` notes

Do NOT retry the same failed action more than once without diagnosing the root cause.
