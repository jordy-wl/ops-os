# Interpret — Audience-Specific Explainers

This folder makes the build legible to different audiences without them reading code or PRDs.

---

## What This Is

As engineers build, context about what's been built, why, and how it works accumulates in code, PRDs, and sprint notes. This folder translates that context into three audience-specific documents:

| File | Audience | Language | Purpose |
|------|---------|---------|---------|
| `for-developers.md` | Engineers joining the project | Technical | Onboarding, picking up tasks |
| `for-investors.md` | Technical investors and advisors | Plain English | Due diligence, updates |
| `for-cofounders.md` | Non-technical cofounders, business partners | Plain English | Alignment, decision-making |
| `architecture-explainer.md` | All technical stakeholders | Technical | Living architecture reference |

---

## How It Works

1. **Engineers contribute** to these docs as they build — adding to `architecture-explainer.md` when they make significant decisions
2. **The `/interpret` command synthesises** current state into the audience-specific docs at any point
3. **PM and researcher review** before sharing externally

---

## When to Update These Docs

| Trigger | Command | Who |
|---------|---------|-----|
| New developer joining | `/interpret developers` | Orchestrator |
| Investor meeting | `/interpret investors` | PM |
| Cofounder sync | `/interpret cofounders` | PM |
| Weekly team sync | `/interpret all` | Orchestrator |
| After each sprint closes | `/interpret all` | Orchestrator |

---

## Honesty Policy

These documents should be honest — including what's not built yet and where the risks are. A document that overstates progress:
- Misleads investors about technical risk
- Misleads cofounders about timeline
- Misleads developers about the state of the codebase

If an investor reads `for-investors.md` and the picture is rosier than reality: that's a documentation failure. Write honestly.

---

## Current Status

All documents are empty scaffolds until `/interpret [audience]` is first run.
Run after the first sprint closes to get initial content.
