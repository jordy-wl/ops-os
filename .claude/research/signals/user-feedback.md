# User Feedback Signals

> Append-only. Never edit existing entries.
> Add entries here from any user contact: interviews, support tickets, surveys, usability tests.
> Researcher processes PENDING entries during /evolve-prd signals runs.

---

## Schema

| Field | Values |
|-------|--------|
| Date | YYYY-MM-DD |
| Source | interview / support-ticket / survey / analytics / usability-test / social |
| Feedback Summary | 1-3 sentence description of what the user said or did |
| Persona | Primary / Secondary / Unknown / [persona name] |
| PRD Section | prd/XX-name.md — Section: [section name] |
| Signal Strength | weak / moderate / strong |
| Status | PENDING / PROCESSED [date] |

**Signal strength guidance:**
- **Strong**: clear, specific feedback from multiple sources or a single high-confidence source that clearly challenges a core assumption
- **Moderate**: credible feedback that suggests a PRD section may need attention, but could be an outlier
- **Weak**: vague or anecdotal feedback — worth logging but don't act on single weak signals

---

## Log

| Date | Source | Summary | Persona | PRD Section | Strength | Status |
|------|--------|---------|---------|------------|---------|--------|

---

## Processing Notes

When researcher processes signals:
1. Mark entries PROCESSED with date
2. Log analysis in corresponding `prd/CHANGELOG.md` entry
3. If PRD changes proposed: show as BEFORE/AFTER/REASON blocks via `/evolve-prd signals`
4. Batch weak signals — only act when 3+ weak signals point at the same thing
5. Strong signals: act within the current sprint if possible

---

## Signal Patterns

Recurring themes worth tracking across sessions (researcher updates this):

| Theme | Count | Related PRD Section | Processing Status |
|-------|-------|--------------------|--------------------|
| [theme] | [count] | [prd section] | OPEN / PROCESSED |
