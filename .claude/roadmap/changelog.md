# Roadmap Changelog

> Append-only. Never edit existing entries.
> Every roadmap change is logged HERE before it takes effect.
> An undocumented roadmap change is a silent inconsistency.

---

## Schema

| Field | Description |
|-------|-------------|
| Date | ISO date: YYYY-MM-DD |
| Change Type | See types below |
| What Changed | Before → After summary |
| Trigger | What caused this change (signal source, business event, exit condition evaluation) |
| Approved By | Role that approved: PM / ORC (orchestrator) |
| Downstream Effects | Which sprint task files, PRD docs, or shared-state.md were updated |

**Change Types:**
- `phase-added` — new phase added to roadmap
- `phase-modified` — phase hypothesis, exit condition, or scope changed
- `phase-closed` — phase evaluated and closed (exit conditions met)
- `phase-extended` — phase timeline extended (exit conditions not yet met)
- `area-reprioritised` — roadmap area moved between phases or intensity changed
- `exit-condition-updated` — exit condition rewritten (must include reason)
- `scope-changed` — features added or removed from a phase

---

## Log

| Date | Change Type | What Changed | Trigger | Approved By | Downstream Effects |
|------|------------|-------------|---------|-------------|-------------------|
| [date] | phase-added | Initial roadmap created with [N] phases | /plan-prd | ORCHESTRATOR | sprints/phases.md created, sprint-1 task files generated |

---

## Notes

- Each row represents one atomic change. Multiple changes on the same day = multiple rows.
- The "Before → After" in "What Changed" should be specific enough to reconstruct the state of the roadmap at any point.
- If a phase is closed and re-opened (rare), log both events separately.
- Exit condition updates require the most documentation — explain WHY the condition changed, not just what it changed to.
