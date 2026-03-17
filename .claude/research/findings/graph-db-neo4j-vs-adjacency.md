# Graph Database: Neo4j vs Adjacency List for Block Edges

> Research Report — P6-S21-RES-02
> Date: 2026-03-17
> Confidence Score: 7/10

---

## 1. Executive Summary

Ops OS models relationships between Blocks using an `edges` table (adjacency list) in Postgres. This pattern handles the current use cases (block-to-block references, workflow dependencies, org hierarchy) efficiently. Neo4j would provide superior query performance for deep graph traversals (6+ hops) and pattern matching, but at significant operational cost ($100-300/month managed, separate data sync, new query language). **Recommendation: stay on Postgres adjacency list for 12+ months.** Add recursive CTEs and materialized path columns for the 2-3 query patterns that need depth. Evaluate Apache AGE (Postgres graph extension) as a zero-migration stepping stone if graph queries become a bottleneck.

---

## 2. Market Signals

- **Adjacency list + recursive CTEs** handle 90%+ of graph queries at startup scale. Companies like Linear, Notion, and Airtable model relationships in Postgres without a graph DB.
- **Neo4j adoption** is concentrated in fraud detection, knowledge graphs, and recommendation engines — domains where traversal depth and pattern matching are core requirements, not secondary features.
- **Apache AGE** (A Graph Extension) for Postgres enables Cypher-like queries on existing Postgres tables. Open source, installable as an extension. Eliminates the dual-database problem.
- **Supabase does not support Apache AGE** as a managed extension. Using AGE would require self-hosting or a different Postgres provider, negating the Supabase convenience benefit.
- **Graph query demand in BOS products** is moderate: org hierarchy traversal (3-4 levels), dependency resolution (which blocks depend on which), impact analysis (what breaks if this block changes). None of these typically exceed 5-6 hops.

---

## 3. Competitor Map

| Platform | Graph Approach | Database | Max Depth | Notes |
|----------|---------------|----------|-----------|-------|
| Monday.com | Adjacency list | MySQL/Postgres | 3-4 levels | Board → Group → Item → Subitem |
| Salesforce | Adjacency list + SOQL | Proprietary | 5 levels | Object relationships, lookup chains |
| HubSpot | Adjacency list | MySQL | 3 levels | Associations API (company → deal → contact) |
| Notion | Adjacency list | Postgres | 3-4 levels | Page → Subpage → Block hierarchy |
| Linear | Adjacency list | Postgres | 2-3 levels | Project → Issue → Sub-issue |
| Palantir | Neo4j + Postgres | Dual | Unlimited | Ontology-based, enterprise graph |
| ServiceNow | CMDB graph (proprietary) | Proprietary | 10+ levels | Configuration item dependency mapping |

**Technology Comparison:**

| Technology | Query Complexity | Write Performance | Operational Cost | Migration Effort |
|-----------|-----------------|-------------------|-----------------|-----------------|
| Postgres adjacency list (current) | Simple-Medium | Excellent | $0 | None |
| Postgres + recursive CTE | Medium-High | Excellent | $0 | 1-2 days |
| Postgres + materialized paths | Medium | Good (write overhead) | $0 | 2-3 days |
| Postgres + closure table | High | Fair (trigger overhead) | $0 | 3-5 days |
| Apache AGE (Postgres ext) | High | Good | $0 (self-host needed) | 1-2 weeks |
| Neo4j (managed) | Very High | Good | $100-300/mo | 2-4 weeks |
| Amazon Neptune | Very High | Good | $150-500/mo | 2-4 weeks |
| Dgraph | Very High | Excellent | $100-400/mo | 3-6 weeks |

---

## 4. Risk Flags

| # | Risk | Likelihood | Impact | Score | Mitigation |
|---|------|-----------|--------|-------|------------|
| 1 | Recursive CTE performance degrades at depth >8 | LOW | MEDIUM | 6 | Ops OS max depth is 4 (org hierarchy). Add depth limit to all CTEs. |
| 2 | Neo4j sync consistency (dual write) | HIGH | HIGH | 16 | Only relevant if Neo4j is adopted. Outbox + CDC pattern required. |
| 3 | Apache AGE not available on Supabase | HIGH | MEDIUM | 12 | Would require infrastructure migration. Defer to Phase 8+. |
| 4 | Edge table grows large (>1M rows) | LOW | LOW | 4 | Partition by org_id. Add composite index (source_id, target_id, type). |
| 5 | Impact analysis queries (what depends on X) slow | MEDIUM | MEDIUM | 9 | Materialized view for critical paths. Refresh on edge changes. |
| 6 | Vendor lock-in with Neo4j Cypher language | MEDIUM | HIGH | 15 | Use openCypher standard; consider Apache AGE for portability. |

