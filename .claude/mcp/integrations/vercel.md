# Vercel MCP Integration Guide

**Status:** See `mcp/server-registry.md`
**What it enables:** Deploy frontend/full-stack apps directly from agent workflows; monitor deployment health; roll back bad deploys

---

## Primary Use Case

DevOps and Orchestrator agents trigger Vercel deployments as part of the CI/CD pipeline without leaving the Claude Code session. Removes the manual step of pushing to a branch and waiting for Vercel to pick it up — deployments are triggered, monitored, and verified programmatically.

---

## What This Integration Enables

| Action | Who Uses It | When |
|--------|------------|------|
| Trigger preview deployment | DevOps / Orchestrator | After P1-S*-FE sprint tasks complete |
| Trigger production deployment | DevOps | After Gate 6 sign-off, staging smoke test passes |
| Check deployment status | Any agent | During gate evidence collection |
| List recent deployments | Orchestrator | During `/status-report` |
| Roll back to previous deployment | DevOps | On prod health-check failure |
| Read deployment logs | DevOps | On deployment failure |
| Manage environment variables | DevOps | During infrastructure setup |

---

## Deployment Workflow (Happy Path)

```
1. /mcp-connect vercel trigger-deployment
     project: [project-name]
     branch: main
     environment: preview

2. /mcp-connect vercel check-deployment
     deployment-id: [returned ID]

3. Smoke test on preview URL

4. /mcp-connect vercel promote-deployment
     deployment-id: [preview deployment ID]
     environment: production

5. /mcp-connect vercel check-deployment
     deployment-id: [production deployment ID]

6. Log deployment ID in gate-results.md as Gate 3 evidence
```

---

## Rollback Workflow

If production health-check fails:
```
1. /mcp-connect vercel list-deployments
     project: [project-name]
     environment: production
     limit: 5

2. Identify last known-good deployment ID

3. /mcp-connect vercel rollback
     deployment-id: [known-good ID]

4. Verify health-check passes

5. Log rollback action in sprints/shared-state.md → Blockers table
```

Rollback must complete within 5 minutes per DevOps standards.

---

## Environment Variables

Manage via MCP — not manually in Vercel dashboard:
```
/mcp-connect vercel set-env
  project: [project-name]
  key: [VAR_NAME]
  value: [value]
  environment: production | preview | development
```

**Caution:** Never pass secrets as literal values in command arguments. Read secrets from vault/secrets manager first, pass as variable.

---

## Gate Evidence

Deployment confirmation counts as Gate 3 (Integration Check) evidence:
```
GATE 3 — INTEGRATION CHECK
Deployment: Vercel deployment [ID] to [environment]
URL: [deployment URL]
Status: READY
Build duration: [N]s
Log: No errors in build output
```

Paste in `sprints/phase-1/sprint-1/gate-results.md`.

---

## Setting Up

1. Create a Vercel account and project
2. Generate a Vercel API token: Account Settings → Tokens
3. Note your Team ID and Project ID (from project settings)
4. Configure MCP server with token, team ID, project ID
5. Test: `/mcp-connect vercel list-projects`
6. Mark active in `server-registry.md`

---

## Caution — Production Deployments

DevOps agent must confirm Gate 6 (Peer Review) is PASS before triggering production deployment.

Do not:
- Promote to production without staging smoke test evidence
- Set environment variables in Vercel dashboard (use MCP to maintain IaC parity)
- Share deployment URLs publicly before smoke test passes

---

## `.mcp.json` Configuration

Add this block to `.mcp.json` at the project root (already present as a template):

```json
"vercel": {
  "type": "http",
  "url": "https://vercel.com/api/mcp",
  "headers": {
    "Authorization": "Bearer ${VERCEL_TOKEN}"
  }
}
```

**Required env var:** `VERCEL_TOKEN` — from Vercel Account Settings → Tokens.

**To activate:**
1. Set `VERCEL_TOKEN` in your shell profile
2. Add `"vercel"` to `enabledMcpjsonServers` in `.claude/settings.json`
3. Update registry status to `active`
