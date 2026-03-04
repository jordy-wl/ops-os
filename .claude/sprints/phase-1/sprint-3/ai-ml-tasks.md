# Sprint 3 — AI/ML Engineer Tasks

> Read this file after `shared-state.md` and `phases.md`.
> Claim a task by updating its status to IN_PROGRESS in `shared-state.md` before starting.

---

## Your Tasks This Sprint

| Task ID | Title | Status | Complexity | Est. Days | Blocked By |
|---------|-------|--------|-----------|-----------|-----------|
| P1-S3-AI-01 | Context Assembly — Org Summary + Block Graph | OPEN | MEDIUM | 2 | none |

**Day-1 recommendation:** Claim AI-01 immediately — it's fully unblocked. Org summary and block graph context are the two highest-impact improvements for demo quality. The design partner will ask "what's happening across my portfolio?" — today's context can't answer that well.

---

## P1-S3-AI-01: Context Assembly — Org Summary + Block Graph Context

**Description:** Two enrichments to `assembleContext()` that dramatically improve AI answer quality for the design partner demo:

1. **Org summary** — when chatting at org level (no blockId), prepend a factual summary of the org's current state so Claude can give portfolio-level answers.
2. **Block graph context** — when chatting about a specific block, include its direct parent and child block names/types from `block_edges`. Adds relationship visibility: "Thornfield Capital Partners has 3 contacts and 1 active deal."

**Key file:** `src/lib/context-assembly.ts` — read this first before making changes. AI-01 in Sprint 2 already extended it significantly. Build on that work.

---

### Enrichment 1 — Org Summary

**When:** `blockId === null || blockId === undefined`

**Query to add:** Before or alongside existing queries, fetch:
```typescript
// Org summary — batch with existing supabase client
const [blockCountResult, activeWorkflowsResult, recentEventsCountResult] = await Promise.all([
  supabase.from('blocks').select('type').eq('org_id', orgId),
  supabase.from('workflow_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .in('status', ['pending', 'running']),
  supabase.from('events')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('occurred_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
])
```

**Context string output (prepend to existing context):**
```
Organisation summary: 8 blocks total (3 client, 2 deal, 2 contact, 1 project), 2 active workflows, 12 events in the last 24 hours.
```

**Failure handling:** If any org summary query fails, log `semantic.org_summary_failed` at warn level, omit the summary line, and continue — never throw.

---

### Enrichment 2 — Block Graph Context

**When:** `blockId` is set (block-level chat)

**Query to add:** Fetch direct edges for the block:
```typescript
const { data: edges } = await supabase
  .from('block_edges')
  .select('target_id, source_id, relationship')
  .or(`source_id.eq.${blockId},target_id.eq.${blockId}`)
  .eq('org_id', orgId)
```

Then fetch the block names/types for the related block IDs (batch into a single `.in()` query).

**Context string output (append after block context, before events):**
```
Block relationships: [parent] Thornfield Capital Partners (client) → this block;
  [children] Sarah Okonkwo (contact), Marcus Webb (contact)
```

Or if no edges:
```
Block relationships: none recorded
```

**Failure handling:** If edge query fails, log `semantic.graph_context_failed` at warn level, omit relationships line, and continue — never throw.

---

### Performance Constraint

The existing `assembleContext()` already runs several queries. Adding 2–3 more must not cause observable latency regression. Use `Promise.all` to batch new queries alongside existing ones rather than adding sequential awaits.

**Target:** both new enrichments should resolve within the existing query window (< 200ms in normal Supabase latency).

---

**Acceptance Criteria:**
- [ ] `assembleContext()` with `blockId = null` prepends org-level summary to context string
- [ ] Org summary includes: total blocks (by type), active workflow jobs count, events in last 24h
- [ ] `assembleContext()` with `blockId` set includes direct edge neighbours (names + types) in context string
- [ ] Edge context gracefully omitted when `blockId` is null or block has no edges
- [ ] New queries run in `Promise.all` alongside existing queries — not sequential
- [ ] Org summary query failure → warn log + omit line + never throw
- [ ] Graph context query failure → warn log + omit line + never throw
- [ ] Unit tests:
  - [ ] Org summary present in null-blockId context output
  - [ ] Block graph context present when edges exist
  - [ ] Block graph context absent when no edges exist
  - [ ] Org summary omitted gracefully on query failure
  - [ ] Graph context omitted gracefully on query failure
- [ ] All existing context-assembly tests still pass (93 total passing Sprint 2 exit)
- [ ] Lint zero errors

**Applicable Gates:** 1, 2, 5
**Owner once claimed:** AI-ML-ENGINEER

---

## Files You Will Touch

| File | Change |
|------|--------|
| `src/lib/context-assembly.ts` | EDIT — two new enrichments |
| `tests/unit/context-assembly.test.ts` | EDIT — add tests for new branches |

---

## Standards Reminder

- No new npm dependencies — all queries use existing `@supabase/supabase-js`
- `OPENAI_API_KEY` env guard remains in place (Sprint 2 pattern)
- No `console.log` — use `logger` from `@/lib/logger`
- `assembleContext()` is a shared service — test both null-blockId and blockId code paths
- Run `npx vitest run tests/unit/context-assembly.test.ts` to verify
