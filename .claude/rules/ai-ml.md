---
paths:
  - "src/ai/**"
  - "src/ml/**"
  - "src/prompts/**"
  - "src/evaluations/**"
  - "src/agents/**"
---

# AI/ML Rules

> Path-scoped — loads when working in AI/ML files.
> Full standards: `.claude/standards/ai-ml-standards.md`

---

## Prompt Versioning — Prompts Are Code
- NEVER overwrite an existing prompt — always create a new version
- File naming: `prompt-name.v1.md`, `prompt-name.v2.md`
- Each version includes: version number, date, author, what changed, and eval results
- Prompts live in `src/prompts/` — never inline in application code

## Evaluation Before Every Change
- No model or prompt goes to production without eval results documented in `gate-results.md`
- Eval suite must cover: accuracy on expected cases, failure cases, edge cases, adversarial inputs
- Eval results format: pass rate, failure examples, cost estimate, latency p50/p95
- If eval results drop below baseline: revert, do not ship

## Model Selection and Fallback Chains
- Never hardcode a single model — always define a fallback chain
- Example: `claude-sonnet-4-6` → `claude-haiku-4-5` → graceful degradation
- Test fallback paths — if primary model fails, fallback must activate correctly
- Document model choices and rationale in `prd/07-ai-ml-spec.md`

## Cost Tracking
For every AI feature, log to `research/signals/build-learnings.md`:
- Model used
- Estimated tokens in / tokens out per user action
- Cost per 1,000 calls at current model pricing
- Monthly cost projection at target usage

## Output Validation
- AI outputs must be validated before use — never pass raw model output to users or other systems
- Define expected output schema — use structured output (JSON mode) where available
- Implement confidence thresholds — route low-confidence outputs to human review or graceful fallback
- Log output validation failures as signals

## PII in Prompts — Absolute Rule
- PII must NEVER enter prompts sent to external AI services
- If user data is needed: pseudonymise before including, or exclude entirely
- Audit prompt templates for PII leakage before every release
- This rule applies to system prompts, few-shot examples, and dynamic context

## Context Window Management
- Track approximate token count before sending — fail gracefully if limit exceeded
- Implement context truncation that preserves the most relevant content
- Test behaviour at context limit — what happens when the window fills up?
- Log context overflow events as signals

## Human-in-the-Loop Triggers
Define explicit triggers for routing to human review:
- Confidence below threshold
- High-stakes actions (financial, personal data changes)
- Output contains a refusal or uncertainty marker
- User explicitly requests human review

---

## Phase 3 — New AI/ML Patterns

### Delta Engine Caching
- Cache delta calculations per block in memory (Map or LRU cache)
- Invalidation: on any new event for the block's workflow instances
- Max staleness: 5 minutes — force recalculate if cache older than 5min
- Cache key: `block_id:workflow_instance_count:latest_event_timestamp`
- Never cache across requests for different orgs — org isolation is mandatory

### Confidence Scoring
- All confidence scores in 0-1 range (inclusive) — validate before use
- Calibration data required: log predicted confidence vs actual human decision (approved/rejected/modified)
- Thresholds configured per-org via Policy blocks — never hardcode thresholds
- Default thresholds: auto ≥0.85, agent ≥0.6, human <0.6

### Insight Generation Prompt Versioning
- Insight prompts live in `src/prompts/insights/`
- Version as: `block-insights.v1.md`, `block-insights.v2.md`
- Each version documents: categories generated (What's done/next/at risk/Recommendations), model, eval results
- Never generate more than 4 insight categories per block — keep focused

### Document Generation Context Assembly
- Context budget: max 4000 tokens for block data + connected blocks + events
- Priority order: source block fields > directly connected blocks > recent events > reference template structure
- Truncation: if over budget, drop oldest events first, then distant connected blocks
- Include brand kit (fonts, colors, logo URL) as structured metadata, not prose
