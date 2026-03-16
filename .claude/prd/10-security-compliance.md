# PRD Layer 10: Security and Compliance

> Last updated: 2026-03-12 | Author: All roles review | Status: DRAFT
> All roles read this document. Security is everyone's responsibility.
> Cross-references: `prd/04-data-models.md` (PII inventory), `prd/08-infra-devops.md` (secrets), `prd/05-api-contracts.md` (auth scheme).
> Also read: `.claude/rules/security-baseline.md` — unconditional security rules for every agent.

---

## Security Requirements Summary

Ops OS handles business operations data for capital markets and financial services firms — a regulated industry with strict requirements for data integrity, audit trails, and access control. "Secure" for Ops OS means:

1. **The event timeline is tamper-proof** — no UPDATE or DELETE on events, ever, enforced at the database layer
2. **Org isolation is absolute** — no cross-org data access is possible, enforced at every query
3. **Every action is attributable** — actor_id and actor_type are recorded on every event; there is no anonymous mutation
4. **PII never leaks into logs or AI prompts** — enforced by code and validated in Gate 5 on every task
5. **Auth is never bypassed** — withAuth middleware on every protected route, no ad-hoc auth

**Compliance requirements that apply:**
- [x] GDPR (EU design partners — FCA-regulated firms are in the EU/UK)
- [x] UK GDPR (post-Brexit equivalent; applies to UK firms under FCA)
- [ ] CCPA (California users — applies if US design partners have California employees)
- [ ] SOC 2 Type II (required for enterprise capital markets customers — Phase 2, not Phase 1)
- [ ] FCA operational resilience (relevant for regulated-firm design partners — evaluate at Phase 2)
- [ ] MAS data residency (Singapore — block APAC design partner agreements until verified)

---

## Authentication and Authorisation Model

**Authentication:** Clerk JWT Bearer token — validated on every request by `withAuth` middleware at `src/middleware/withAuth.ts`.

| Token Type | Where Handled | Notes |
|-----------|--------------|-------|
| Session token | Clerk (browser cookie) | Clerk manages refresh automatically |
| JWT (API auth) | Clerk SDK on server | Validated in `withAuth`; short-lived |
| Webhook signature | `svix-signature` header | Verified before processing Clerk webhooks |

**Authorisation model:** Role-based (Clerk organisations + custom roles)

| Role | Permissions | Clerk Implementation |
|------|------------|---------------------|
| `org:admin` | All resources in org; manage members | Clerk org admin role |
| `org:member` | Read + create blocks/events in org | Clerk org member role |
| `compliance_approver` | Approve compliance workflow steps | Custom Clerk role |
| `read_only` | Read blocks and events; no mutations | Custom Clerk role (Phase 2) |

**Rules (non-negotiable):**
- Auth is middleware — never ad-hoc in route handlers
- Every protected route has `withAuth` in its middleware chain
- Ownership checks are server-side — `org_id` from JWT only, never from client request body
- No route skips auth "for convenience" or "for testing" in production

---

## Data Classification

| Level | Description | Examples in Ops OS | Required Handling |
|-------|-------------|-------------------|------------------|
| Level 1 — Direct Identifier | Uniquely identifies a person | Contact name, email, phone in block data | Never log; never in AI prompts; delete on request |
| Level 2 — Indirect Identifier | Identifies in combination with other data | Clerk user ID (actor_id in events), IP address | Pseudonymise in analytics; retention limits |
| Level 3 — Sensitive Business Data | Confidential commercial / regulatory data | Client deal details, compliance assessment results | Access control + audit log (events table) |
| Level 4 — Operational Data | System metadata with no privacy implications | Block type, workflow step name, org ID | Standard handling |

---

## PII Inventory

| Table | Field | Classification | At Rest | In Logs | In AI Prompts | Retention |
|-------|-------|---------------|---------|---------|--------------|----------|
| blocks | `name` (contact type) | Level 1 | Postgres default | NEVER | Only within user's own org; never email/phone | Until org deletion |
| blocks | `data->>'email'` | Level 1 | Postgres default | NEVER | NEVER | Until org deletion |
| blocks | `data->>'phone'` | Level 1 | Postgres default | NEVER | NEVER | Until org deletion |
| events | `actor_id` | Level 2 — Pseudonymous | Postgres default | OK (user ID only) | OK (user ID only) | Indefinite (audit) |
| events | `payload` JSONB | Level 3 potentially | Postgres default | NEVER raw | NEVER raw | Indefinite (audit) |
| embeddings | `content` | Derived — PII stripped at source | Postgres default | NEVER | OK (PII stripped) | Until source deleted |
| orgs | `name` | Level 4 | Postgres default | OK | OK | Until org deletion |

**PII stripping rule for embeddings:** `buildEmbeddingContent()` in `src/lib/embeddings.ts` must strip email, phone, and other Level 1 fields before building content text. Validated in unit tests.

