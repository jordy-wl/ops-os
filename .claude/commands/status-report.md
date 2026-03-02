---
allowed-tools: Read, Bash
---

Generate a human-readable project status snapshot. No arguments needed.

Output is suitable for a standup, investor update, or team message.

---

## Protocol

### Step 1 — Read Source Data
- `sprints/shared-state.md` — current state
- `sprints/phases.md` — phase status
- `roadmap/ROADMAP.md` — roadmap overview
- `sprints/[phase]/[sprint]/gate-results.md` — quality gate pass rates this sprint
- `research/signals/build-learnings.md` — PENDING signals

### Step 2 — Calculate Metrics
- Sprint completion: DONE / total tasks (and percentage)
- Task status breakdown: OPEN / IN_PROGRESS / BLOCKED / REVIEW / DONE counts
- Blocker age: how old is each active blocker?
- Gate pass rate: tasks with all gates passed vs. tasks completed

### Step 3 — Generate Report

```markdown
# Status Report — [date]

## Current Phase and Sprint
Phase [N]: [Phase Name] — [ACTIVE / PLANNING / COMPLETE]
Sprint [N] — [Sprint Goal]

Progress: [X/Y tasks DONE] ([Z%])

## Task Breakdown

| Status | Count |
|--------|-------|
| DONE | [N] |
| IN_PROGRESS | [N] |
| REVIEW | [N] |
| BLOCKED | [N] |
| OPEN | [N] |

## Work by Role

| Role | DONE | IN_PROGRESS | BLOCKED | OPEN |
|------|------|-------------|---------|------|
| Frontend | | | | |
| Backend | | | | |
| AI/ML | | | | |
| DevOps | | | | |
| Data | | | | |
| QA | | | | |

## Active Blockers

| Task | Blocked By | Age | Escalated? |
|------|-----------|-----|-----------|
| [task-id]: [title] | [reason] | [N days] | Y/N |

[If no blockers: "No active blockers."]

## Signals Waiting for Attention

| Source | Signal | Strength | Age |
|--------|--------|----------|-----|
| [log file] | [summary] | [strong/moderate/weak] | [date] |

[If no pending signals: "No pending signals."]

## Phase Exit Conditions

| Condition | Status | Evidence |
|-----------|--------|---------|
| [condition statement] | MET / NOT MET / PARTIAL | [brief evidence] |

## Quality Gates This Sprint
- Tasks with full gate evidence: [X/Y]
- Gate 1 failures: [N] (code quality)
- Gate 2 failures: [N] (testing)
- Gate 3 failures: [N] (integration)
- Gate 4 failures: [N] (frontend quality)
- Gate 5 failures: [N] (security)
- Gate 6 NEEDS_WORK: [N] (peer review)

## 3-Sentence Summary
[Plain English summary of where the project is, what's at risk, and what the next focus is.
Write this as if speaking to someone who hasn't seen the project in two weeks.]
```

### Output Notes
- Be specific about blockers — "waiting for API contract" is more useful than "blocked"
- Be honest about gate failures — they signal where attention is needed
- The 3-sentence summary is the most important part — make it actionable
