---
disable-model-invocation: true
allowed-tools: Read, Edit
---

Researcher command for PRD evolution. Usage: /evolve-prd [mode]

Modes: signals | brief [topic] | validate phase-[N]

---

## Mode 1: signals — Process build signals and propose PRD edits

### Protocol

**Step 1 — Gather signals**
Read all PENDING entries in:
- `research/signals/build-learnings.md`
- `research/signals/user-feedback.md`
- `research/signals/market-changes.md`

**Step 2 — Group and analyse**
Group signals by the PRD assumption they challenge.
For each group:
- Which PRD document and section does this affect?
- Is this signal strong/moderate/weak?
- Do multiple signals converge on the same assumption? (2+ = upgrade to strong)

**Step 3 — Show reasoning before showing edits**
For each proposed PRD change:
1. State the signal(s) that triggered this analysis
2. State the current PRD assumption
3. State what the signals suggest is actually true
4. Explain why this warrants a PRD change

**Step 4 — Show BEFORE/AFTER/REASON blocks**
```
PROPOSED CHANGE: prd/02-user-research.md — Section: Primary Persona

BEFORE:
[exact current text]

AFTER:
[proposed new text]

REASON:
[Signal source: build-learnings.md entry from BE-04, 2024-01-15]
[What the signal revealed: users are not completing registration because X]
[Why this changes the persona: Y]
[Confidence: HIGH / MEDIUM / LOW — based on signal strength and count]
```

**Step 5 — List roadmap implications as proposals**
Never directly change the roadmap. If the PRD change has roadmap implications:
```
ROADMAP IMPLICATION (proposal — PM approval required):
Current roadmap: [what it says]
Proposed change: [what should change and why]
Affected sprint tasks: [list task IDs that may need updating]
Urgency: HIGH / MEDIUM / LOW
```

**Step 6 — Apply approved changes**
Apply changes that have been reviewed and approved:
1. Update the PRD document
2. Archive original content (move to `## Archived` section with strikethrough)
3. Update `prd/CHANGELOG.md`
4. Mark processed signals as PROCESSED in their signal log

**Step 7 — Flag in-flight task impacts**
If any currently IN_PROGRESS or OPEN tasks are affected: add SIGNAL to `shared-state.md`.

---

## Mode 2: brief [topic] — Research a new concept area

### Protocol
1. Read the concept brief if one exists in `research/inputs/concept-brief-template.md`
2. Research the topic using web search (competitive analysis, user patterns, market data)
3. Write findings to the appropriate `research/findings/` document
4. Summarise 3 implications for the PRD
5. Propose any PRD additions as BEFORE/AFTER/REASON blocks

---

## Mode 3: validate phase-[N] — Check PRD still supports the phase hypothesis

### Protocol
1. Read `sprints/phases.md` — the phase [N] hypothesis
2. Read all PRD documents relevant to phase [N]
3. For each piece of the hypothesis: is it still supported by the current PRD?
4. Report: SUPPORTED / PARTIALLY SUPPORTED / CONTRADICTED for each hypothesis component
5. For any contradiction: propose PRD or phase hypothesis edit

---

## PRD Editing Rules

**Non-negotiable:**
- NEVER delete PRD content — archive it with strikethrough to `## Archived` section
- Every edit includes: trigger signal source, reasoning, date, who approved
- Show changes as explicit BEFORE/AFTER/REASON blocks before applying
- Roadmap implications are proposals only — PM must approve

**CHANGELOG entry format:**
```markdown
| [date] | [doc changed] | [section changed] | [before → after summary] | [trigger: signal ID or event] | [researcher] | [downstream effects] |
```
