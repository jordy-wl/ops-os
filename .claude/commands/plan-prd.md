---
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Glob
---

Orchestrator command: ingest PRD documents and generate sprint structure. Run as orchestrator persona.

---

## Protocol

### Step 1 — Read Source Documents
Read all of these before generating anything:
- All files in `.claude/prd/` (all PRD layers that exist)
- `.claude/roadmap/ROADMAP.md` and `roadmap/north-star.md`
- `.claude/research/findings/` — all research documents that exist
- `.claude/research/inputs/concept-brief-template.md` (if populated)

### Step 2 — Product Summary
Write a 3-sentence product summary covering: what it does, who it's for, what makes it different.

### Step 3 — Risk Identification
Identify and list the top 5 technical risks based on PRD review. For each: risk description, likelihood (1-5), impact (1-5), and initial mitigation idea.

### Step 4 — Tech Stack Check
Read `.claude/research/findings/tech-stack-recommendation.md`.
If it doesn't exist: prompt researcher to complete it before proceeding.
If it exists but PM approval is not recorded: prompt PM to approve before proceeding.
If approved: note confirmed stack for use in task generation.

### Step 5 — Generate phases.md
Write `.claude/sprints/phases.md` with 3-6 phases. Each phase must have:
- Phase number and name
- **Hypothesis statement**: "If we build X, users will do Y, which proves Z"
- What is being built in this phase
- Which roadmap areas are active
- Which roles are involved
- Dependencies on previous phases
- **Exit condition** — a binary true/false statement that can be evaluated with evidence
- Evidence required to call the exit condition met
- What failure looks like and what happens if the phase doesn't prove the hypothesis

Format each phase as:
```markdown
## Phase [N]: [Name]

**Status:** PLANNING
**Target:** [date range estimate]

**Hypothesis:** If we build [X], users will [Y], proving [Z].

**What we're building:**
- [component 1]
- [component 2]

**Active roles:** [list]
**Dependencies on Phase [N-1]:** [list or "none — first phase"]

**Exit Condition:** [Binary true/false statement]
**Evidence required:** [What must be measured or demonstrated]
**Failure path:** [What we do if the hypothesis is not proven]
```

### Step 6 — Generate Sprint-1 Task Files
Generate task files for ALL relevant roles for Sprint 1.

For each task, use this exact format:
```markdown
## [P1-S1-ROLE-NUM]: [Title]

**Description:** [Detailed description of what needs to be built and why]

**Acceptance Criteria:**
- [ ] [Specific, testable criterion — verifiable by QA]
- [ ] [Specific, testable criterion]
- [ ] [Specific, testable criterion]

**Applicable Gates:** [Gate numbers: e.g. 1, 2, 3, 5]
**Dependencies:** [task IDs this depends on, or "none"]
**Complexity:** LOW / MEDIUM / HIGH
**Estimate:** [N days]
**Assigned Role:** [ROLE]
```

Create files:
- `.claude/sprints/phase-1/sprint-1/tasks.md` — master list of ALL role tasks
- `.claude/sprints/phase-1/sprint-1/frontend-tasks.md` — FE tasks only + sprint header
- `.claude/sprints/phase-1/sprint-1/backend-tasks.md` — BE tasks only + sprint header
- `.claude/sprints/phase-1/sprint-1/devops-tasks.md` — DevOps tasks only + sprint header
- `.claude/sprints/phase-1/sprint-1/data-tasks.md` — Data tasks only + sprint header
- `.claude/sprints/phase-1/sprint-1/ai-ml-tasks.md` — AI/ML tasks only (if applicable) + sprint header
- `.claude/sprints/phase-1/sprint-1/dependencies.md` — dependency graph

**Only generate Sprint 1. Future sprints are generated at /sprint-retro.**

### Step 7 — Initialise shared-state.md
Update `.claude/sprints/shared-state.md`:
- Set current phase and sprint header
- Add ALL sprint-1 tasks to active work table with status `OPEN`
- Clear blockers table (fresh sprint)
- Write planning summary

### Step 8 — Write Planning Notes
Write `.claude/sprints/phase-1/sprint-1/planning-notes.md`:
- Product summary (3 sentences)
- Top 5 risks identified
- Tech stack confirmed (with approval record)
- Phase structure overview
- Sprint-1 scope and goal
- Critical path (longest dependency chain)
- Assumptions made during planning

### Output
```
PLANNING COMPLETE

Product: [name]
Phases generated: [N]
Sprint-1 tasks created: [N] tasks across [N] roles
Critical path: [longest dependency chain]

Review:
- sprints/phases.md — phase structure and hypotheses
- sprints/phase-1/sprint-1/tasks.md — all sprint tasks
- sprints/shared-state.md — initialised with OPEN tasks

Next: Each role runs /load-agent [role] then /next-task to begin.
```
