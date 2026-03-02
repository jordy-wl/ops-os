---
disable-model-invocation: true
allowed-tools: Read, Write, Edit
---

End-of-sprint review command. Run as orchestrator persona.

---

## Protocol

### Step 1 — Audit Gate Evidence
Read all entries in `sprints/[phase]/[sprint]/gate-results.md`.

For every task marked `DONE` in `shared-state.md`:
- Verify gate evidence exists in `gate-results.md`
- Verify evidence is real (not placeholder text)
- Verify Gate 6 evidence exists for every HIGH complexity task

```
EVIDENCE AUDIT:
Task [ID]: DONE — evidence [PRESENT / MISSING]
Task [ID]: DONE — evidence [PRESENT / MISSING]
...
Tasks with missing evidence: [list — these are NOT truly DONE]
```

Any task without evidence: return to `IN_PROGRESS` in `shared-state.md` and note reason.

### Step 2 — Sprint Metrics
Calculate:
- Completion rate: DONE tasks / total tasks
- Blocker patterns: which roles had the most blockers, what type of blockers
- Gate failure patterns: which gates failed most, why
- Complexity distribution: LOW/MEDIUM/HIGH task breakdown

### Step 3 — Process Build Signals
Read `research/signals/build-learnings.md` for signals from this sprint.

Determine for each signal:
- Is it strong enough to trigger `/evolve-prd`?
- Are multiple signals pointing at the same PRD assumption?

If strong signals exist: flag for researcher with recommendation to run `/evolve-prd signals`.

### Step 4 — Evaluate Phase Exit Conditions
Read `sprints/phases.md` for the current phase's exit conditions.

For each exit condition:
```
Exit condition: [statement]
Status: MET / NOT MET / PARTIAL
Evidence from this sprint: [what was built/measured]
Remaining gap: [what's still needed, or "none"]
```

If ALL exit conditions are MET: recommend running `/adjust-roadmap phase-complete [N]`.

### Step 5 — Generate Next Sprint Task Files
Based on:
- Tasks that remain OPEN or IN_PROGRESS from this sprint
- New tasks identified in phases.md for the next sprint
- Any new work required by build-learning signals

Generate:
- `sprints/[phase]/sprint-[N+1]/tasks.md`
- `sprints/[phase]/sprint-[N+1]/[role]-tasks.md` for each relevant role
- `sprints/[phase]/sprint-[N+1]/dependencies.md`
- Initialise these tasks as OPEN in `shared-state.md`

### Step 6 — Write Retro Notes
Write `sprints/[phase]/sprint-[N]/retro-notes.md`:

```markdown
# Sprint [N] Retrospective

**Date:** [date]
**Completion Rate:** [X/Y tasks, Z%]
**Conducted by:** ORCHESTRATOR

## What Went Well
- [specific things that worked]

## What Was Harder Than Expected
- [specific challenges and why they were harder]
- [what we'd do differently]

## Build Signals Generated This Sprint
- [count] total signals
- [count] PENDING for researcher
- [key themes]

## Phase Exit Condition Status
- Condition 1: [MET / NOT MET / PARTIAL]
- Condition 2: [MET / NOT MET / PARTIAL]

## Next Sprint Priorities
- [top 3 cross-role priorities and why]
- [any dependencies that must be resolved first]

## What the Next Sprint Must Account For
- [specific technical debt to address]
- [specific PRD risks to watch]
- [specific coordination needs between roles]
```

### Step 7 — Update shared-state.md
- Archive completed sprint tasks (move to "Recently Completed")
- Refresh active work table with new sprint tasks (all OPEN)
- Clear resolved blockers
- Update phase/sprint header

---

## Output
```
SPRINT RETRO COMPLETE: Sprint [N]

Completion Rate: [X/Y tasks, Z%]
Gate evidence: [X] tasks with full evidence, [Y] missing evidence (returned to IN_PROGRESS)
Signals: [N] generated, [N] flagged for researcher
Phase exit conditions: [N/M met]

Phase [N] recommendation: [READY TO CLOSE / needs more work — X conditions unmet]

Next sprint: Sprint [N+1] task files generated
  - [N] tasks across [M] roles
  - Critical path: [longest dependency chain]

Files written:
- sprints/[phase]/sprint-[N]/retro-notes.md
- sprints/[phase]/sprint-[N+1]/tasks.md + role task files
```
