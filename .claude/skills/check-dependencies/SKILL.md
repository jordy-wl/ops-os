---
name: check-dependencies
description: |
  When an agent is about to claim or start a specific task, verify that all dependencies
  listed for that task are marked DONE in shared-state.md. Invoke automatically when a
  user says "I'll start [task-id]", "claiming [task-id]", or "working on [task-id]".
  Prevents wasted work built on incomplete foundations.
disable-model-invocation: false
user-invocable: true
argument-hint: "[task-id]"
allowed-tools: Read
---

# Skill: Check Dependencies

> **Task ID:** `$ARGUMENTS`

Verifies all dependencies for a task are DONE before the task is claimed.
Read-only — no changes made. Returns a green-light or a list of blockers.

---

## Protocol

### Step 1 — Parse Task ID and Find Dependencies

Read `.claude/sprints/phase-1/sprint-1/dependencies.md`.

Find the row where Task = `$ARGUMENTS`. Extract the value in the "Depends On" column.

If `$ARGUMENTS` is not found in the dependencies table:
- Check if the task ID exists at all in `shared-state.md`
- If it doesn't exist anywhere: output "Task `$ARGUMENTS` not found — check the task ID and try again."
- If the task exists but has no entry in dependencies.md: output "No dependencies registered for `$ARGUMENTS` — safe to claim."

If the "Depends On" column is empty or says "none": output the all-clear message immediately.

### Step 2 — Read Current Task Statuses

Read `.claude/sprints/shared-state.md` Active Work table.

For each dependency task ID from Step 1, look up its current Status in the Active Work table.

Build a list:
- Task ID → current Status (DONE / IN_PROGRESS / BLOCKED / REVIEW / OPEN)

### Step 3 — Evaluate Each Dependency

For each dependency:
- Status = DONE → mark as **CLEARED**
- Status = anything else → mark as **BLOCKING** (record the current status)

### Step 4 — Output Decision

**If all dependencies are CLEARED:**

```
DEPENDENCY CHECK: PASSED — [task-id]

Dependencies:
  [dep-id]: DONE — CLEARED
  [dep-id]: DONE — CLEARED

All dependencies satisfied. Safe to claim [task-id].
Run /next-task to proceed.
```

**If any dependency is BLOCKING:**

```
DEPENDENCY CHECK: BLOCKED — [task-id]

Dependencies:
  [dep-id]: DONE — CLEARED
  [dep-id]: IN_PROGRESS — BLOCKING
  [dep-id]: OPEN — BLOCKING (not yet started)

Cannot claim [task-id] — [N] dependencies not yet DONE.

Suggested alternatives:
1. Run /next-task — it will find an unblocked task for your role
2. Check shared-state.md notes to see if you can assist the blocking role
3. Log a blocker in shared-state.md if this has been waiting >4 hours
```

---

## Edge Cases

- **If the dependency itself is blocked:** Note this in the output — the whole chain may need orchestrator intervention
- **If shared-state.md cannot be read:** Output an error; do not proceed with the claim
- **If called without an argument:** Output "Usage: /check-dependencies [task-id] — provide the task ID you want to claim"
