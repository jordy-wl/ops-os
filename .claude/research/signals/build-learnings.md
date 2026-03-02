# Build Learnings

> Append-only. Never edit existing entries.
> Engineers add entries here DURING tasks when reality differs from spec — not after the sprint.
> This is the primary signal source for PRD evolution.

---

## Schema

| Field | Values |
|-------|--------|
| Date | YYYY-MM-DD |
| Author Role | [ROLE] |
| Task ID | P[N]-S[N]-[ROLE]-[NUM] |
| Learning | 1-3 sentence description of what was discovered |
| PRD Section Challenged | prd/XX-name.md — Section: [section] — Assumption: [what it says] |
| Signal Strength | weak / moderate / strong |
| Status | PENDING / PROCESSED [date] |

**When to log:**
- Implementation diverges from PRD spec in any meaningful way
- A PRD assumption turns out to be incorrect or incomplete
- An API contract mismatch is discovered
- A performance or scalability issue is discovered that PRD didn't anticipate
- A user behaviour (from testing or release) differs from what PRD assumed

**Two or more entries challenging the same assumption = automatically becomes a strong signal.**

---

## Log

| Date | Author | Task ID | Learning | PRD Section | Strength | Status |
|------|--------|---------|---------|------------|---------|--------|

---

## Processing Protocol

**Researcher**: reviews PENDING signals during each sprint's `/evolve-prd signals` run.
**Orchestrator**: monitors for strong signals that require immediate roadmap attention.
**PM**: reviews at end of each sprint — strong signals that change phase hypotheses require PM decision.

---

## Signal Patterns

Recurring themes (researcher updates this section):

| Theme | Count | Impact | PRD Response |
|-------|-------|--------|-------------|
| [theme] | [N signals] | [what it means] | PENDING / IN PROGRESS / RESOLVED |
