# Quality Gates — Summary Reference

> Unconditional — loads for every agent in every session.
> Full gate details with evidence templates: `.claude/standards/quality-gates.md`

---

## The 7 Gates

Every task has a set of **applicable gates** listed in its task definition. A task cannot move to `DONE` until all its applicable gates are logged with real evidence in `gate-results.md`.

### Gate 1 — Code Quality
**Applies to:** All roles writing code
- Linter runs with zero errors (paste output)
- No function longer than 50 lines without documented reason
- Named constants, no magic numbers
- No uncommitted TODO/FIXME/HACK comments
- No secrets or credentials in any file

**Evidence format:**
```
GATE 1 — CODE QUALITY
Linter: [paste output or "zero errors"]
TODOs scan: [paste grep output or "none found"]
Secrets scan: [paste grep output or "none found"]
```

### Gate 2 — Testing
**Applies to:** All roles writing logic
- Unit tests for all new logic
- Coverage ≥ 80% on new files (paste coverage report)
- Assertions test behaviour, not implementation
- Edge cases documented in test names
- All tests passing

**Evidence format:**
```
GATE 2 — TESTING
Coverage: [X%] on [files]
Test run: [paste summary — X passed, 0 failed]
Edge cases covered: [list]
```

### Gate 3 — Integration Check
**Applies to:** Backend, AI/ML, Data
- Tested with a real request (not just unit mocks)
- Contract matches `prd/05-api-contracts.md`
- At least 2 error cases tested (paste curl/test output)
- Structured JSON logging confirmed (paste log sample)

**Evidence format:**
```
GATE 3 — INTEGRATION CHECK
Happy path: [paste request/response]
Error case 1: [paste]
Error case 2: [paste]
Contract match: [YES / DEVIATION — see signal logged]
```

### Gate 4 — Frontend Quality
**Applies to:** Frontend Engineer
- Tested at all 4 breakpoints: 375px / 768px / 1280px / 1920px
- No layout shift on load
- All focus states visible
- WCAG AA: semantic HTML, aria-labels on icon-only buttons
- Loading state, empty state, and error state all implemented

**Evidence format:**
```
GATE 4 — FRONTEND QUALITY
375px: [PASS/FAIL — notes]
768px: [PASS/FAIL — notes]
1280px: [PASS/FAIL — notes]
1920px: [PASS/FAIL — notes]
States: loading [✓] empty [✓] error [✓]
Accessibility: [notes]
```

### Gate 5 — Security Baseline
**Applies to:** All roles
- User input sanitised at system boundary
- Auth checked on every protected route
- No PII in log statements
- CORS policy explicit
- Dependencies scanned for known vulnerabilities

**Evidence format:**
```
GATE 5 — SECURITY BASELINE
Input validation: [confirmed / location]
Auth check: [confirmed / location or N/A]
PII in logs: [scan output or N/A]
Dependency scan: [output or "no new dependencies"]
```

### Gate 6 — Peer Review
**Applies to:** All tasks marked HIGH complexity
- Another agent (or QA engineer) has read the implementation
- Reviewer confirms: maintainable, matches spec, no security concerns
- At least one improvement suggested with reasoning
- Review outcome logged in gate-results.md with reviewer role named

**Evidence format:**
```
GATE 6 — PEER REVIEW
Reviewer: [ROLE]
Verdict: PASS / NEEDS_WORK
Findings: [list with file refs]
Suggested improvement: [description]
```

### Gate 7 — Architect Sign-off
**Applies to:** Sprint-level gate, run by orchestrator at `/sprint-retro`
- Every DONE task in the sprint has gate evidence present
- Learnings captured in build-learnings.md
- Phase exit conditions evaluated
- Next sprint task files ready

**Evidence format:**
```
GATE 7 — ARCHITECT SIGN-OFF
Tasks audited: X/Y have gate evidence
Missing evidence: [list or "none"]
Phase exit conditions: [met/not met — see retro-notes.md]
Next sprint: [generated / not yet]
```

---

## Gate Applicability by Role
| Role | G1 | G2 | G3 | G4 | G5 | G6 | G7 |
|------|----|----|----|----|----|----|-----|
| Frontend Engineer | ✓ | ✓ | — | ✓ | ✓ | HIGH | — |
| Backend Engineer | ✓ | ✓ | ✓ | — | ✓ | HIGH | — |
| AI/ML Engineer | ✓ | ✓ | ✓ | — | ✓ | HIGH | — |
| DevOps Engineer | ✓ | ✓ | — | — | ✓ | HIGH | — |
| Data Engineer | ✓ | ✓ | ✓ | — | ✓ | HIGH | — |
| QA Engineer | ✓ | ✓ | — | — | ✓ | — | — |
| Orchestrator | — | — | — | — | — | — | ✓ |

`HIGH` = Gate 6 applies only to tasks rated HIGH complexity
