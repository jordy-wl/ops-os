# Sprint 4 — AI/ML Tasks

## P3-S4-AI-01 — Confidence Scoring for Routing Decisions

**Complexity:** HIGH
**Priority:** 3 (after BE-02)
**Dependencies:** P3-S4-BE-02
**Applicable Gates:** G1, G2, G3, G5, G6
**Assigned Role:** AI/ML Engineer
**Estimate:** 3 days

### Description

Build the AI confidence scoring system that evaluates workflow step tasks and produces a confidence score (0.0-1.0) indicating how confident the AI is in handling the task autonomously. This score feeds into the routing decision engine to determine human vs. agent routing.

### What to Build

1. **Confidence scoring service:**
   - `evaluateConfidence(task: TaskContext): Promise<ConfidenceResult>`
   - Input context:
     - Step instructions (SOP text)
     - Input data (block data, previous step output)
     - Expected output schema
     - Historical success rate for similar tasks (if available)
   - Output:
     ```typescript
     interface ConfidenceResult {
       score: number           // 0.0-1.0
       reasoning: string       // why this score
       factors: {
         instructionClarity: number    // 0-1: how clear the SOP is
         dataCompleteness: number      // 0-1: how complete the input data is
         patternMatch: number          // 0-1: how similar to previously successful tasks
         complexityEstimate: number    // 0-1: inverse of task complexity
       }
     }
     ```

2. **Claude evaluation prompt:**
   - System prompt for confidence evaluation (not execution)
   - Asks Claude to assess the task, not complete it
   - Returns structured JSON with score and factors
   - Prompt stored in `src/prompts/confidence-evaluation.v1.md`

3. **Integration with routing engine:**
   - Called by the workflow engine before `makeRoutingDecision()`
   - Confidence result passed as `confidenceScore` to the routing engine
   - If AI evaluation fails: default to confidence 0.0 (routes to human)

4. **Caching and cost management:**
   - Cache confidence scores per (step_config_hash + input_data_hash) for 1 hour
   - Track token usage per evaluation for cost monitoring
   - Log all evaluations as Events (type: `ai.confidence_evaluation`)

### Files to Create

- `src/lib/ai/confidence-scoring.ts`
- `src/prompts/confidence-evaluation.v1.md`
- `src/lib/ai/confidence-cache.ts`

### Acceptance Criteria

- [ ] Confidence scoring returns a score between 0.0 and 1.0
- [ ] Score factors (instructionClarity, dataCompleteness, patternMatch, complexity) are populated
- [ ] Clear SOP instructions with complete data produce high confidence (>= 0.8)
- [ ] Vague instructions with incomplete data produce low confidence (<= 0.4)
- [ ] Failed AI evaluation defaults to 0.0 (safe fallback to human)
- [ ] Scores are cached to avoid redundant API calls
- [ ] All evaluations logged as Events
- [ ] Unit tests for scoring logic with mocked Claude responses
- [ ] Integration test: confidence score flows through to routing decision
