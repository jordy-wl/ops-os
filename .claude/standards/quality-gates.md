# Quality Gates — Full Reference

> **Reading guide:** The gate summary (`rules/quality-gates.md`) is pre-loaded at session start — you already have the gate list and evidence formats.
> Full file: load only when you need the complete evidence templates for a specific gate.
> Shortcut: `/generate-gate-evidence [task-id]` reads this file and outputs only the templates that apply to your task.
> Avoid full loads at session start — use the pre-loaded `rules/quality-gates.md` summary instead.

The 7-gate quality system. Every task defines its applicable gates.
A task cannot move to DONE until all applicable gates are logged with real evidence in `gate-results.md`.

Quick reference summary: `.claude/rules/quality-gates.md` (auto-loaded in all sessions)

---

## Gate 1 — Code Quality

**Applies to:** All roles writing code

### Checklist
```bash
# 1. Linter — zero errors required
[YOUR_LINTER] . --max-warnings 0

# 2. Function length — no function > 50 lines without documented reason
# Review manually or use a complexity tool

# 3. Named constants — no magic numbers or magic strings
# Search for: numbers in conditionals, repeated string literals

# 4. File headers — public files have top-level JSDoc or comment
# Every exported function documented

# 5. No uncommitted TODOs
git grep -r "TODO\|FIXME\|HACK\|XXX" --include="*.ts" --include="*.js" --include="*.py"

# 6. No secrets
git diff --cached | grep -iE "(api_key|secret|password|token|sk-|pk_live)"
```

### Evidence Format
```
GATE 1 — CODE QUALITY
Linter: [paste exact output or "Exit 0, zero warnings"]
TODO scan: [paste grep output or "no matches"]
Secrets scan: [paste grep output or "no matches"]
Function length: [confirmed no violations or list exceptions with reasons]
```

---

## Gate 2 — Testing

**Applies to:** All roles writing logic

### Requirements
- Unit tests for all new logic (not framework boilerplate — actual logic)
- Line coverage ≥ 80% on all new files (not modified files — new files)
- Test assertions are meaningful: not `toBeTruthy()` alone, but actual values
- Edge cases documented in test names
- All tests passing with zero failures

### Running Coverage
```bash
# Adapt for your confirmed test framework
[TEST_RUNNER] --coverage --coverageThreshold='{"global":{"lines":80}}'
```

### Evidence Format
```
GATE 2 — TESTING
Test run: [paste summary: X passed, 0 failed, 0 skipped]
Coverage: [paste coverage summary for new files]
Edge cases covered:
  - [test name: what edge case it covers]
  - [test name: what edge case it covers]
```

---

## Gate 3 — Integration Check

**Applies to:** Backend Engineer, AI/ML Engineer, Data Engineer

### Requirements
- Tested with a real request/call — not mocked end-to-end
- Response/output matches the contract in `prd/05-api-contracts.md` or `prd/07-ai-ml-spec.md`
- At least 2 error cases tested
- Structured JSON logging confirmed (paste one real log entry)
- Auth confirmed on every protected endpoint

### Testing an API Endpoint
```bash
# Happy path
curl -X POST https://localhost:3000/api/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User"}' | jq .

# Error case 1: missing required field
curl -X POST https://localhost:3000/api/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Missing Email"}' | jq .

# Error case 2: unauthorised
curl -X POST https://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User"}' | jq .
```

### Evidence Format
```
GATE 3 — INTEGRATION CHECK
Happy path: [paste request command + full response]
Error case 1 ([description]): [paste request + response]
Error case 2 ([description]): [paste request + response]
Contract match: [YES / DEVIATION: description + signal logged]
Log sample: [paste one structured JSON log entry from this endpoint]
Auth check: [middleware confirmed on route / N/A — public endpoint]
```

---

## Gate 4 — Frontend Quality

**Applies to:** Frontend Engineer

### Breakpoint Checklist
```
375px (mobile):
  [ ] layout renders correctly — no broken alignment
  [ ] no horizontal overflow (inspect scroll width)
  [ ] tap targets ≥ 44×44px for all interactive elements
  [ ] text readable without horizontal scrolling

768px (tablet):
  [ ] layout renders correctly
  [ ] no components that look awkwardly sized for this breakpoint

1280px (desktop):
  [ ] layout renders correctly
  [ ] no wasted whitespace that hurts the experience

1920px (large):
  [ ] layout renders correctly
  [ ] max-width constraint prevents overstretching
```

### UI States Checklist
```
Loading state:  [ ] shown while data is fetching
Empty state:    [ ] shown when list exists but is empty
Error state:    [ ] shown when fetch fails, includes retry action
```

