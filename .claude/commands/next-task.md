---
allowed-tools: Read, Glob
---

Agent command: claim the next available task for your role. Must be run after /load-agent.

---

## Protocol

### Step 1 — Read Current State
- Read `sprints/shared-state.md` — full current state
- Read your role's task file for the current sprint (`sprints/[phase]/[sprint]/[role]-tasks.md`)
- Read `sprints/[phase]/[sprint]/dependencies.md` — dependency map

### Step 2 — Identify Available Tasks
A task is available to claim if ALL of these are true:
1. Status is `OPEN` in shared-state.md
2. All dependencies are `DONE` (check dependency list in the task)
3. Not already assigned to another role in `shared-state.md`

Sort available tasks by priority:
- Priority 1: Tasks that other roles are explicitly waiting on (check dependencies.md)
- Priority 2: Tasks marked HIGH complexity (more value, get them done early)
- Priority 3: Tasks by order in the task file

### Step 3 — Claim the Task
Update `shared-state.md` active work table:
```
| [task-id] | [title] | [YOUR_ROLE] | IN_PROGRESS | [tab/session] | [timestamp] | |
```

### Step 4 — Output Task Details
```
TASK CLAIMED: [task-id]

Title: [Task Title]
Complexity: [LOW / MEDIUM / HIGH]
Estimate: [N days]

Description:
[Full task description]

Acceptance Criteria:
- [ ] [criterion 1]
- [ ] [criterion 2]

Applicable Quality Gates: [list gate numbers]
Dependencies: [task IDs or "none"]

Relevant PRD Sections to Read:
- [prd/XX-section.md — what's relevant about this task]

Ready to begin. When complete, run /complete-task [task-id].
```

### Step 5 — Read PRD Context
Before starting work, read the PRD sections relevant to this task. They were listed in Step 4.

---

## Edge Cases

**All tasks are BLOCKED:**
```
All tasks for your role are currently blocked. Active blockers:
- [task-id]: blocked by [task-id / reason] — [N days old]

Options:
1. Help unblock: check if you can assist the blocking role
2. Ask orchestrator to reassign or reorder if blocker is external
3. Run /status-report to see if there are cross-role tasks you can assist with
```

**All tasks are IN_PROGRESS:**
```
All tasks for your role are currently IN_PROGRESS.
Either: you have claimed them all, or another session is working on them.
Run /status-report for full sprint status.
If sprint is complete, ask orchestrator to run /sprint-retro.
```

**No task files exist:**
```
No sprint task files found for your role.
Ask the orchestrator to run /plan-prd to generate the sprint structure.
```
