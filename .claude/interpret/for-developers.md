# For Developers

> Updated by `/interpret developers` command.
> Use this to onboard a new engineer or pick up context after a break.
> Current state: EMPTY — run `/interpret developers` after first sprint closes.

---

## System Overview

[3-sentence technical description: what the product does, key data flows, what makes the architecture interesting]

---

## Architecture State

Component map with current build status:

| Component | Purpose | Technology | Status | Owner |
|-----------|---------|-----------|--------|-------|
| — | — | — | PLANNED | — |

---

## Tech Stack

| Layer | Technology | Why This Choice |
|-------|-----------|----------------|
| — | — | — |

---

## Data Model Overview

[Key entities, key relationships, what changes frequently vs. rarely — summary version; full detail in `prd/04-data-models.md`]

---

## API Structure

[How the API is organised, versioning approach, where contracts live]
Full contracts: `prd/05-api-contracts.md`

---

## Development Setup

[Where to find setup instructions — should be a README or this section updated by DevOps]

---

## Current State of the Codebase

What's fully built, what's scaffolded but incomplete, what's not started:

| Area | Status | Notes |
|------|--------|-------|
| — | NOT STARTED | — |

---

## Known Technical Debt

| Debt | Why Accepted | Plan to Address | Priority |
|------|-------------|----------------|---------|
| — | — | — | — |

---

## Patterns We Use

[Established patterns: service layer architecture, error handling approach, test structure, etc.]

---

## Patterns We Deliberately Avoid

| Pattern | Why We Avoid It |
|---------|----------------|
| — | — |

---

## Where to Start If Picking Up a Task

1. Read `CLAUDE.md` — system overview and quick start
2. Run `/load-agent [your role]` — adopt your persona
3. Run `/next-task` — claim your first task
4. Read `prd/05-api-contracts.md` if you're building API-adjacent work
5. Read `prd/06-frontend-spec.md` if you're building UI
6. Ask in `sprints/shared-state.md` notes section if anything is unclear

---

*Last updated by: [ROLE] on [date]*
*Source: `/interpret developers` run after [sprint]*
