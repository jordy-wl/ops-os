---
name: generate-gate-evidence
description: |
  When an agent has finished implementing a task and needs to log quality gate evidence,
  generate a pre-filled evidence template for that task's applicable gates only. Invoke
  automatically when a user says "I've finished [task]", "ready to log gates", "completing
  [task-id]", or asks which gates apply to their task. Eliminates manual template construction.
disable-model-invocation: false
user-invocable: true
argument-hint: "[task-id]"
allowed-tools: Read
---

# Skill: Generate Gate Evidence

> **Task ID:** `$ARGUMENTS`

Outputs a pre-filled evidence template for the applicable gates of this specific task.
Copy the output into `gate-results.md` and fill in the bracket placeholders with real
evidence before marking the task DONE.

---

## Protocol

### Step 1 — Find Task Definition

Read the role task file for this task. Derive the path from the task ID:
- `P1-S1-FE-*` → `.claude/sprints/phase-1/sprint-1/frontend-tasks.md`
- `P1-S1-BE-*` → `.claude/sprints/phase-1/sprint-1/backend-tasks.md`
- `P1-S1-AI-*` → `.claude/sprints/phase-1/sprint-1/ai-ml-tasks.md`
- `P1-S1-OPS-*` → `.claude/sprints/phase-1/sprint-1/devops-tasks.md`
- `P1-S1-DE-*` → `.claude/sprints/phase-1/sprint-1/data-tasks.md`
- `P1-S1-QA-*` → `.claude/sprints/phase-1/sprint-1/tasks.md`

Find the section for `$ARGUMENTS`. Extract:
- Task title
- Applicable Gates (list of gate numbers)
- Complexity (LOW / MEDIUM / HIGH)
- Assigned Role

### Step 2 — Output Evidence Header

Output this header first:

```
---
## [task-id]: [Task Title]

**Completed by:** [ROLE from task definition]
**Date:** [TODAY in YYYY-MM-DD format]
**Complexity:** [LOW/MEDIUM/HIGH]

### Gate Evidence
```

### Step 3 — Output Templates for Applicable Gates

For each gate number in the Applicable Gates list, output the corresponding template
from `templates/gate-N.md` where N is the gate number (1-6).

Output gates in ascending order (1, 2, 3, 4, 5, then 6 last).

If Complexity = HIGH: always output the Gate 6 template last, even if it wasn't in
the Applicable Gates list (HIGH tasks always require peer review).

**Critical rule:** Output ONLY the templates for applicable gates. Do not output all 7
gates — only the ones this task needs.

### Step 4 — Output Completion Summary Template

Always append the completion summary template from `templates/completion-summary.md`.

### Step 5 — Output Instructions

After the template, output:

```
--- END TEMPLATE ---

Instructions:
1. Run each applicable gate check (commands in .claude/standards/quality-gates.md)
2. Replace every [bracket placeholder] with real output — never leave placeholders
3. Copy completed evidence into .claude/sprints/phase-1/sprint-1/gate-results.md
4. If any gate FAILS: fix the issue, re-run, do not mark DONE until it passes
5. Update shared-state.md: change task status to DONE (or REVIEW if Gate 6 pending)
6. Run /handoff [task-id] to notify other roles of the completion
```

---

## Output Format

```
GATE EVIDENCE TEMPLATE: [task-id] — [Task Title]

Applicable gates: [list]
[If HIGH: "HIGH complexity — Gate 6 peer review required. Run /review-task [task-id] from QA or peer role."]

--- COPY EVERYTHING BELOW INTO gate-results.md ---

[full pre-filled template output]

--- END TEMPLATE ---

[Instructions block]
```

---

## Edge Cases

- **If task ID not found:** "Task `$ARGUMENTS` not found in task files — check the task ID format (e.g., P1-S1-BE-02)"
- **If Applicable Gates field is missing from task definition:** Default to Gates 1 and 5 (minimum for all tasks)
- **If called without argument:** "Usage: /generate-gate-evidence [task-id]"