---

## 5. Recommendation

### Stay on Postgres adjacency list. Enhance with 3 targeted optimizations.

**Optimization 1 — Recursive CTEs for depth queries (Now):**
```sql
-- Example: Get all ancestors of a block (org hierarchy traversal)
WITH RECURSIVE ancestors AS (
  SELECT source_block_id, target_block_id, type, 1 AS depth
  FROM edges WHERE target_block_id = $1 AND type = 'parent_of'
  UNION ALL
  SELECT e.source_block_id, e.target_block_id, e.type, a.depth + 1
  FROM edges e JOIN ancestors a ON e.target_block_id = a.source_block_id
  WHERE a.depth < 10  -- safety limit
)
SELECT * FROM ancestors;
```

Covers: org hierarchy traversal, workflow dependency resolution, block ancestry queries.

**Optimization 2 — Materialized path column for org hierarchy (Phase 7):**
Add `org_path TEXT` to blocks table (e.g., `/org-1/dept-a/team-x/member-y`). Update on edge changes via trigger. Enables `LIKE 'org-1/dept-a/%'` queries for subtree retrieval without recursion. Only needed for the org hierarchy (4-level max), not general block edges.

**Optimization 3 — Impact analysis materialized view (Phase 8+):**
```sql
CREATE MATERIALIZED VIEW block_dependency_graph AS
WITH RECURSIVE deps AS (
  SELECT source_block_id, target_block_id, type,
         ARRAY[source_block_id] AS path, 1 AS depth
  FROM edges WHERE type IN ('depends_on', 'triggers', 'parent_of')
  UNION ALL
  SELECT d.source_block_id, e.target_block_id, e.type,
         d.path || e.source_block_id, d.depth + 1
  FROM deps d JOIN edges e ON d.target_block_id = e.source_block_id
  WHERE d.depth < 8 AND NOT e.source_block_id = ANY(d.path)
)
SELECT * FROM deps;
```
Refresh on demand or via pg_cron. Used for "what breaks if I delete this block" analysis.

### When to consider Neo4j / Apache AGE

| Trigger | Threshold |
|---------|-----------|
| Average graph query time | >500ms at depth 4+ |
| Edge table size | >5M rows with frequent traversals |
| New use case requiring pattern matching | Fraud detection, recommendation engine |
| Graph queries exceed 20% of total query volume | Monitoring dashboard metric |
| Recursive CTE causing connection pool pressure | >30% of pool used by graph queries |

---

## 6. Confidence Score: 7/10

**Moderate-high confidence.** The adjacency list pattern is proven at the current and near-future scale of Ops OS. The risk is that financial services use cases (multi-jurisdiction compliance chains, complex approval hierarchies) may push depth requirements beyond what recursive CTEs handle efficiently. However, Ops OS's 4-level org hierarchy and block-to-block edges are well within Postgres comfort zone. The 7 (vs 8+) reflects uncertainty about Apache AGE maturity on managed Postgres platforms and the lack of real load-test data on the current edges table.

---

## Appendix A: Current Edge Table Schema

```sql
-- Current schema (from initial migration)
CREATE TABLE edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  source_block_id UUID NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  target_block_id UUID NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Current edge types:** `parent_of`, `depends_on`, `triggers`, `references`, `assigned_to`, `belongs_to`

**Current query patterns:**
1. Direct neighbors: `WHERE source_block_id = $1` (fast, indexed)
2. Reverse lookup: `WHERE target_block_id = $1` (fast, indexed)
3. Type filter: `WHERE type = $1 AND org_id = $2` (fast, indexed)
4. Org hierarchy: 2-3 level traversal via application code (multiple queries) — candidate for recursive CTE

## Appendix B: Neo4j vs Postgres Performance Benchmarks (External Sources)

| Query Type | Postgres (adjacency) | Postgres (recursive CTE) | Neo4j |
|-----------|---------------------|------------------------|-------|
| Direct neighbors | <1ms | N/A | <1ms |
| 2-hop traversal | 2-5ms | 3-8ms | 1-3ms |
| 4-hop traversal | 10-30ms | 15-40ms | 3-8ms |
| 8-hop traversal | 100-500ms | 200-800ms | 5-15ms |
| Pattern matching (A→B→C where B.type=X) | Complex JOIN | Complex CTE | 2-5ms (Cypher) |
| Full graph scan | Not practical | Not practical | 50-200ms |

*Benchmarks from public Neo4j whitepapers and Postgres community benchmarks. Actual performance depends on data shape, indexing, and hardware.*
