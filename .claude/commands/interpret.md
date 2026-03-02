---
allowed-tools: Read, Write, Edit
---

Generate audience-specific explainers from current system state. Usage: /interpret [audience]

Audiences: developers | investors | cofounders | all

---

## Protocol — All Modes (Required First Steps)

Read these documents before writing any explainer:
1. `sprints/shared-state.md` — current build state
2. `sprints/phases.md` — current phase and what's being proven
3. `roadmap/ROADMAP.md` — overall roadmap
4. `interpret/architecture-explainer.md` — current architecture state
5. Relevant PRD docs (architecture, data models, API contracts)

---

## Mode: developers

Target: engineers joining the project or picking up a task for the first time.
Language: technical, specific, honest about tradeoffs.

Update `interpret/for-developers.md` with:

**1. System Overview** (3 sentences)
What the product does, technically. What the key data flows are. What makes the architecture interesting.

**2. Architecture State**
Current component map with status: BUILT / IN PROGRESS / PLANNED for each component.
How components communicate (sync/async, which protocol).

**3. Tech Stack**
Every major choice with the confirmed rationale (from `prd/03-system-architecture.md`).
Include: "we chose X over Y because Z".

**4. Data Model Overview**
Key entities, key relationships, what changes frequently vs. rarely.

**5. API Structure**
How the API is organised. Where the contracts live. How to read them.

**6. Development Setup**
Where to find setup instructions. What to do first.

**7. Current State of the Codebase**
What's fully built, what's scaffolded but incomplete, what's not started.
Be honest — this helps new developers calibrate effort.

**8. Known Technical Debt**
What shortcuts were taken and why they were accepted. What the plan is.

**9. Patterns We Use**
3-5 established patterns with examples (service layer, error handling, test structure).

**10. Where to Start**
If picking up a task, read X files first. Understand Y before touching Z.

---

## Mode: investors

Target: technical investors or advisors evaluating the team and product.
Language: plain English, honest, no hype. Translate technical concepts without dumbing them down.

Update `interpret/for-investors.md` with:

**1. What's Been Built** (product terms, not technical terms)
What a user can actually do today. What end-to-end flows work.

**2. What's Been Proven**
What technical hypotheses have been validated. What works reliably.

**3. Technical Risk Assessment**
The 3-5 hardest technical problems. Where we are on each.
Use a simple scale: SOLVED / DERISKED / IN PROGRESS / UNKNOWN.

**4. Infrastructure and Scalability**
Can this handle 10× current usage without a rewrite? Plain English explanation.
What the scaling approach is and when it needs to change.

**5. AI/ML Bets** (if applicable)
What AI features exist. What we're betting will work. What the evaluation results show.
What the cost structure looks like at scale.

**6. Build vs. Buy Decisions**
What we built custom (potential moat) and why. What we're using off-the-shelf (commodity).

**7. Team Capability Signal**
What the code quality and architecture decisions tell you about the team's capability.
Write this honestly — it will be validated by any competent technical advisor.

**8. What the Next Phase Builds**
What the next phase proves. What milestone it represents.

**9. Current Honest Limitations**
What the system cannot do yet. What would break at 100× scale. What's not production-ready.

---

## Mode: cofounders

Target: non-technical cofounders and business partners.
Language: plain English. No jargon. Focus on decisions and implications.

Update `interpret/for-cofounders.md` with:

**1. Current Product State** (plain English)
What a user can do right now. What works end-to-end. What's still being built.

**2. What Engineering Is Working On Now and Why**
The current sprint focus in plain language. Why it's the priority.

**3. Decisions That Need Your Input**
Product or business decisions with unresolved technical implications.
Format: "We need to decide X. The technical options are A, B, C. The tradeoff is Y."

**4. Technical Decisions Already Made That Affect the Business**
Lock-ins, cost structures, capabilities unlocked. What you should know.

**5. Speed vs. Quality Tradeoffs Active Right Now**
What we're doing fast (and why) vs. what we're doing carefully (and why).

**6. Upcoming Milestones in Plain English**
What each phase milestone means in product and business terms. What it unlocks.

**7. Things to Know About Technical Timeline**
How estimates work. Why things take longer than expected. What elongates timelines.

**8. Questions You Should Be Asking Engineering**
A list of questions that will give you genuine signal about project health.

---

## Mode: all

Run all three modes in sequence.
