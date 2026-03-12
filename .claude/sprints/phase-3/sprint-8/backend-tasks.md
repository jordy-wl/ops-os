# Sprint 8 — Backend Tasks

## P3-S8-BE-01 — Routing Policy Settings API (MEDIUM)

**Priority:** 1 (FE-02 depends on this)
**Deps:** None (Sprint 4 routing engine is external prerequisite)
**Gates:** G1, G2, G3, G5

### What to Build
CRUD API for org-level routing policies stored as a policy block with type `org_default`. Policy contains confidence threshold (0-1), risk level-to-routing mode mappings, and any org-specific overrides. This extends the routing engine from Sprint 4 with a settings-driven configuration layer.

### Key Files
- Create: `src/app/api/settings/routing/route.ts` -- GET (current policy) and PUT (update policy)
- Create: `src/lib/routing/policy-settings.ts` -- policy CRUD helpers, default policy factory, validation
- Create: `src/lib/routing/policy-types.ts` -- RoutingPolicy type (confidence_threshold, risk_matrix, overrides)
- Modify: `src/lib/routing/` -- routing engine reads org policy from settings instead of hardcoded defaults
- Create: `src/lib/routing/__tests__/policy-settings.test.ts` -- CRUD tests, validation, default fallback

### Acceptance Criteria
- [ ] GET /api/settings/routing returns current org routing policy (or defaults if none set)
- [ ] PUT /api/settings/routing validates and saves policy: confidence_threshold (0-1), risk_matrix (4 levels x 3 modes)
- [ ] Routing engine reads org policy on each routing decision (cached for 5 minutes)
- [ ] Validation: confidence_threshold must be 0-1, all 4 risk levels must have a mode assigned
- [ ] Only ops-admin role can update routing policies (RBAC check in middleware)

---

## P3-S8-BE-02 — API Key Management (HIGH)

**Priority:** 1 (independent, start immediately)
**Deps:** None
**Gates:** G1, G2, G3, G5, G6

### What to Build
Generate and revoke org-scoped API keys for external integrations. Keys are hashed before storage (only the prefix is stored in cleartext for identification). Rate limiting per key. All key operations logged to the audit trail (events table).

### Key Files
- Create: `supabase/migrations/YYYYMMDD_api_keys.sql` -- api_keys table (id, org_id, name, key_prefix, key_hash, created_by, created_at, revoked_at, last_used_at, rate_limit)
- Create: `src/app/api/keys/route.ts` -- GET (list org keys, masked), POST (generate new key)
- Create: `src/app/api/keys/[id]/route.ts` -- DELETE (revoke key)
- Create: `src/lib/auth/api-keys.ts` -- key generation (crypto.randomBytes), hashing (SHA-256), validation middleware
- Create: `src/middleware/rate-limit.ts` -- per-key rate limiting (in-memory counter, configurable limit)
- Create: `src/lib/auth/__tests__/api-keys.test.ts` -- generation, hashing, validation, revocation

### Acceptance Criteria
- [ ] POST /api/keys generates a key (returned once in cleartext), stores hash + prefix
- [ ] GET /api/keys returns list with masked keys (prefix + ****), never cleartext
- [ ] DELETE /api/keys/[id] soft-revokes (sets revoked_at), revoked keys rejected on validation
- [ ] Key validation middleware: hash incoming key, compare to stored hash, check not revoked
- [ ] Rate limiting: default 100 requests/minute per key, configurable per key
- [ ] All operations (create, revoke, use) logged as events in audit trail
- [ ] Only ops-admin can generate/revoke keys (RBAC check)
