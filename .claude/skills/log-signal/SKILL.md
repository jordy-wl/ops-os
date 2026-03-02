---
name: log-signal
description: |
  When a PRD deviation, API contract mismatch, spec inconsistency, or build learning is
  discovered during task implementation, format and write the signal to both
  build-learnings.md and the shared-state.md signals queue in one operation. Invoke
  automatically when a user says "this doesn't match the PRD", "the spec says X but I
  found Y", "contract mismatch", or "logging a deviation".
disable-model-invocation: false
user-invocable: true
argument-hint: "[task-id] [strength: strong|moderate|weak]"
allowed-tools: Read, Edit
---

# Skill: Log Signal

> **Arguments:** Task ID = `$0`, Signal strength = `$1` (strong / moderate / weak)

Formats a build-learning signal and writes it to two files atomically:
1. Full entry → `.claude/research/signals/build-learnings.md`
2. One-line summary → `.claude/sprints/shared-state.md` signals queue table

Also detects patterns: if 2+ signals reference the same PRD section, flags it for the researcher.

---

## Protocol

### Step 1 — Collect Signal Details

Extract signal details from the current conversation context. Look for:
- What the PRD or spec says (the expected behaviour or design)
- What was actually found during implementation (the reality)
- Which PRD document and section is affected
- What the downstream implication is
- Any recommended action for researcher or PM

If any of these are unclear, ask for them before proceeding.

Derive the completing role from the task ID role code (e.g., P1-S1-BE-04 → BE → Backend).

### Step 2 — Format the Signal Entry

Use the template in `templates/signal-format.md`. Substitute all `{{PLACEHOLDER}}` values.

- `{{TASK_ID}}` = `$0`
- `{{DATE}}` = today's date YYYY-MM-DD
- `{{STRENGTH}}` = `$1` (or ask if not provided — default to `moderate`)
- `{{ROLE}}` = derived from task ID
- The PRD section, before/after, implication, and recommended action = from Step 1

### Step 3 — Append to build-learnings.md

Read `.claude/research/signals/build-learnings.md`.

Append the formatted signal below the last entry in the file. Preserve all existing content.

### Step 4 — Append to Signals Queue in shared-state.md

Read `.claude/sprints/shared-state.md`.

Add one row to the Signals Queue table:

```
| [DATE] | Build: [TASK_ID] | [one sentence: what was expected vs. what was found] | [STRENGTH] | [ROLE] |
```

### Step 5 — Check for Pattern

Count entries in build-learnings.md that reference the same PRD section as this signal
and are still PENDING (not marked PROCESSED).

If this count reaches 2 or more for the same PRD section:
- Add a note to the shared-state.md Notes table:
  ```
  | [DATE] | [ROLE] | PATTERN DETECTED: [N] signals now reference [prd/XX-section.md — Section Name]. Researcher: consider running /evolve-prd signals. |
  ```

---

## Output Format

```
SIGNAL LOGGED: [task-id]

Strength: [strong/moderate/weak]
PRD section affected: [prd/XX-filename.md — Section name]

Written to:
  research/signals/build-learnings.md — full signal entry appended
  shared-state.md — signals queue row added

[If pattern detected:]
PATTERN DETECTED: [N] signals now reference [section].
Researcher should run /evolve-prd signals to process.
Flag added to shared-state.md notes.
```

---

## Edge Cases

- **If called without a task ID:** Output "Usage: /log-signal [task-id] [strength] — task ID required"
- **If build-learnings.md doesn't exist:** Create it with a header and add the first signal
- **If the PRD section is unclear:** Ask before writing — better to ask once than log an inaccurate signal
- **If signal strength not provided:** Default to `moderate`, note the default in the output