**Logging rule:** `src/lib/logger.ts` structured logger. Required fields: `service`, `event`. Forbidden fields: any user-identifiable data. Validated in Gate 5 on every backend task.

---

## Encryption Requirements

| Data | At Rest | In Transit | Key Management |
|------|---------|-----------|----------------|
| All database data | Supabase Postgres AES-256 (managed) | TLS 1.3 (Supabase managed) | Supabase manages |
| API secrets (API keys, JWT signing) | Vercel environment variables (encrypted) | TLS | Vercel manages |
| Backups | Supabase managed backups (encrypted) | TLS | Supabase manages |

Phase 1: No column-level encryption. Supabase provides database-level encryption at rest. Column-level encryption for Level 1 PII (contact email/phone) is a Phase 2 requirement before enterprise capital markets deals.

---

## Event Immutability Enforcement

This is the most critical security control in Ops OS. It is both a compliance requirement and a product feature.

**Enforcement layers (defence in depth):**
1. **Database RLS:** No `UPDATE` or `DELETE` permissions on `events` table for any Supabase role — including the service role. Enforced via Row Level Security policy.
2. **API layer:** No `UPDATE` or `DELETE` routes exist for events. The API can only `INSERT` events.
3. **Contract tests:** `tests/api/events.test.ts` includes tests that verify events cannot be modified or deleted (real Supabase, not mocks).
4. **Monitoring:** Supabase audit logs checked monthly to confirm no events have been modified.

**RLS policy (from migration `20260302000001`):**
```sql
-- No one can UPDATE or DELETE events
CREATE POLICY "events_no_update" ON events AS RESTRICTIVE
  FOR UPDATE USING (false);
CREATE POLICY "events_no_delete" ON events AS RESTRICTIVE
  FOR DELETE USING (false);
```

---

## Org Isolation

All database queries include `org_id` from the Clerk JWT. This is enforced at two levels:

1. **Application layer:** Every Supabase query in `src/` includes `WHERE org_id = :org_id` where `org_id` is extracted from the Clerk JWT by `withAuth` middleware.
2. **Database RLS:** Row Level Security policies ensure rows are only accessible to the org they belong to.

**Testing:** Contract tests (`tests/api/`) include cross-org isolation tests: attempt to access data from one org while authenticated as a different org — must return 404 or 403.

---

## Input Validation

- All API request bodies validated via Zod schemas at `src/app/api/` route handlers
- Validation runs before any database query or business logic
- Rejection on invalid input: 400 with standard error envelope, no internal details
- User-supplied `block_id`, `org_id` values are verified against the authenticated org — never trusted at face value

---

## Compliance Requirements in Detail

### UK GDPR / GDPR (EU Users)

| Requirement | Implementation | Status | Phase |
|------------|---------------|--------|-------|
| Right to access | Export user data endpoint (events + blocks for user) | PLANNED | Phase 2 |
| Right to erasure | Delete org data endpoint + cascade | PLANNED | Phase 2 |
| Data portability | JSON export of org's blocks and events | PLANNED | Phase 2 |
| Consent management | Clerk handles auth consent; no marketing | NOT NEEDED Phase 1 | Phase 1 OK |
| Data processing records | Events table serves as processing records | DONE | Phase 1 |
| Breach notification (72h) | Incident response process (see below) | PLANNED | Document in Phase 2 |
| DPA with sub-processors | Supabase DPA, Clerk DPA, Anthropic DPA | NEEDED before enterprise | Phase 2 |

### SOC 2 Type II

- **Status:** Not started. Begins Phase 2 after first revenue signal.
- **Timeline:** SOC 2 Type II takes 6–12 months minimum.
- **Mitigation for Phase 1:** Design partner pilots use test/anonymised data. No production client data until SOC 2 complete.
- **Required controls:** Access control, availability, confidentiality, processing integrity. Most are already implemented by architecture choices (immutable events, RLS, auth middleware).

### FCA Operational Resilience (UK Design Partners)

FCA-regulated design partners may require evidence of:
- Operational resilience (uptime SLAs, disaster recovery)
- Audit trail completeness (immutable events satisfy this)
- Data residency in UK/EU (Supabase EU-West Ireland satisfies this)

**Phase 1 mitigation:** Position as a pilot / design partner arrangement, not a production system. Design partners agree to pilot terms that don't trigger full FCA operational resilience requirements.

### MAS Data Residency (Singapore)

**Status:** BLOCKED on Supabase Singapore region verification.
**Action required:** Before signing any APAC design partner — verify Supabase Singapore region availability. If not available: evaluate Neon (self-hosted Postgres in Singapore) or exclude APAC design partners from Phase 1.

---

## Vulnerability Management

**Dependency scanning:** `npm audit` runs in CI on every PR. Block deploy if HIGH or CRITICAL CVEs found.

