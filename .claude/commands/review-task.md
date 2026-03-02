---
allowed-tools: Read, Edit, Glob, Grep
---

Peer review command for Gate 6. Usage: /review-task [task-id]

Used by QA engineer or any peer role on HIGH complexity tasks. The reviewer's name is logged in gate-results.md — this review carries named accountability.

---

## Protocol

### Step 1 — Read Task Context
- Read the task definition in the relevant `[role]-tasks.md` file
- Note the acceptance criteria — this is what the review checks against
- Note the complexity (should be HIGH to require Gate 6)

### Step 2 — Read the Implementation
Read all files modified or created for this task. Find them by:
1. Looking in shared-state.md for notes on what files were changed
2. Checking gate-results.md for the completion summary (may list files)
3. Checking the relevant owned directories for the role (e.g. `src/api/` for backend tasks)

### Step 3 — Evaluate Against 5 Criteria

For each criterion, make a specific judgement with evidence:

**1. Maintainability**
- Would you be comfortable picking this up in 6 months with no context?
- Is the code self-explanatory or does it need comments it doesn't have?
- Are function names and variable names descriptive?
- Is the complexity proportional to the problem?

**2. Spec Compliance**
- Does the implementation match every acceptance criterion exactly?
- Are there acceptance criteria that are met partially or not at all?
- Does it match the relevant PRD section?

**3. Security**
- Any input validation gaps not caught by Gate 5?
- Any auth boundary that could be bypassed?
- Any logging of sensitive data?
- Any dependency that introduces a vulnerability?

**4. Performance at Scale**
- Any N+1 queries that will hurt at 10× current data volume?
- Any synchronous operations that should be async?
- Any memory leaks (event listeners not cleaned up, large objects held in closure)?
- Any caching opportunities that are obviously missing?

**5. Testability**
- Can the core logic be unit tested without mocking too much?
- Are there hidden side effects that make testing hard?
- Are there error paths that can't easily be tested?

### Step 4 — Determine Verdict

**PASS** — if all 5 criteria are satisfactory (no blocking issues)
**NEEDS_WORK** — if any criterion has a blocking issue

For NEEDS_WORK: list every specific issue with file path and line number where possible.
Provide at least one concrete improvement suggestion with reasoning.

### Step 5 — Log to gate-results.md

Append to the task's entry in `gate-results.md`:

```markdown
**Gate 6 — Peer Review**
Reviewer: [YOUR_ROLE]
Date: [date]
Verdict: PASS / NEEDS_WORK

Findings:
- [src/api/users.ts:42] [description of finding]
- [src/api/users.ts:87] [description of finding]

Suggested improvement:
[Specific recommendation with reasoning — not a generic comment]
```

### Step 6 — If NEEDS_WORK
1. Update the task status in `shared-state.md` back to `IN_PROGRESS`
2. Add review notes to the task definition in the task file
3. Notify the original implementer via `shared-state.md` notes section

---

## Output

**If PASS:**
```
GATE 6 REVIEW: PASS — [task-id]

Reviewer: [YOUR_ROLE]
Criteria evaluated: 5/5

Summary: [2-sentence summary of what was reviewed and why it passes]
Minor suggestions noted in gate-results.md (non-blocking).

Task is cleared for DONE status.
```

**If NEEDS_WORK:**
```
GATE 6 REVIEW: NEEDS_WORK — [task-id]

Reviewer: [YOUR_ROLE]
Blocking issues found: [N]

Issues:
1. [file:line] [description]
2. [file:line] [description]

Task returned to IN_PROGRESS.
Review notes added to task file and gate-results.md.
```
