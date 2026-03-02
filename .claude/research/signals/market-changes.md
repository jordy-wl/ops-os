# Market Change Signals

> Append-only. Never edit existing entries.
> Researcher adds entries from ongoing market monitoring.
> PM reviews weekly. Strong signals trigger /evolve-prd.

---

## Schema

| Field | Values |
|-------|--------|
| Date | YYYY-MM-DD |
| Change | Description of the market event (competitor launch, regulatory change, technology shift, pricing change, major funding event) |
| Source | URL or reference |
| Relevance | Which PRD docs and roadmap areas are affected |
| Signal Strength | weak / moderate / strong |
| Status | PENDING / PROCESSED [date] |

**Signal strength guidance:**
- **Strong**: directly threatens or validates core product differentiation or key PRD assumption
- **Moderate**: affects market dynamics in ways that should inform a future PRD review
- **Weak**: interesting context but doesn't require action

---

## Log

| Date | Change | Source | Relevance | Strength | Status |
|------|--------|--------|----------|---------|--------|

---

## Monitoring Focus Areas

What the researcher is watching for this project (researcher fills this in during /plan-prd):

| Area | What to Watch | Why It Matters |
|------|--------------|----------------|
| [competitor name] | New feature launches, pricing changes | [reason specific to this product] |
| [technology area] | New models / APIs / tools | [reason] |
| [regulatory area] | Policy changes, enforcement actions | [reason] |
| [PROJECT-SPECIFIC] | [what to monitor] | [why] |

---

## Major Events Log

Significant market events that changed this product's context:

| Date | Event | Impact on Product | PRD Response |
|------|-------|-----------------|-------------|
| [date] | [event] | [impact] | [PRD change or "no action"] |
