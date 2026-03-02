---
name: focus-context
description: |
  When an agent is about to start work on a specific task, load only the minimal set
  of context files needed for that task's role and gate requirements — skipping phases.md,
  roadmap files, and irrelevant PRD sections. Invoke automatically when an agent claims
  a task or says "I'm starting [task-id]", "loading context for [task-id]", or "what
  should I read for [task-id]".
disable-model-invocation: false
user-invocable: true
argument-hint: "[task-id]"
allowed-tools: Read, Glob
---

# Skill: Focus Context

> **Task ID:** `$ARGUMENTS`

Loads only the files relevant to this specific task, skipping the broad session-start
protocol. Reduces token waste and keeps the working context tight.

---

## Protocol

### Step 1 — Parse Task ID

Extract the role code from `$ARGUMENTS`:
- `P1-S1-FE-*` → FE (Frontend)
- `P1-S1-BE-*` → BE (Backend)
- `P1-S1-AI-*` → AI (AI/ML)
- `P1-S1-OPS-*` → OPS (DevOps)
- `P1-S1-DE-*` → DE (Data)
- `P1-S1-QA-*` → QA (Quality Assurance)
- `P1-S1-ORC-*` → ORC (Orchestrator)

### Step 2 — Read Task Definition

Read the role task file (derived from role code — see context-map.md).
Find the section for `$ARGUMENTS`. Extract:
- Applicable Gates list
- Complexity
- Dependencies list
- Any PRD section references in the task description

### Step 3 — Build Minimal File List

Using the lookup table in `templates/context-map.md`:

**Always load (every task):**
- `.claude/sprints/shared-state.md` — active work and blockers
- The role task file — task definition and acceptance criteria

**Load based on role code:**
- FE → `.claude/standards/frontend-standards.md`
- BE → `.claude/standards/backend-standards.md`
- AI → `.claude/standards/ai-ml-standards.md`
- OPS → `.claude/standards/devops-standards.md`
- DE → `.claude/standards/data-standards.md`
- QA → `.claude/standards/quality-gates.md`

**Load based on Applicable Gates:**
- Gate 3 → `.claude/prd/05-api-contracts.md`
- Gate 4 → `.claude/prd/06-frontend-spec.md`

**Load based on task description keywords:**
- "auth" or "middleware" → already covered by standards file
- "AI" or "chat" or "embedding" → `.claude/prd/07-ai-ml-spec.md`
- "schema" or "migration" → `.claude/prd/04-data-model.md`
- "E2E" or "Playwright" → `.claude/prd/11-testing-strategy.md`
- "action" or "workflow" → `.claude/prd/05-api-contracts.md` (if not already loaded)

**Load only if task has active dependencies not yet DONE:**
- `.claude/sprints/phase-1/sprint-1/dependencies.md`

**Never load unless explicitly requested:**
- `sprints/phases.md` — phase hypothesis, not needed for task execution
- `roadmap/ROADMAP.md` — roadmap level, not needed for task execution
- `interpret/` files — publication only
- PRD layers not relevant to this task's gates or keywords

### Step 4 — Read Each File in the Minimal List

Read each file. Report estimated line count per file.

### Step 5 — Output Context Load Summary

---

## Output Format

```
FOCUSED CONTEXT LOADED: [task-id] — [Task Title]

Files loaded (minimal set):
  [✓] shared-state.md ([N] lines) — active work and blockers
  [✓] [role]-tasks.md ([N] lines) — task definition for [task-id]
  [✓] [role]-standards.md ([N] lines) — role standards
  [✓] prd/05-api-contracts.md ([N] lines) — Gate 3 required
  [estimated total: ~[N] lines]

Files skipped (not needed for this task):
  [ ] phases.md — phase-level context, not needed for task execution
  [ ] roadmap/ROADMAP.md — roadmap-level, not needed
  [ ] prd/06-frontend-spec.md — frontend gate not applicable to [ROLE] task
  [saved ~[N] lines vs full session start protocol]

Task summary:
  Complexity: [LOW/MEDIUM/HIGH]
  Applicable gates: [list]
  Dependencies: [list with current statuses from shared-state.md]

Ready to begin [task-id].
When done: run /generate-gate-evidence [task-id] for evidence templates.
When complete: run /handoff [task-id] to notify other roles.
```

---

## Edge Cases

- **If task ID not found:** Check if it exists in shared-state.md or any task file. If not found anywhere, report the error.
- **If called without argument:** Output "Usage: /focus-context [task-id] — provide the task you're about to work on"
- **If the task is already DONE:** Note this and skip the file loading
