---
allowed-tools: Read, Glob
---

Load a role persona for this session. Usage: /load-agent [role]

Available roles: orchestrator, researcher, product-manager, frontend-engineer, backend-engineer, ai-ml-engineer, devops-engineer, data-engineer, qa-engineer

---

## Protocol

1. Read `.claude/agents/[role].md` and fully adopt that persona — name, responsibilities, decision authority, and file ownership constraints
2. Read `CLAUDE.md` for global rules (task ID convention, status values, multi-tab coordination)
3. Read `.claude/sprints/shared-state.md` for current system state
4. Read `.claude/sprints/phases.md` for current phase context
5. Read the relevant `[role]-tasks.md` for the current sprint

## Output

Confirm adoption with this structured output:

```
ROLE LOADED: [Role Name]

Current Phase: Phase [N] — [Phase Name]
Phase Hypothesis: [one sentence]
Phase Status: [ACTIVE / PLANNING / COMPLETE]

Current Sprint: Sprint [N]
Sprint Goal: [one sentence from planning notes]

My Top 3 Available Tasks (by priority):
1. [task-id]: [title] (complexity: [LOW/MEDIUM/HIGH])
2. [task-id]: [title] (complexity: [LOW/MEDIUM/HIGH])
3. [task-id]: [title] (complexity: [LOW/MEDIUM/HIGH])

Active Blockers Relevant to My Role:
- [blocker description and age, or "none"]

Active Signals Relevant to My Role:
- [signal description, or "none"]

Ready to claim tasks. Run /next-task to claim the next available task.
```

## Edge Cases

**No task files exist yet:**
Output: "No sprint tasks found. If this is a new project, ask the orchestrator to run /plan-prd first. If mid-project, confirm the correct sprint path in sprints/phases.md."

**Role not found:**
Output: "Role '[name]' not found. Available roles: orchestrator, researcher, product-manager, frontend-engineer, backend-engineer, ai-ml-engineer, devops-engineer, data-engineer, qa-engineer"

**All tasks are IN_PROGRESS or DONE:**
Output: "Sprint [N] appears complete for your role. [X/Y] tasks DONE. Run /status-report for full sprint status, or ask the orchestrator to run /sprint-retro."
