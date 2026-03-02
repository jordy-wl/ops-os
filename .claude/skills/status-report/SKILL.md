---
name: status-report
description: |
  Generate a human-readable sprint status snapshot for standup, investor update, or team
  sync. Runs in a forked subagent that writes the full report to a file — only a 3-line
  summary returns to the main context, preventing context bloat. Use /status-report sprint
  for daily standup, /status-report investor for fundraising, /status-report full for both.
disable-model-invocation: true
user-invocable: true
argument-hint: "[audience: sprint|investor|full]"
allowed-tools: Read, Write, Bash
context: fork
agent: general-purpose
---

# Skill: Status Report

> **Audience:** `$ARGUMENTS` (defaults to `sprint` if not provided)

Generates a sprint status report and writes it to a timestamped file.
The full report is written to disk — only a 3-line summary returns to your conversation.
This prevents a 100+ line report from bloating every subsequent conversation turn.

---

## Protocol

### Step 1 — Read Source Data

Read the following files:
- `.claude/sprints/shared-state.md` — current task statuses, blockers, signals queue
- `.claude/sprints/phases.md` — phase hypothesis and exit conditions
- `.claude/sprints/phase-1/sprint-1/gate-results.md` — gate pass/fail evidence this sprint
- `.claude/research/signals/build-learnings.md` — PENDING signals

If audience is `investor` or `full`, also read:
- `.claude/roadmap/ROADMAP.md` — overall roadmap and phase structure

### Step 2 — Calculate Metrics

From shared-state.md Active Work table:
- Count each status: DONE, IN_PROGRESS, BLOCKED, REVIEW, OPEN
- Total tasks = sum of all
- Completion rate = (DONE / Total) × 100%

From blockers table:
- Calculate age of each active blocker in days (from Last Updated to today)

From gate-results.md:
- Count tasks with gate evidence entries vs. total DONE tasks
- Note any NEEDS_WORK gate 6 verdicts

From build-learnings.md:
- Count PENDING signals (not yet marked PROCESSED)

### Step 3 — Generate Report

Generate the report content appropriate to the audience.

**`sprint` mode — for standups and team syncs:**
```markdown
# Status Report — [YYYY-MM-DD]

## Sprint Progress
Phase [N]: [Phase Name] | Sprint [N] | Goal: [sprint goal from shared-state.md]
Progress: [DONE/TOTAL] tasks ([PCT%])

## Task Status
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
[one row per active role]

## Active Blockers
[table or "No active blockers"]

## Pending Signals
[count and brief description, or "No pending signals"]

## Gate Quality
Tasks with full gate evidence: [X/Y DONE tasks]
[Any gate failures or NEEDS_WORK verdicts]

## 3-Sentence Summary
[Plain English: where we are, what's at risk, what needs attention next.
Write as if speaking to someone who hasn't seen the project in two weeks.]
```

**`investor` mode — for fundraising and advisor updates:**
```markdown
# Technical Progress Report — [YYYY-MM-DD]

## What's Been Built
[Product terms, not technical terms — what a user can actually do today]

## What's Been Proven
[Technical hypotheses validated — what works reliably with evidence]

## Technical Risk Assessment
| Problem | Status |
|---------|--------|
[3-5 hardest technical problems with SOLVED/DERISKED/IN PROGRESS/UNKNOWN]

## Infrastructure and Scalability
[Plain English: can this handle 10× usage without a rewrite?]

## AI/ML Bets
[What AI features exist, confidence levels, cost structure]

## Current Honest Limitations
[What the system cannot do yet, what's not production-ready]

## Next Phase Focus
[What Phase [N+1] builds and what it proves]
```

**`full` mode:** Generate both sprint and investor sections in a single document.

### Step 4 — Write Report to File

Get today's date in YYYY-MM-DD format.
Write the complete report to: `.claude/sprints/status-[YYYY-MM-DD].md`

If a file with that name already exists (multiple reports on the same day):
append a counter: `status-[YYYY-MM-DD]-2.md`

### Step 5 — Return Summary to Main Context

Return ONLY this to the main conversation (not the full report):

```
STATUS REPORT COMPLETE

Sprint [N]: [DONE/TOTAL tasks] ([PCT%]) | [N] blockers | [N] PENDING signals
Report written to: .claude/sprints/status-[date].md

[3-sentence plain-English summary]
```

---

## Edge Cases

- **If shared-state.md has no tasks:** Output "No active sprint tasks found — run /plan-prd to initialise."
- **If gate-results.md doesn't exist yet:** Note "No gate evidence recorded this sprint" in the report
- **If called without argument:** Default to `sprint` mode
