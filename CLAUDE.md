# Ops-OS Command Centre

## System Purpose
This workspace orchestrates end-to-end product development using a multi-agent system
coordinated via shared filesystem files. Each agent tab adopts a single role persona.

**Flow:** Concept Brief → Research → PRD → Roadmap → Phases → Sprints → Build → Test → Deploy

---

## Session Start Protocol
**Every agent reads these files at the start of every session, in this order:**
1. `.claude/sprints/shared-state.md` — current work, blockers, signals queue
2. `.claude/sprints/phases.md` — current phase hypothesis and exit conditions
3. Your role-specific task file for the current sprint

---

## Quick Start

### New Project
1. `/load-agent orchestrator` — adopt orchestrator persona
2. Drop concept in `.claude/research/inputs/concept-brief-template.md`
3. `/plan-prd` — ingest PRDs, generate phases and sprint-1 tasks

### Mid-Project Context Load
1. `/load-agent [role]` — adopt your role persona
2. `/next-task` — claim your highest priority OPEN task

---

## Task ID Convention
Format: `P{phase}-S{sprint}-{ROLE}-{NUM}`
Example: `P1-S2-BE-04` = Phase 1, Sprint 2, Backend Engineer, Task 04

Role codes: `ORC` `RES` `PM` `FE` `BE` `AI` `OPS` `DE` `QA`

## Status Values
| Status | Meaning |
|--------|---------|
| `OPEN` | Available to claim |
| `IN_PROGRESS` | Claimed, being worked on |
| `BLOCKED` | Cannot proceed — reason in shared-state.md |
| `REVIEW` | Complete, awaiting Gate 6 peer review |
| `DONE` | All gates passed, evidence in gate-results.md |

---

## File Ownership by Role
| Role | Owns | Never Touches |
|------|------|---------------|
| Orchestrator | `sprints/phases.md`, sprint task files, `roadmap/` | Application code |
| Researcher | `research/`, `prd/` (edits with changelog) | Code, sprint tasks |
| Product Manager | `roadmap/ROADMAP.md`, `roadmap/north-star.md` | Code, PRD directly |
| Frontend Engineer | `src/frontend/`, `src/components/`, `src/styles/` | Backend, infra, DB schema |
| Backend Engineer | `src/api/`, `src/services/`, `src/middleware/`, `src/db/migrations/` | Frontend, infra |
| AI/ML Engineer | `src/ai/`, `src/ml/`, `src/prompts/`, `src/evaluations/` | Infra, frontend |
| DevOps Engineer | `infra/`, `terraform/`, `.github/workflows/`, `docker/`, `k8s/` | Application code |
| Data Engineer | `src/pipelines/`, `src/etl/`, `db/schema/`, `db/migrations/`, `src/analytics/` | Frontend, API routes |
| QA Engineer | `tests/`, `**/*.test.*`, `**/*.spec.*` | Feature code |

---

## Multi-Tab Coordination Rules
- One agent per tab — each tab adopts a single role persona for the session
- All coordination flows through `sprints/shared-state.md` — the single source of truth
- Never start a task without claiming it in shared-state.md first
- Never mark DONE without gate evidence logged in gate-results.md
- Blockers over 48 hours automatically escalate to orchestrator

---

## Rules and Standards
- **Auto-loaded rules** (`.claude/rules/`): coordination, quality gates, security baseline load in every session for every agent
- **Path-scoped rules**: frontend/backend/ai-ml/devops/data/testing rules activate when working in matching directories
- **Role standards** (`.claude/standards/`): each agent reads its own standards file at session start — these are detailed reference docs, not auto-loaded
- **Critical for subagents**: path-scoped rules do NOT auto-load inside subagent contexts — read your standards file explicitly

---

## MCP Registry
External tool integrations: `.claude/mcp/server-registry.md`
Check at session start to know what external actions are available.
All MCP interactions are logged to `sprints/shared-state.md`.

---

## Key Commands
| Command | Who | What |
|---------|-----|------|
| `/load-agent [role]` | Anyone | Adopt a role persona |
| `/plan-prd` | Orchestrator | Ingest PRDs, generate phases + tasks |
| `/next-task` | Engineers | Claim next available task |
| `/complete-task [ID]` | Engineers | Run quality gates, mark done |
| `/review-task [ID]` | QA / peer | Gate 6 peer review |
| `/status-report` | Anyone | Current project snapshot |
| `/sprint-retro` | Orchestrator | Close sprint, generate next |
| `/adjust-roadmap [mode]` | PM / Orchestrator | Change phase structure |
| `/evolve-prd [mode]` | Researcher | Update PRD from signals |
| `/interpret [audience]` | Anyone | Generate audience explainer |
| `/feature-change [desc]` | PM / Orchestrator | Controlled feature modification |
| `/mcp-connect [server] [action]` | Any role | Use MCP integrations |

---

## Antgravity IDE Notes
- Open one tab per role — each tab maintains its persona for the session
- Pin `shared-state.md` in a side panel for live coordination visibility
- Use split view: task file on left, implementation file on right
- The orchestrator tab coordinates; engineer tabs execute