**Secret detection:** Git hook (pre-commit) scans staged files for common secret patterns. See `.claude/rules/security-baseline.md` for the command.

**Response SLA:**
| Severity | Response Time | Fix Timeline |
|---------|--------------|-------------|
| Critical CVE | 24 hours | 48 hours |
| High CVE | 48 hours | 1 week |
| Medium CVE | 1 week | Next sprint |

---

## Third-Party Service Risk Assessment

| Service | What Data It Receives | Risk Level | Mitigation |
|---------|----------------------|-----------|-----------|
| Claude API (Anthropic) | Business graph context (block names, event summaries) — no email/phone | MEDIUM | PII-free prompt policy in `prd/07-ai-ml-spec.md`; reviewed per AI task |
| OpenAI Embeddings | PII-stripped text content from blocks and events | LOW | `buildEmbeddingContent()` strips PII; unit-tested |
| Clerk | User email, org name, JWT tokens | MEDIUM | Standard auth provider; Clerk DPA available; GDPR-compliant |
| Supabase | All application data (primary datastore) | HIGH | Supabase DPA; EU region; RLS enforced; encrypted at rest |
| Vercel | Application code + logs (no user data in logs per policy) | LOW | No PII in logs per logging policy; Vercel DPA available |
| Resend | Notification email content (Phase 2) | MEDIUM | No bulk email; transactional only; Resend DPA |

---

## Security Review Checkpoints

| Checkpoint | When | Who Reviews | What They Check |
|-----------|------|------------|----------------|
| Gate 5 (per task) | Every task completion | Task owner | Input validation, auth, no PII in logs, no secrets committed |
| PRD security review | After this document is written | All roles | Security requirements complete and understood |
| Design review | Before sprint starts | Backend + DevOps | Auth model, data handling, RLS policies |
| Pre-design-partner launch | Before first design partner uses production | PM + DevOps | GDPR compliance, data residency confirmed, secrets rotated |

---

## Incident Response

**Breach response process:**
1. **Identify:** What data is affected? How many orgs? What was the attack vector?
2. **Contain:** Revoke compromised API keys / JWT signing keys. Take affected service offline if necessary.
3. **Notify design partners:** Email directly within 24 hours of confirmed breach.
4. **GDPR notification:** If personal data is affected — notify relevant supervisory authority (ICO for UK) within 72 hours.
5. **Remediate:** Fix root cause. Rotate all secrets. Audit access logs.
6. **Post-mortem:** Document what happened, how it was detected, and preventive measures.

**Who to contact:** Founder (primary incident responder in Phase 1). No formal security team until Phase 2.

---

## Phase 3 Security Requirements

### Granular RBAC Permission Model
- 10 permissions replace the simple 3-role system
- Permissions checked on every API request via `requirePermission()` middleware
- System roles (ops-admin, ops-user, compliance-approver) are backward compatible — they map to permission sets
- Custom roles: orgs create roles with arbitrary permission combinations
- Permission changes logged as `rbac.permission.granted` / `rbac.permission.revoked` events
- **Audit requirement:** Every permission check that denies access must be logged with: user_id, permission_required, endpoint, timestamp

### Agent Decision Audit Logging
- Every AI routing decision logged as `routing.decision.made` event with: confidence score, risk level, routing outcome, reasoning text
- Every task approval/rejection/modification logged with: original AI recommendation, human decision, modifications made
- Auto-executed tasks (confidence ≥ threshold, risk = low) logged with same detail as human-reviewed tasks
- **Compliance requirement:** Regulators must be able to reconstruct any AI decision chain from events table alone

### API Key Security
- Keys hashed with SHA-256 before storage — raw key never persisted
- Key shown to user exactly once on creation — cannot be retrieved after
- Key prefix stored in plaintext for identification (e.g. `opskey_abc...`)
- Rate limiting per API key (independent from user auth limits)
- Key creation/revocation logged as events with actor_id
- Keys have optional expiration date — expired keys automatically rejected
- **No key in logs:** API key values must never appear in any log statement

### Routing Decision Audit Trail
- The routing engine's decision path must be fully reconstructable:
  1. Step config (requested routing mode)
  2. Org policy (default routing rules from Policy block)
  3. AI confidence score + factors
  4. Risk assessment
  5. Final decision + reasoning
- All stored in the `routing.decision.made` event payload
- Retention: indefinite (part of immutable events table)

### Sub-Org Data Isolation
- Sub-orgs inherit parent org's data access by default
- Child orgs can see parent org data; parent orgs can see child org data
- Cross-branch isolation: Department A cannot see Department B data (unless both under same parent with explicit permission)
- All org-scoped queries must use `getOrgHierarchyIds()` utility to include appropriate org scope

---

## Archived

> Superseded security requirements moved here. Never deleted.