### Accessibility Checklist
```
Heading hierarchy: [ ] H1 once per page, logical H2→H3 nesting
Semantic HTML: [ ] nav, main, header, footer, button, a used correctly
Focus states: [ ] all interactive elements have visible focus rings
Icon buttons: [ ] all have aria-label attributes
Form inputs: [ ] all have associated label elements
Colour contrast: [ ] verified with browser devtools or contrast tool
Keyboard nav: [ ] can complete core flow using keyboard only
```

### Evidence Format
```
GATE 4 — FRONTEND QUALITY
375px: [PASS / issues found]
768px: [PASS / issues found]
1280px: [PASS / issues found]
1920px: [PASS / issues found]
Loading state: [PASS / not implemented — must fix before DONE]
Empty state: [PASS / not implemented — must fix before DONE]
Error state: [PASS / not implemented — must fix before DONE]
Accessibility: [PASS / specific issues]
```

---

## Gate 5 — Security Baseline

**Applies to:** All roles

### Checks
```bash
# Input validation — search for unvalidated inputs entering business logic
# Review manually: every public-facing input must go through a validator

# Auth on protected routes
# Review route definitions — every non-public route must have auth middleware

# PII in logs — search for fields that could contain PII
git grep -r "email\|phone\|name\|password\|token" --include="*.log" # if log files exist
grep -r "console.log\|logger\." src/ | grep -iE "email|phone|name|password"

# No secrets in code
git diff --cached | grep -iE "(api_key|secret|password|token|sk-|pk_)"

# Dependency vulnerability scan (adapt for your package manager)
npm audit --audit-level=high  # or: pip-audit, cargo audit
```

### Evidence Format
```
GATE 5 — SECURITY BASELINE
Input validation: [confirmed at boundary — describe location]
Auth on protected routes: [confirmed / N/A — public endpoint, documented]
PII in logs: [scan output or "no PII-adjacent logging found"]
Secrets in code: [scan output or "none found"]
Dependency scan: [output or "no new dependencies added"]
```

---

## Gate 6 — Peer Review

**Applies to:** All tasks marked HIGH complexity (reviewed by QA or another role)

### Review Protocol
Use `/review-task [ID]` command. Reviewer reads:
1. Task description and acceptance criteria
2. All implementation files listed in the task
3. Evaluates against the 5 criteria below

### Review Criteria
1. **Maintainability** — would you be comfortable maintaining this in 6 months?
2. **Spec compliance** — does it match the acceptance criteria and PRD exactly?
3. **Security** — any vulnerabilities not caught by Gate 5?
4. **Performance** — any concerns at 10× current scale?
5. **Testability** — can this be automatically tested thoroughly?

### Evidence Format
```
GATE 6 — PEER REVIEW
Task: [ID and title]
Reviewer: [ROLE]
Date: [date]
Verdict: PASS / NEEDS_WORK

Findings:
  - [file:line] [finding]
  - [file:line] [finding]

Suggested improvement: [specific recommendation with reasoning]

If NEEDS_WORK: task returned to IN_PROGRESS, review notes added to task file.
```

---

## Gate 7 — Architect Sign-off (Sprint Level)

**Applies to:** Orchestrator, at end of sprint during `/sprint-retro`

### Sprint Audit Checklist
```
Task evidence audit:
  [ ] Every DONE task has gate evidence in gate-results.md
  [ ] List tasks without evidence (if any) — these are not truly DONE

Learnings capture:
  [ ] All SIGNAL entries in build-learnings.md have been processed
  [ ] Research implications flagged to researcher

Phase exit conditions:
  [ ] Each phase exit condition evaluated: MET / NOT MET / PARTIAL
  [ ] Evidence cited for each evaluation

Next sprint:
  [ ] Sprint task files generated for all roles
  [ ] Dependencies mapped in dependencies.md
  [ ] shared-state.md refreshed with next sprint tasks

Retro notes:
  [ ] retro-notes.md written with: went well, harder than expected, next sprint considerations
```

### Evidence Format
```
GATE 7 — ARCHITECT SIGN-OFF
Sprint: [phase]-[sprint]
Date: [date]
Tasks audited: [X] total, [Y] have gate evidence, [Z] missing evidence
Missing evidence: [list task IDs or "none"]
Build-learning signals processed: [Y/N — describe]
Phase exit conditions:
  - [condition 1]: MET / NOT MET — [evidence]
  - [condition 2]: MET / NOT MET — [evidence]
Next sprint: [GENERATED / not yet — estimated date]
Retro: written to [path]
```
