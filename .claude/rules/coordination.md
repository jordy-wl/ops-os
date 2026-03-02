# Coordination Rules

> Unconditional — loads for every agent in every session.

---

## Session Start Protocol
Before doing any work, read in order:
1. `sprints/shared-state.md` — current state, blockers, signals queue
2. `sprints/phases.md` — current phase hypothesis and exit conditions
3. Your role-specific task file for the current sprint

If no task files exist yet: run `/plan-prd` (orchestrator) or ask orchestrator to generate them.

---

## Task Claiming
- Before starting any task: update its status to `IN_PROGRESS` in `shared-state.md`
- Record: task ID, your role, timestamp, which session tab you are
- Never work on a task already marked `IN_PROGRESS` by another role
- If all tasks are claimed: output sprint status and suggest `/sprint-retro`

## Task ID Format
`P{phase}-S{sprint}-{ROLE}-{NUM}`
- Example: `P1-S2-BE-04` = Phase 1, Sprint 2, Backend Engineer, Task 04
- Role codes: `ORC` `RES` `PM` `FE` `BE` `AI` `OPS` `DE` `QA`

---

## Status Values
| Status | When to use |
|--------|-------------|
| `OPEN` | Task available, no one working on it |
| `IN_PROGRESS` | You have claimed this task |
| `BLOCKED` | Cannot proceed — log reason in blockers table immediately |
| `REVIEW` | Implementation complete, Gate 6 peer review needed |
| `DONE` | All applicable gates passed, evidence in gate-results.md |

---

## Blocker Protocol
When you hit a blocker:
1. Log it in `shared-state.md` blockers table **immediately** — not at end of session
2. Include: your task ID, blocking task or reason, timestamp, has it been escalated (Y/N)
3. Move to the next available OPEN task — never sit idle on a blocker
4. Blockers over 48 hours: orchestrator must intervene

When a blocker is resolved:
1. Update blocker status in shared-state.md
2. Add note: resolved by whom, how, timestamp
3. Re-claim the blocked task if it is now unblocked

---

## Completion Protocol
1. Work through every applicable gate from `standards/quality-gates.md`
2. For each gate: run the actual check, paste real output into `gate-results.md`
3. If any gate fails: status stays `IN_PROGRESS`, fix the issue, re-run
4. Only after ALL gates pass: update `shared-state.md` to `DONE`
5. Write 3-sentence summary in `gate-results.md` (what was built, what was validated, any deviations)
6. If anything differed from PRD spec: write SIGNAL entry in `research/signals/build-learnings.md`

---

## Signals
- Log PRD deviations to `research/signals/build-learnings.md` **during the task**, not after
- Two or more entries challenging the same assumption = strong signal, auto-flags for researcher
- Never silently deviate from spec — log it
- Any API contract mismatch: update `prd/05-api-contracts.md` first, then log signal

---

## File Ownership
Never edit files owned by another role without explicit coordination.
Check the ownership table in `CLAUDE.md` before editing any file.
When in doubt: log a signal in `shared-state.md` and ask.

---

## Multi-Tab Rules
- One agent per tab — maintain your role persona for the entire session
- `shared-state.md` is the only shared coordination channel
- If you see a conflict between what you expect and what shared-state shows: shared-state wins
- Announce large file changes in shared-state.md notes so other tabs know
