---
name: review-queue
description: |
  Scan shared-state.md for HIGH complexity tasks in REVIEW status and generate a
  prioritized peer review queue with gate evidence status for each. Invoke automatically
  when the QA engineer loads their persona, or when a user asks "what needs reviewing",
  "what's in review", or "do I have any Gate 6 tasks to review".
disable-model-invocation: false
user-invocable: true
allowed-tools: Read
---

# Skill: Review Queue

Scans for tasks needing Gate 6 peer review and outputs a prioritized queue.
Also checks that Gates 1-5 evidence is present before listing a task as ready for review.

---

## Protocol

### Step 1 — Scan for REVIEW Status Tasks

Read `.claude/sprints/shared-state.md` Active Work table.

Extract all rows where Status = REVIEW.
Also note any rows where Status = IN_PROGRESS and the Notes column mentions "HIGH" or
"Gate 6 required" — these will need review when they finish.

### Step 2 — Confirm HIGH Complexity

For each task found in Step 1, read the appropriate role task file (derive from task ID).

Confirm Complexity = HIGH. If a REVIEW task is MEDIUM or LOW, flag it as a potential
process error (Gate 6 should not be blocking lower-complexity tasks).

### Step 3 — Check Gate 1-5 Evidence

Read `.claude/sprints/phase-1/sprint-1/gate-results.md`.

For each REVIEW task, check whether its gate evidence section exists in gate-results.md.
Look for the section header `## [task-id]:`.

If the section exists: check that there are no placeholder texts `[paste...]` left
unfilled (these indicate incomplete evidence).

If the section doesn't exist OR has unfilled placeholders: mark the task as
"Not ready for Gate 6 — Gate 1-5 evidence incomplete". Do NOT include it in the ready queue.

### Step 4 — Read Dependencies for Priority Ordering

Read `.claude/sprints/phase-1/sprint-1/dependencies.md`.

For each ready-to-review task, check the "Blocks" column — how many tasks are waiting
on this task completing? Higher number = higher priority for review.

### Step 5 — Output Prioritized Queue

Order ready tasks by: (1) tasks blocking the most downstream work, (2) oldest last-updated.

---

## Output Format

```
REVIEW QUEUE — [date]

READY FOR GATE 6 REVIEW:
[N] tasks ready — ordered by downstream impact

1. [task-id]: [Task Title]
   Role: [ROLE] | Updated: [date] | Blocks: [N downstream tasks]
   Gate 1-5 evidence: PRESENT
   Command: /review-task [task-id]

2. [task-id]: [Task Title]
   Role: [ROLE] | Updated: [date] | Blocks: [N downstream tasks]
   Gate 1-5 evidence: PRESENT
   Command: /review-task [task-id]

NOT READY (incomplete gate evidence):
  [task-id]: Missing Gate [N] evidence — return to IN_PROGRESS until complete

PROCESS ERRORS:
  [task-id]: in REVIEW but not HIGH complexity — check if Gate 6 was correctly applied

UPCOMING HIGH TASKS (not yet in REVIEW):
  [task-id]: [status] — HIGH complexity, will need Gate 6 when complete

Total ready for review: [N]
Total upcoming: [N]
```

---

## Edge Cases

- **If no tasks are in REVIEW:** Output "No tasks currently in REVIEW status. Check back after HIGH complexity tasks complete."
- **If gate-results.md doesn't exist yet:** Note that no evidence has been logged yet — tasks cannot be in REVIEW without evidence
- **If all REVIEW tasks have incomplete gate evidence:** Output that finding clearly — the implementers need to complete their gates before peer review begins
