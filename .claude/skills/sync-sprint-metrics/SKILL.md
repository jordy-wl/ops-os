---
name: sync-sprint-metrics
description: |
  Recalculate and rewrite the Sprint Progress Summary in shared-state.md to match the
  actual task status counts in the Active Work table. Also syncs the Recently Completed
  table (adds missing DONE tasks, removes duplicates). Run after any batch of task status
  changes to keep metrics accurate. Only invokable manually — never auto-invokes.
disable-model-invocation: true
user-invocable: true
allowed-tools: Read, Edit
---

# Skill: Sync Sprint Metrics

Recalculates sprint metrics from the actual task table and rewrites the Sprint Progress
Summary section in `shared-state.md`. Prevents the metrics drifting out of sync with reality.

---

## Protocol

### Step 1 — Read the Active Work Table

Read `.claude/sprints/shared-state.md`. Parse the Active Work table — extract every row
and its Status column value. Count occurrences of each status:

- DONE
- IN_PROGRESS
- BLOCKED
- REVIEW
- OPEN

Total = sum of all status counts.

If the table cannot be parsed (malformed rows), output an error and stop without writing.

### Step 2 — Calculate Metrics

- Completion rate = (DONE / Total) × 100, rounded to nearest whole number
- Verify: DONE + IN_PROGRESS + BLOCKED + REVIEW + OPEN = Total
- If the sum doesn't equal Total: output a discrepancy warning and stop without writing

Record the BEFORE values (read from the current Sprint Progress Summary section) for
comparison in the output.

### Step 3 — Rewrite Sprint Progress Summary

Using the template in `templates/metrics-table.md`, substitute calculated values.

Find the section headed `## Sprint Progress Summary` in shared-state.md.
Replace only the table within that section — do not touch any text before or after it.

The rewritten table must use this exact format:

```
| Metric | Value |
|--------|-------|
| Total tasks | {{TOTAL}} |
| DONE | {{DONE}} |
| IN_PROGRESS | {{IN_PROGRESS}} |
| BLOCKED | {{BLOCKED}} |
| REVIEW | {{REVIEW}} |
| OPEN | {{OPEN}} |
| Completion rate | {{PCT}}% |
```

### Step 4 — Sync Recently Completed Table

Read the `## Recently Completed` section in shared-state.md.
Read the Active Work table for all rows where Status = DONE.

For each DONE task:
- If it is already in Recently Completed: skip
- If it is missing from Recently Completed: add a new row with today's date and
  "Gate evidence: see gate-results.md" in the Gate Evidence column

Remove any duplicate rows (same Task ID appearing twice in Recently Completed).

---

## Output Format

```
SPRINT METRICS SYNCED

Before: DONE={{OLD_DONE}}, IN_PROGRESS={{OLD_IP}}, BLOCKED={{OLD_BLK}}, REVIEW={{OLD_REV}}, OPEN={{OLD_OPEN}}
After:  DONE={{NEW_DONE}}, IN_PROGRESS={{NEW_IP}}, BLOCKED={{NEW_BLK}}, REVIEW={{NEW_REV}}, OPEN={{NEW_OPEN}}
Completion rate: {{PCT}}%

Recently Completed: {{TOTAL_DONE}} tasks ({{NEW_ADDED}} newly added, {{DUPS_REMOVED}} duplicates removed)

shared-state.md updated.
```

---

## Edge Cases

- **If Active Work table is empty:** Output "No tasks found in Active Work table — no changes made."
- **If sum of status counts doesn't equal total rows:** Output the discrepancy and stop — do not write partial data
- **If Sprint Progress Summary section is missing:** Add it at the end of the file before the Notes section
- **If the metrics are already correct:** Output "Metrics already in sync — no changes needed."
