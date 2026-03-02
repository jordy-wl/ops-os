# Linear MCP Integration Guide

**Status:** See `mcp/server-registry.md`
**What it enables:** Create and update issues, sync sprint status with external visibility

---

## What This Integration Enables

| Action | Who Uses It | When |
|--------|------------|------|
| Create project structure from sprint | Orchestrator | At /plan-prd |
| Update issue status | All engineers | When task status changes |
| Add comment on issue | All engineers | Logging blockers or decisions |
| Create cycle/sprint | Orchestrator | At sprint start |
| Read current cycle status | Orchestrator | During /sprint-retro |

---

## Source of Truth Rule

**`shared-state.md` is the source of truth — not Linear.**

Linear is a mirror for external visibility (stakeholders, PMs who prefer a visual board). When there's a conflict between Linear and `shared-state.md`, `shared-state.md` wins.

**Do not make task decisions in Linear.** Make them in `shared-state.md` and sync to Linear.

---

## Sync Protocol

| Event in shared-state.md | Linear Action |
|-------------------------|---------------|
| Task status → IN_PROGRESS | Update corresponding Linear issue to "In Progress" |
| Task status → REVIEW | Update to "In Review" |
| Task status → DONE | Update to "Done", add gate evidence summary as comment |
| New blocker logged | Add comment on Linear issue with blocker description |

**When to sync:** After each status change, not continuously. Batch updates at the end of a session if preferred.

---

## Issue Creation from Sprint Tasks

Orchestrator can create Linear project structure after /plan-prd:

```
/mcp-connect linear create-project
  name: Phase 1 — Sprint 1
  team: [team ID]

/mcp-connect linear create-issues
  [for each task in tasks.md]
  title: [task-id]: [title]
  description: [full task description]
  labels: [role code, complexity]
  priority: [based on critical path position]
```

---

## Common Workflows

### Updating Issue Status
```
/mcp-connect linear update-issue
  id: [Linear issue ID]
  status: In Progress
  comment: "Claimed by BACKEND-ENGINEER — [timestamp]"
```

### Adding Blocker Comment
```
/mcp-connect linear add-comment
  id: [Linear issue ID]
  comment: "BLOCKED: waiting for P1-S1-DE-01 (users table migration) — logged in shared-state.md"
```

### Marking Done with Evidence
```
/mcp-connect linear update-issue
  id: [Linear issue ID]
  status: Done
  comment: "All gates PASSED. Gate evidence in gate-results.md. PR: [URL]"
```

---

## Safety Constraints

**DO:**
- Mirror shared-state.md status changes to Linear
- Add context comments for stakeholder visibility

**DO NOT:**
- Create tasks in Linear that don't exist in shared-state.md
- Delete or archive Linear issues without orchestrator approval
- Change assignees in Linear without changing in shared-state.md
- Use Linear as the place to manage sprint work — that's shared-state.md

---

## Setting Up

1. Create a Linear API key: Linear Settings → API → Personal API Keys
2. Find your team ID: Linear → Settings → Teams
3. Configure MCP server with API key and team ID
4. Test: `/mcp-connect linear list-issues`
5. Mark active in server-registry.md

---

## `.mcp.json` Configuration

Add this block to `.mcp.json` at the project root (already present as a template):

```json
"linear": {
  "type": "http",
  "url": "https://mcp.linear.app/mcp",
  "headers": {
    "Authorization": "Bearer ${LINEAR_API_KEY}"
  }
}
```

**Required env var:** `LINEAR_API_KEY` — from Linear Settings → API → Personal API Keys.

**To activate:**
1. Set `LINEAR_API_KEY` in your shell profile
2. Add `"linear"` to `enabledMcpjsonServers` in `.claude/settings.json`
3. Update registry status to `active`
