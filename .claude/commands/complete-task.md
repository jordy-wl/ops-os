---
allowed-tools: Read, Edit, Bash
---

Enforced task completion command. Usage: /complete-task [task-id]

A task cannot reach DONE status without gate evidence logged in gate-results.md. This command enforces that protocol.

---

## Protocol

### Step 1 — Confirm Task Identity
State the task ID and a 2-sentence summary of what was built.

### Step 2 — Determine Applicable Gates
Read the task definition in the task file. Identify which gates apply to this task.
Refer to `.claude/standards/quality-gates.md` for the full gate evidence requirements.

### Step 3 — Run Each Applicable Gate
For each applicable gate, IN SEQUENCE:

**Do not skip gates. Do not assume a gate passes. Run the actual check.**

- Gate 1 (Code Quality): run linter, run TODO scan, run secrets scan — paste real output
- Gate 2 (Testing): run test suite with coverage — paste real output
- Gate 3 (Integration Check): make real requests — paste actual curl/test output
- Gate 4 (Frontend Quality): check all 4 breakpoints and UI states — paste checklist
- Gate 5 (Security Baseline): run security checks — paste real output
- Gate 6 (Peer Review): if HIGH complexity — another agent must run /review-task

### Step 4 — If Any Gate Fails
```
GATE [N] FAILED: [description of failure]

Status remains IN_PROGRESS.
Reason: [specific failure]
Fix required: [what needs to change]

I will fix the issue and re-run this gate before proceeding.
```
Fix the issue. Re-run the failed gate. Do not proceed to the next gate until the current one passes.

### Step 5 — After All Gates Pass
Write gate evidence to `sprints/[phase]/[sprint]/gate-results.md`:

```markdown
## [task-id]: [Task Title]

**Completed by:** [ROLE]
**Date:** [date]
**Complexity:** [LOW/MEDIUM/HIGH]

### Gate Evidence

**Gate 1 — Code Quality**
[paste evidence]

**Gate 2 — Testing**
[paste evidence]

**Gate 3 — Integration Check** (if applicable)
[paste evidence]

**Gate 4 — Frontend Quality** (if applicable)
[paste evidence]

**Gate 5 — Security Baseline**
[paste evidence]

**Gate 6 — Peer Review** (if HIGH complexity)
[paste evidence]

### Completion Summary
**What was built:** [1 sentence]
**What was validated:** [1 sentence]
**Spec deviations:** [none / description of deviation]

### Signals Raised
[List any SIGNAL entries written to build-learnings.md, or "none"]
```

### Step 6 — Update shared-state.md
Move task from `IN_PROGRESS` to `DONE` in the active work table.
Check if any BLOCKED tasks become unblocked — update those to OPEN.

### Step 7 — Check for PRD Deviations
If anything differed from the PRD spec:
1. Write a SIGNAL entry in `research/signals/build-learnings.md`
2. Note the deviation in the gate-results.md completion summary

---

## Output
```
TASK COMPLETE: [task-id]

Title: [Task Title]
All applicable gates: PASSED
Gate evidence: logged in gate-results.md

shared-state.md: updated to DONE
Signals raised: [count or "none"]
Tasks unblocked by this completion: [list or "none"]

Next: run /next-task to claim next available task.
```
