---
disable-model-invocation: true
allowed-tools: Read, Edit
---

PM/Orchestrator command for roadmap changes. Usage: /adjust-roadmap [mode]

Modes: phase-complete [N] | replan | deprioritise [area] | accelerate [area]

---

## Protocol — All Modes (Required First Steps)

Before making ANY change, read these documents in full:
1. `roadmap/ROADMAP.md` — current roadmap
2. `sprints/phases.md` — phase hypotheses and exit conditions
3. `sprints/shared-state.md` — current sprint state
4. `research/signals/build-learnings.md` — PENDING signals
5. `prd/CHANGELOG.md` — recent PRD changes

**State what is changing and why BEFORE making any change.**
Every roadmap change requires a written justification that references evidence (signals, exit conditions, business context).

---

## Mode: phase-complete [N]

### Protocol
1. Read all `gate-results.md` entries for phase [N]
2. Evaluate each exit condition for phase [N] from `sprints/phases.md`:
   ```
   Exit Condition: [statement]
   Status: MET / NOT MET / PARTIAL
   Evidence: [what was built and measured]
   Rationale: [why this counts as met or not met]
   ```
3. If all exit conditions are MET:
   - Update phase [N] status to `COMPLETE` in `sprints/phases.md`
   - Update phase [N+1] status to `ACTIVE`
   - Generate sprint task files for phase [N+1] sprint 1 (full `/plan-prd` for new phase)
   - Write `sprints/phase-[N]/transition-brief.md`
4. If exit conditions are NOT MET:
   - Document what's missing
   - Propose extension or scope change — do not close the phase without explicit PM approval
5. Log in `roadmap/changelog.md`

### Transition Brief Template
```markdown
# Phase [N] → Phase [N+1] Transition Brief

**Phase [N] closed:** [date]
**Exit conditions met:** [list with evidence]

## What Changed vs. Original Plan
- [area]: [what changed and why]

## What Each Role Carries Forward
- Frontend: [key decisions, patterns established, tech debt accepted]
- Backend: [same]
- Data: [same]
- DevOps: [same]
- AI/ML: [same, if applicable]

## Phase [N+1] Focus
- Goal: [one sentence]
- What we're proving: [hypothesis]
- First sprint priorities: [top 3 across roles]
```

---

## Mode: replan

### Protocol
1. Show the BEFORE phase structure: all phases with hypotheses
2. State the trigger for replanning (what signal or event warranted this)
3. Propose the AFTER phase structure: what changes and why
4. Get PM confirmation before applying
5. On confirmation:
   - Update `sprints/phases.md`
   - Update `roadmap/ROADMAP.md`
   - Flag any in-flight sprint tasks affected
   - Update `shared-state.md` with signal about the replan

---

## Mode: deprioritise [area]

### Protocol
1. State the area being deprioritised and the current phase it was in
2. State the reason with evidence (signal source, business context)
3. List affected tasks (by task ID) that will be removed or deferred
4. Propose which phase or sprint they move to, or "cut from roadmap"
5. On PM confirmation:
   - Update `roadmap/ROADMAP.md` roadmap areas table
   - Update affected task files (mark deferred tasks or remove them)
   - Log in `roadmap/changelog.md`

---

## Mode: accelerate [area]

### Protocol
1. State the area being accelerated and its current phase
2. State the reason (strategic opportunity, competitive signal, user feedback)
3. Identify which tasks need to move earlier and what gets pushed out to compensate (scope trade-off)
4. On PM confirmation:
   - Update `roadmap/ROADMAP.md`
   - Update `sprints/phases.md` for the affected phases
   - Regenerate affected sprint task files if tasks move to an active sprint
   - Log in `roadmap/changelog.md`

---

## Changelog Entry Format

Every roadmap change must be logged BEFORE the change takes effect:

```markdown
| [date] | [change-type] | [what changed: before → after] | [trigger] | [approved-by] | [downstream effects] |
```

Change types: `phase-added` / `phase-modified` / `phase-closed` / `area-reprioritised` / `exit-condition-updated` / `scope-changed`

**The changelog is append-only — never edit existing entries.**
