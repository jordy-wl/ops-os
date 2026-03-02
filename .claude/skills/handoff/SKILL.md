---
name: handoff
description: |
  After a task is marked DONE, identify all tasks that are now fully unblocked by this
  completion and notify the relevant roles in shared-state.md notes. Also updates any
  BLOCKED tasks to OPEN if all their dependencies are now satisfied. Invoke automatically
  when a user marks a task as DONE or says "I've completed [task-id]".
disable-model-invocation: false
user-invocable: true
argument-hint: "[completed-task-id]"
allowed-tools: Read, Edit
---

# Skill: Handoff

> **Completed task:** `$ARGUMENTS`

Runs automatically after a task is marked DONE. Finds which tasks just became
fully unblocked, updates their status in shared-state.md, and writes a handoff
note so agents in other tabs see the work available at their next session start.

---

## Protocol

### Step 1 — Find Downstream Tasks

Read `.claude/sprints/phase-1/sprint-1/dependencies.md`.

Find all tasks where the "Depends On" column contains `$ARGUMENTS`. These are the
tasks that were waiting — at least partially — on the completed task.

Also check the "Blocks" column for `$ARGUMENTS` directly — this is the same lookup
from the other direction.

Build a list of candidate tasks: all tasks that listed `$ARGUMENTS` as a dependency.

### Step 2 — Check Full Unblocking

For each candidate task, read ALL of its dependencies from the "Depends On" column.

Read `.claude/sprints/shared-state.md` to check the current Status of each dependency.

A task is **fully unblocked** only if ALL its dependencies are now DONE (including
the task we just completed).

A task is **partially unblocked** if some dependencies are DONE but at least one
is still in progress or not started.

### Step 3 — Update Status in shared-state.md

For each fully unblocked task:
- If current Status = BLOCKED: change to OPEN
- If current Status = OPEN: leave as-is (already available)
- If current Status = IN_PROGRESS: leave as-is (already being worked on)

Record how many status changes were made.

### Step 4 — Write Handoff Note

In the Notes table of shared-state.md, add one row using this format:

```
| [TODAY] | [ROLE from task-id] | HANDOFF: [completed-task-id] DONE. Unblocked: [list of task-ids]. [ROLE1], [ROLE2]: your tasks are ready — run /check-dependencies [task-id] before claiming. |
```

Extract the completing role from the task ID role code (e.g., P1-S1-BE-05 → BE → Backend).
Extract the owning role for each unblocked task the same way.

If no tasks were fully unblocked: write a shorter note:
```
| [TODAY] | [ROLE] | [completed-task-id] DONE. No tasks fully unblocked yet (other dependencies still pending). |
```

---

## Output Format

```
HANDOFF COMPLETE: [completed-task-id]

Tasks now fully unblocked:
  [task-id] ([ROLE]): all dependencies DONE — OPEN and ready to claim
  [task-id] ([ROLE]): all dependencies DONE — OPEN and ready to claim

Tasks partially unblocked (still waiting on other deps):
  [task-id]: waiting on [remaining-dep-ids] ([their current statuses])

Status updates applied: [N] tasks moved BLOCKED → OPEN
Handoff note written to shared-state.md notes.

Roles that now have available work: [list]
```

---

## Edge Cases

- **If $ARGUMENTS is not in dependencies.md:** Output "No downstream tasks registered for [task-id] — no handoff needed."
- **If the completed task is not marked DONE in shared-state.md:** Warn that the task should be marked DONE first before running handoff
- **If called without an argument:** Output "Usage: /handoff [task-id] — provide the task ID that was just completed"
