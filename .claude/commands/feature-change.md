---
disable-model-invocation: true
allowed-tools: Read, Edit
---

Controlled feature modification command. Usage: /feature-change [feature description]

Impact analysis FIRST. Changes SECOND. No silent modifications — full audit trail required.

---

## Protocol

### Step 1 — Impact Analysis (ALWAYS BEFORE ANY CHANGE)

Read the following before proposing anything:
- All PRD documents that could be affected
- `sprints/shared-state.md` — which tasks are in-flight
- `sprints/phases.md` — which phase is active and its exit conditions
- `roadmap/ROADMAP.md` — where this feature sits in the roadmap
- `sprints/[phase]/[sprint]/dependencies.md` — dependency chain

**Produce an impact summary:**

```
IMPACT ANALYSIS: [feature description]

PRD Documents Affected:
- prd/[doc].md — Section: [section] — [what changes]
- prd/[doc].md — Section: [section] — [what changes]

In-Flight Tasks Affected:
- [task-id] — [title] — Status: [status] — [how this change affects it]
- [task-id] — [title] — Status: [status] — [how this change affects it]

Roles Affected:
- [ROLE]: [what they need to change]
- [ROLE]: [what they need to change]

Dependency Chain Impact:
- Tasks that depend on affected tasks: [list]

Phase Exit Condition Impact:
- [exit condition]: [AFFECTED / UNAFFECTED] — [reason]

New Tasks Required:
- [description of new work] — estimated [N days] — [ROLE]

Roadmap Impact:
- [NONE / phase extension needed / scope change to area X]
```

### Step 2 — Confirmation Gate

Output the impact analysis and STOP.

```
Impact analysis complete. Proceeding will make the following changes:

[summary of impact analysis]

Confirm to proceed? (This requires PM approval for roadmap changes.)
```

Do not make any changes until confirmation is received.

### Step 3 — Apply Changes (after confirmation)

In this order:

1. **Update PRD documents** — show BEFORE/AFTER/REASON for each change
2. **Update `prd/CHANGELOG.md`** — one entry per PRD document changed
3. **Add SIGNAL to `shared-state.md`** — all agents see it: "Feature change: [description] — see CHANGELOG"
4. **Flag affected IN_PROGRESS tasks** — change status to `BLOCKED` with reason: "Feature change — review required"
5. **Generate new tasks** (if the change creates new work) — add to task files and shared-state.md
6. **Update roadmap** (if phase scope changed) — requires PM sign-off, log in `roadmap/changelog.md`

### Step 4 — Notify Affected Roles

Write a summary note in `shared-state.md` notes section:
```
FEATURE CHANGE SIGNAL — [date]
Change: [description]
Affected roles: [list]
Affected tasks: [list of task IDs]
PRD changes: [docs changed]
Action required by each role: [what they need to review]
```

---

## Audit Trail Requirements

After a feature change, the following must exist:
- `prd/CHANGELOG.md` entry with trigger, reasoning, date, and downstream effects
- `shared-state.md` signal entry visible to all agents
- All affected in-flight tasks flagged with review-required status
- If roadmap changed: `roadmap/changelog.md` entry

**A feature change without an audit trail is not a feature change — it is a silent inconsistency.**
