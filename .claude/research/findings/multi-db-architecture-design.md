# Multi-Database Architecture Design

> Research Report — P6-S21-RES-03
> Date: 2026-03-17
> Confidence Score: 8/10

---

## 1. Executive Summary

Ops OS runs entirely on Supabase Postgres (single database). This architecture is correct for the current scale and budget (bootstrap/pre-revenue). Multi-database architecture (Redis cache, read replicas, event sourcing) adds operational complexity that is only justified when specific, measurable bottlenecks appear. **Recommendation: implement Redis hot cache as the first step when API response times exceed 200ms p95, add read replicas when write/read contention is measurable, and defer event sourcing until the event bus migration (RES-01) is underway.** Each phase has explicit entry criteria, cost projections, and rollback paths.

---

## 2. Market Signals

- **Single-database architectures** dominate at startup scale. Supabase, PlanetScale, and Neon all optimize for the "one database does everything" pattern with connection pooling, read replicas, and caching built into the platform.
- **Redis adoption** is near-universal as the first infrastructure addition. 85%+ of production SaaS applications add Redis before any other data store, primarily for session management and hot-path caching.
- **Read replicas** are available on Supabase Pro plan ($25/month base + compute). This is the cheapest path to read scaling without any application code changes (just point read queries to the replica connection string).
- **Event sourcing** adoption in SaaS is rare outside of financial services, gaming, and collaborative editing. Most teams that attempt it underestimate the complexity of projections, snapshotting, and schema evolution. However, Ops OS's `events` table is already an append-only audit log — a natural foundation.
- **CQRS (Command Query Responsibility Segregation)** pairs well with event sourcing but can be adopted independently. Separate read models (materialized views, denormalized tables) improve query performance without changing the write path.

---

## 3. Competitor Map

| Platform | Primary DB | Cache Layer | Read Scaling | Event Store | CQRS |
|----------|-----------|-------------|-------------|-------------|------|
| Monday.com | Postgres | Redis (ElastiCache) | Read replicas | Kafka | Partial |
| Salesforce | Proprietary | Distributed cache | Multi-region sharding | Platform Events | Yes |
| HubSpot | MySQL | Redis + Memcached | Read replicas | Kafka topics | Partial |
| Notion | Postgres | Redis | Read replicas | Postgres WAL | No |
| Linear | Postgres | Redis | Connection pooling | Postgres + Redis | No |
| Airtable | Postgres | Redis | Read replicas | Change log table | No |
| ServiceNow | Proprietary | Distributed cache | Multi-instance | Event management | Yes |

**Common Pattern:** Postgres → add Redis → add read replicas → add event streaming (Kafka) → add CQRS projections. This is the order almost every SaaS follows.

---

## 4. Risk Flags

| # | Risk | Likelihood | Impact | Score | Mitigation |
|---|------|-----------|--------|-------|------------|
| 1 | Premature optimization — adding cache before bottleneck exists | HIGH | MEDIUM | 12 | Explicit entry criteria (p95 > 200ms) |
| 2 | Cache invalidation bugs (stale data shown to users) | HIGH | HIGH | 16 | TTL-based expiry (not event-based) initially. Short TTLs (60-300s). |
| 3 | Read replica lag causing stale reads | MEDIUM | MEDIUM | 9 | Only use replica for dashboard/analytics queries, not transactional reads |
| 4 | Event sourcing complexity exceeds team capacity | HIGH | HIGH | 16 | Defer to Phase 8+. Start with CQRS projections (materialized views) first. |
| 5 | Redis operational overhead (memory management, persistence) | MEDIUM | LOW | 6 | Use managed Redis (Upstash serverless or Vercel KV). No self-hosting. |
| 6 | Multi-database consistency issues | MEDIUM | HIGH | 15 | Cache-aside pattern with TTL. Never write-through. Postgres is always source of truth. |
| 7 | Cost escalation from multiple managed services | MEDIUM | MEDIUM | 9 | Budget caps per service. Monthly review. |

---

## 5. Recommendation

### Three-phase migration with explicit entry criteria.

---

### Phase A: Redis Hot Cache (When p95 API response > 200ms)

**Entry criteria (need 2+):**
- API p95 response time > 200ms (measured via Vercel Analytics)
- Same query executed > 100 times/hour (hot path identified)
- Database CPU utilization > 60% sustained

**Implementation:**
- Add Upstash Redis (serverless, $0.20/100K commands) or Vercel KV
- Cache-aside pattern: check cache → miss → query Postgres → write to cache with TTL
- TTL strategy:
  - Block metadata: 300s (5 minutes) — changes infrequently
  - Org settings/RBAC: 120s (2 minutes) — security-sensitive, shorter TTL
  - Dashboard aggregations: 60s (1 minute) — frequently changing
  - User session data: 3600s (1 hour) — rarely changes mid-session
- Cache key format: `ops:{org_id}:{entity}:{id}` (e.g., `ops:org-1:block:block-abc`)
- Invalidation: TTL-based only (no event-based invalidation in Phase A). Simple and predictable.

**Cache candidates (by query frequency):**

