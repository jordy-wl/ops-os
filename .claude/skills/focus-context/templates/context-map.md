# Context Map — Minimal File Sets by Role and Task Type

## Role → Standards File

| Role Code | Standards File |
|-----------|---------------|
| FE | `.claude/standards/frontend-standards.md` |
| BE | `.claude/standards/backend-standards.md` |
| AI | `.claude/standards/ai-ml-standards.md` |
| OPS | `.claude/standards/devops-standards.md` |
| DE | `.claude/standards/data-standards.md` |
| QA | `.claude/standards/quality-gates.md` |
| ORC | `.claude/standards/quality-gates.md` (Gate 7 section) |

## Applicable Gate → Extra Files Needed

| Gate | Load |
|------|------|
| Gate 3 — Integration Check | `.claude/prd/05-api-contracts.md` |
| Gate 4 — Frontend Quality | `.claude/prd/06-frontend-spec.md` |
| Gate 6 — Peer Review | No extra file — just the implementation files |
| Gate 7 — Architect Sign-off | `.claude/sprints/phases.md`, all `gate-results.md` files |

## Task Description Keywords → Extra Files

| Keyword in task description | Load |
|----------------------------|------|
| "AI", "chat", "Claude", "embedding", "vector" | `.claude/prd/07-ai-ml-spec.md` |
| "schema", "migration", "database", "table" | `.claude/prd/04-data-model.md` |
| "E2E", "Playwright", "smoke test", "end-to-end" | `.claude/prd/11-testing-strategy.md` |
| "workflow", "job queue", "workflow_jobs" | `.claude/prd/05-api-contracts.md` |
| "security", "compliance", "audit", "RLS" | `.claude/prd/10-security-compliance.md` |
| "seed", "demo", "fixture", "sample data" | `.claude/prd/04-data-model.md` |

## Never Load at Task Start (unless explicitly requested)

| File | Reason |
|------|--------|
| `sprints/phases.md` | Phase hypothesis — only needed for retros and planning |
| `roadmap/ROADMAP.md` | Roadmap-level — only needed for PM/orchestrator decisions |
| `roadmap/north-star.md` | Vision-level — not needed for task execution |
| `interpret/` files | Publication targets — read-only reference, not task context |
| PRD layers not matching task's gates or keywords | Adds context without value |
| `prd/CHANGELOG.md` | Audit trail — only needed for researcher/PM |
| `research/findings/` files | Research findings — only needed for researcher role |

## Always Load

| File | Why |
|------|-----|
| `.claude/sprints/shared-state.md` | Active work, blockers, signals — orientation for every task |
| Role task file for current sprint | The task definition and acceptance criteria |
