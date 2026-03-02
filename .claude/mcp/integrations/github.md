# GitHub MCP Integration Guide

**Status:** See `mcp/server-registry.md`
**What it enables:** Create PRs, read issues, check CI status, manage branches

---

## What This Integration Enables

| Action | Who Uses It | When |
|--------|------------|------|
| Create PR for completed task | All engineers | After /complete-task passes all gates |
| Check CI status on a branch | All engineers | After pushing changes |
| Read linked issues | Orchestrator, PM | During sprint planning |
| List open PRs for review | QA Engineer | Session start |
| Create a branch | Orchestrator | When starting a new feature area |
| Check PR review status | All engineers | When waiting for review |

---

## Conventions

### Branch Naming
Branches must match the task ID:
```
feature/P1-S1-BE-01-auth-endpoints
fix/P1-S1-FE-03-login-form-validation
```

### PR Description Template
```markdown
## Summary
Closes P1-S1-BE-01

**What was built:** [1-2 sentences]

**Gate evidence:**
- Gate 1 (Code Quality): PASS
- Gate 2 (Testing): PASS — coverage X%
- Gate 3 (Integration): PASS — see gate-results.md
- Gate 5 (Security): PASS

**API contract:** [No changes / Updated prd/05-api-contracts.md — see CHANGELOG]
```

### PR Linking to Tasks
After creating a PR: add the PR URL to the task in `shared-state.md` notes column.

---

## Common Workflows

### Creating a PR After Task Completion
```
/mcp-connect github create-pr
  branch: feature/P1-S1-BE-01-auth-endpoints
  title: feat(auth): implement JWT login and refresh endpoints
  body: [use PR template above]
  base: main
```

### Checking CI Status
```
/mcp-connect github check-ci
  branch: feature/P1-S1-BE-01-auth-endpoints
```

### Reading Issues for Sprint Context
```
/mcp-connect github list-issues
  label: sprint-1
  state: open
```

---

## Safety Constraints

**DO:**
- Create PRs for completed tasks
- Read issues and PR statuses
- Check CI status
- Create branches following the naming convention

**DO NOT:**
- Force push (`git push --force`) — use this integration
- Delete branches that have open PRs
- Close PRs on behalf of others without their explicit request
- Merge PRs via MCP — merges should be human-reviewed in the GitHub UI

---

## Setting Up This Integration

1. Create a GitHub Personal Access Token with scopes: `repo`, `read:org` (if needed)
2. Store in your secrets manager — never in code
3. Configure the MCP server with the token
4. Test: `/mcp-connect github list-issues state:open`
5. If it returns a list: mark `active` in server-registry.md

---

## Logging Protocol

After every GitHub action, log in `shared-state.md` MCP Actions table:
```
| [date] | GitHub | Created PR #[N] for [task-id] | PR URL: [url] | [task-id] | [ROLE] |
```

---

## `.mcp.json` Configuration

Add this block to `.mcp.json` at the project root (already present as a template):

```json
"github": {
  "type": "http",
  "url": "https://api.githubcopilot.com/mcp/",
  "headers": {
    "Authorization": "Bearer ${GITHUB_TOKEN}"
  }
}
```

**Required env var:** `GITHUB_TOKEN` — a Personal Access Token with `repo` scope (and `read:org` if your repo is in an org).

**To activate:**
1. Set `GITHUB_TOKEN` in your shell profile (`~/.zshrc` or `~/.bash_profile`)
2. Add `"github"` to `enabledMcpjsonServers` in `.claude/settings.json`
3. Update registry status to `active`