| Query | Current Frequency | TTL | Expected Hit Rate |
|-------|------------------|-----|-------------------|
| Org settings + RBAC | Every authenticated request | 120s | 95%+ |
| Block by ID | Dashboard, detail pages | 300s | 80%+ |
| Block list (paginated) | Dashboard, library | 60s | 60%+ |
| Workflow template list | Canvas, templates page | 300s | 90%+ |
| User permissions | Every auth check | 120s | 95%+ |

**Cost estimate:** $5-20/month (Upstash serverless pricing)

**Rollback:** Remove cache reads. All queries fall back to Postgres. Zero data risk.

---

### Phase B: Read Replicas (When write/read contention is measurable)

**Entry criteria (need 2+):**
- Database connection pool > 70% utilized
- Write transactions blocking read queries (lock contention in pg_stat_activity)
- Dashboard/analytics queries taking > 500ms due to table scans competing with writes

**Implementation:**
- Enable Supabase read replica (Pro plan feature, ~$25-50/month additional compute)
- Route read-only queries to replica connection string:
  - All GET API routes (dashboard, list, search)
  - Analytics and reporting queries
  - AI embedding search
- Keep write operations on primary:
  - All POST/PATCH/DELETE routes
  - Transaction blocks
  - Workflow engine step execution
- Use connection string environment variables: `DATABASE_URL` (primary) + `DATABASE_URL_REPLICA` (read)

**Application code change:**
```typescript
// src/lib/supabase/server.ts
export function createReadClient() {
  // Uses replica connection string for read-only operations
  return createClient(process.env.DATABASE_URL_REPLICA || process.env.DATABASE_URL)
}
```

**Cost estimate:** $25-75/month (Supabase read replica compute)

**Rollback:** Point all queries back to primary. Single env var change.

---

### Phase C: Event Sourcing Foundation (When event bus migration is underway — ties to RES-01)

**Entry criteria:**
- Event bus Tier 2 (transactional outbox) is operational (from RES-01 plan)
- Need for temporal queries ("what was the state of block X on date Y")
- Audit requirements from design partners require provable state reconstruction

**Implementation:**
- Events table is already append-only audit log. Promote to event source.
- Add `aggregate_id` (block ID) and `aggregate_version` (sequence number) columns
- Build projection functions: replay events → current state for any block
- Snapshot table: periodic materialization of current state (every N events per aggregate)
- CQRS read models: materialized views for common query patterns (block list, dashboard stats)

**This is the most complex phase.** Key decisions:
- **Snapshot frequency:** Every 100 events per aggregate, or on explicit snapshot command
- **Projection rebuild:** Must be idempotent and restartable
- **Schema evolution:** Event upcasting functions for when event shapes change
- **Consistency:** Eventual consistency between event store and projections (typically < 1 second)

**Cost estimate:** Engineering time is the primary cost (2-4 weeks). Infrastructure: minimal additional (existing Postgres + Redis).

**Rollback:** Continue using current block table as source of truth. Events table remains audit log. Projections are supplementary read models.

---

## 6. Confidence Score: 8/10

**High confidence.** The phased approach (cache → replicas → event sourcing) is the industry-standard path. Each phase has clear entry criteria preventing premature optimization. The main uncertainty is Phase C (event sourcing) — the complexity is well-documented but execution risk is high. The 8/10 reflects high confidence in Phases A and B (proven patterns, managed services, clear rollback) with moderate confidence in Phase C timing and scope.

---

## Appendix A: Supavisor Connection Pooling

Supabase projects include Supavisor (PgBouncer successor) for connection pooling. Current Ops OS setup:

- **Transaction mode** (default): Each query gets a connection from the pool, returned after transaction completes
- **Session mode:** Connection held for entire session (needed for prepared statements, LISTEN/NOTIFY)
- **Pool size:** Depends on Supabase plan. Free: 15, Pro: 100, Team: 200

**Recommendation:** Ensure all API routes use transaction mode (default). Only workflow engine cron (which may use LISTEN/NOTIFY in future) needs session mode. Monitor pool utilization via Supabase dashboard.

## Appendix B: Table-by-Table Cache Candidacy

| Table | Read Frequency | Write Frequency | Cache? | TTL | Notes |
|-------|---------------|-----------------|--------|-----|-------|
| `orgs` | Every request (auth) | Rare | Yes | 300s | Org settings, billing |
| `blocks` | Very high (core entity) | High | Yes (by ID) | 300s | List queries use short TTL |
| `edges` | High (relationships) | Medium | Maybe | 120s | Depends on graph query frequency |
| `events` | Medium (audit log) | Very high (append) | No | — | Write-heavy, no read hot path |
| `time_entries` | Medium | Medium | No | — | User-specific, low cache hit rate |
| `calendar_events` | Medium | Low | Yes | 300s | Per-user calendar view |
| `performance_snapshots` | Low (weekly) | Very low (cron) | Yes | 3600s | Dashboard aggregations |
| `workflow_instances` | Medium | High | No | — | Frequently changing state |
| `team_members` | Medium (RBAC) | Low | Yes | 120s | Permission checks |
| `notifications` | Medium | Medium | No | — | Real-time, staleness unacceptable |
