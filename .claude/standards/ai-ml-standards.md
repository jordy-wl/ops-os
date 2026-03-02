# AI/ML Standards — Reference

> **Reading guide:** At session start, skim section headers only — do not read in full.
> Full file: load only when actively implementing a task that requires these standards.
> Auto-load: `/focus-context [task-id]` reads this file when your task's role or gate requires it.
> Skipping at session start saves significant context tokens.

Stack placeholders: `[AI_PROVIDER]`, `[MODEL_PRIMARY]`, `[MODEL_FALLBACK]`
Default: Anthropic Claude API. Confirmed in `prd/03-system-architecture.md`.

---

## Prompts Are Code

Treat prompts with the same discipline as application code.

**Rules:**
- Prompts live in `src/prompts/` — never inline in application code
- NEVER overwrite an existing prompt file — create a new version
- File naming: `{feature-name}.v{N}.md` (e.g. `user-summary.v3.md`)
- Every version file contains: version number, date, author, what changed from previous version, what eval result triggered this version
- Maintain `VERSIONS.md` in each prompt directory listing all versions and their eval pass rates

### Prompt File Template
```markdown
# Prompt: [Feature Name] — v{N}

**Version:** {N}
**Date:** YYYY-MM-DD
**Author:** AI-ML-ENGINEER
**Changed from v{N-1}:** [What changed and why — include eval result that triggered the change]
**Eval results:** Pass rate X/Y (Z%) on [eval date]

---

## System Prompt

[The system prompt content]

## User Message Template

[Template with {variable} placeholders]

## Output Schema

[Expected output structure — use JSON schema if structured output]
```

---

## Evaluation Suite — Required Before Every Change

No model or prompt ships to production without eval results in `gate-results.md`.

### Eval Suite Structure
For each AI feature, maintain an eval suite in `src/evaluations/{feature-name}/`:
- `eval-cases.json` — test cases with input, expected output, and acceptance criteria
- `run-evals.ts` — script that runs all cases and produces results
- `baseline-results.json` — the results from the currently deployed version

### Eval Case Format
```json
{
  "id": "case_001",
  "description": "Standard user with complete profile",
  "input": { /* exactly what gets passed to the model */ },
  "expected": {
    "type": "contains",       // or "exact", "schema", "not_contains", "sentiment"
    "value": "expected content or schema"
  },
  "tags": ["happy_path", "core"],
  "weight": "critical"        // critical | high | medium | low
}
```

### Passing Threshold
- `critical` cases: 100% pass rate required
- `high` cases: 95% pass rate required
- `medium` cases: 80% pass rate required
- Overall: no regression from baseline

### Eval Results Template (for gate-results.md)
```
EVAL RESULTS — [Feature] — [Model] — [Date]
Prompt version: v{N}
Model: [model name + version]
Total cases: N
Critical (required 100%): X/Y passed
High (required 95%): X/Y passed
Medium (required 80%): X/Y passed
Notable failures: [list unexpected failures with case IDs]
Cost per call: ~$X (X tokens in, Y tokens out average)
Latency: p50 Xms / p95 Xms
Compared to baseline: [better/same/worse — note any regressions]
Verdict: PASS / FAIL
```

---

## Model Selection and Fallback Chains

Never hardcode a single model. Define a fallback chain:

```typescript
const MODEL_CHAIN = [
  { model: 'claude-sonnet-4-6', maxTokens: 8192 },    // Primary — best quality
  { model: 'claude-haiku-4-5', maxTokens: 4096 },     // Cost fallback — 80% of quality at 20% of cost
  null,                                                 // Graceful degradation
] as const

async function callWithFallback(prompt: string): Promise<string | null> {
  for (const config of MODEL_CHAIN) {
    if (!config) return null  // graceful degradation
    try {
      return await callModel(config, prompt)
    } catch (e) {
      if (isRateLimitOrOverload(e)) continue  // try next
      throw e  // propagate unexpected errors
    }
  }
  return null
}
```

Test every level of the fallback chain — graceful degradation must work.
Document model choices and fallback rationale in `prd/07-ai-ml-spec.md`.

---

## Cost Tracking

Log to `research/signals/build-learnings.md` for every AI feature shipped or updated:

```
COST LOG — [Feature Name] — [Date]
Model: [name + version]
Avg tokens in: [N] tokens per call
Avg tokens out: [N] tokens per call
Cost per 1k calls: ~$X (at current pricing: $X/M input, $Y/M output)
Monthly projection at [target MAU]: ~$X/month
Cost constraint in prd/07-ai-ml-spec.md: $X/month
Status: WITHIN / EXCEEDS / APPROACHING limit
Optimisation opportunity: [note or N/A]
```

If cost exceeds constraint: block shipping, escalate to PM.

---

## Structured Output

For any feature that needs to parse AI output programmatically, use structured output:

```typescript
// Request JSON mode or structured output schema
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  messages: [...],
  system: `Always respond with valid JSON matching this schema: ${JSON.stringify(schema)}`,
})

// Validate the output before using
const parsed = outputSchema.safeParse(JSON.parse(response.content[0].text))
if (!parsed.success) {
  logOutputValidationFailure(parsed.error)
  return fallbackValue
}
```

Never pass raw unvalidated model output to other systems or users.

---

## Output Validation

Every AI output must be validated before use:
1. Schema validation — does the output match the expected structure?
2. Sanity checks — are numeric ranges reasonable? Are required fields present?
3. Content safety — does the output contain anything it shouldn't?
4. Confidence threshold — if available, check the model's confidence score

When validation fails: log the failure, use fallback, do not surface the raw failed output.

---

## Context Window Management

```typescript
// Track approximate token count before sending
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)  // rough estimate: 1 token ≈ 4 characters
}

const totalTokens = estimateTokens(systemPrompt) + estimateTokens(userMessage) + estimateTokens(context)

if (totalTokens > MODEL_CONTEXT_LIMIT * 0.9) {  // 10% safety margin
  context = truncateContext(context, TARGET_LENGTH)
  logContextTruncation({ feature, originalTokens: totalTokens, truncatedTokens: estimateTokens(context) })
}
```

Always: leave 10% headroom from the model's context limit for the output tokens.
Test behaviour at context limit — what happens when the window fills?

---

## PII in Prompts — Absolute Rule

PII must never enter prompts sent to external AI services.

**Pseudonymisation pattern:**
```typescript
function buildPromptSafely(userData: UserData, context: AppContext): string {
  return promptTemplate
    .replace('{USER_QUERY}', sanitize(context.userQuery))  // user input only
    // Never include: user.email, user.name, user.phone, user.id
}
```

Before any feature releases:
1. Print every prompt template
2. Manually verify no PII fields are referenced
3. If user data is needed: pseudonymise it first, or rephrase to exclude it

---

## Human-in-the-Loop Triggers

Define explicit triggers in `prd/07-ai-ml-spec.md` for routing to human review:

| Trigger | Action |
|---------|--------|
| Confidence below X% | Show model output with "review recommended" flag |
| Action affects financial data | Require explicit user confirmation |
| Action is irreversible | Require explicit user confirmation |
| User explicitly requests human | Route to human queue |
| Output contains refusal marker | Log, notify, queue for review |
| Output validation fails | Fallback + alert |
