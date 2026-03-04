# PRD Layer 08: Infrastructure and DevOps

> Last updated: 2026-03-02 | Author: DevOps Engineer | Status: DRAFT
> Cross-references: `prd/10-security-compliance.md` (secrets, compliance), `prd/03-system-architecture.md` (component map).
> DevOps engineer: read this before claiming tasks.

---

## Cloud Provider and Region

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary hosting | Vercel | Auto-deploy from GitHub; serverless functions; zero DevOps overhead at prototype |
| Primary database | Supabase | ap-south-1 (Mumbai); pgvector + Realtime built in; free tier |
| Primary region | APAC (ap-south-1) | ASIC data residency for Australia design partners; closest Supabase region to ASIC jurisdiction |
| Multi-region | NO (Phase 1) | Phase 4 concern; FCA (EU-West) and MAS (Singapore) regions added when multi-jurisdiction is required |
| EU region (Phase 4) | Supabase EU West (Ireland) | FCA data residency for UK clients |

---

## Environment Structure

| Environment | Purpose | Config Source | Deployed by |
|------------|---------|--------------|------------|
| Development | Local development | `.env.local` (gitignored) | Manual (`next dev`) |
| Preview | PR branch preview | Vercel environment variables (preview set) | Vercel auto-deploy on PR |
| Production | Live design partners | Vercel environment variables (production set) | Vercel auto-deploy on push to `main` |

**Parity rule:** Preview and production environments are configured from the same Vercel environment variable structure with environment-specific values. No structural differences.

**Local development:** Developers use their own Supabase project or the shared dev project. Never connect to production Supabase from local.

---

## Compute Approach (Prototype)

| Service | Compute Type | Notes |
|---------|-------------|-------|
| Next.js frontend | Vercel Edge Network (static + SSR) | Auto-scales; zero config |
| API routes | Vercel Serverless Functions | Default timeout: 60s on Hobby, 300s on Pro |
| AI chat (streaming) | Vercel Edge Runtime | Required for streaming SSE beyond 60s timeout |
| Workflow job worker | Vercel Cron | Polls `workflow_jobs` every 60s; executes pending steps |
| Database | Supabase managed Postgres | Zero ops; auto-scaling within plan limits |

**Important:** The streaming AI chat endpoint (`/api/ai/chat`) must use Vercel Edge Runtime or Vercel Pro (300s timeout). Confirm before AI-01 is marked DONE.

---

## Infrastructure Components (Prototype)

| Component | Service / Tool | Environment | Notes |
|-----------|--------------|-------------|-------|
| Application hosting | Vercel | All | Free/Hobby tier for prototype |
| Database | Supabase (Postgres) | All | EU region (Ireland) |
| Vector search | Supabase pgvector | All | Built into Supabase |
| Real-time | Supabase Realtime | All | Built into Supabase |
| Auth | Clerk | All | Free tier: 10,000 MAU |
| AI reasoning | Claude API (Anthropic) | Preview + Production | No local AI; use mock for unit tests |
| Embeddings | OpenAI API | Preview + Production | text-embedding-3-small |
| Email | Resend | Production only | Free tier: 100 emails/day |
| Cron jobs | Vercel Cron | Production | 1 cron job (workflow worker) |
| CDN | Vercel Edge Network | All | Automatic with Vercel |
| DNS | Vercel / registrar | Production | Custom domain in Phase 2 |

---

## Deployment Pipeline

```
Developer pushes to feature branch
  → Vercel creates preview deployment automatically
  → Preview URL shared for review
  → GitHub PR opened

PR merged to main branch
  → Vercel deploys to production automatically
  → Health check: / and /api/health endpoints
  → Supabase migrations run via GitHub Actions before deploy

No manual deployment steps. No infrastructure management.
```

**Migration strategy:** Supabase migrations run via `supabase db push` in GitHub Actions on push to `main`. Migrations are applied before the Vercel deployment completes.

**GitHub Actions workflow (`.github/workflows/deploy.yml`):**
```yaml
on: push to main
jobs:
  test:
    - run: npm test (vitest)
    - run: npm run lint
  migrate:
    - run: supabase db push (production Supabase)
    - depends-on: test
# Vercel deploy is automatic — no explicit step needed
```

**Rollback procedure (prototype):**
- **Application:** Vercel dashboard → "Instant rollback" to previous deployment (30 seconds)
- **Database migration:** Supabase migration rollback via `supabase migration repair` — requires coordination; flag to team before rolling back
- **Target rollback time:** Application = 2 minutes; Database = case-by-case

---

## CI/CD Requirements

| Requirement | Tool | Notes |
|------------|------|-------|
| Source control | GitHub | Private repository |
| CI platform | GitHub Actions | Free tier for private repos (2,000 min/month) |
| Preview deploys | Vercel | Automatic on every PR |
| Production deploy | Vercel | Automatic on push to `main` after CI passes |
| Migration runner | Supabase CLI in GitHub Actions | Run `supabase db push` before deploy |
| Secret storage | GitHub Actions Secrets + Vercel Environment Variables | Never in workflow YAML files |

---

## Secrets Management

| Secret | Storage | Rotation |
|--------|---------|---------|
| `SUPABASE_URL` | Vercel env vars + GitHub Actions secrets | When rotating Supabase project |
| `SUPABASE_ANON_KEY` | Vercel env vars | With Supabase key rotation |
| `SUPABASE_SERVICE_ROLE_KEY` | GitHub Actions secrets only (never Vercel) | Quarterly or on team change |
| `CLERK_PUBLISHABLE_KEY` | Vercel env vars | On Clerk key rotation |
| `CLERK_SECRET_KEY` | Vercel env vars (sensitive) | Quarterly or on team change |
| `ANTHROPIC_API_KEY` | Vercel env vars (sensitive) | On leak or quarterly |
| `OPENAI_API_KEY` | Vercel env vars (sensitive) | On leak or quarterly |
| `RESEND_API_KEY` | Vercel env vars | On leak or quarterly |
| `CLERK_WEBHOOK_SECRET` | Vercel env vars | On webhook regeneration |

**Rules:**
- `SUPABASE_SERVICE_ROLE_KEY` never goes to the browser — backend only
- All secrets documented in `.env.example` with placeholder values and descriptions
- Secret scan before every commit (see `.claude/rules/security-baseline.md`)

---

## Environment Variables Reference

All required environment variables (see `.env.example` for full list with descriptions):

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

# AI
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Workflow Engine
CRON_SECRET=                   # Vercel-injected secret for cron GET requests
WORKFLOW_ENGINE_SECRET=        # Secret for authenticating POST requests to workflow engine endpoint

# Email
RESEND_API_KEY=

# App
NEXT_PUBLIC_APP_URL=
```

**Validation:** All required env vars validated on application startup. Missing var = application fails to start with a clear error message. See `src/lib/env.ts`.

---

## Cost Estimates (Prototype)

| Component | Cost/Month | Notes |
|-----------|-----------|-------|
| Vercel | $0 (Hobby) | Free tier; upgrade to Pro ($20/month) if streaming timeout is needed |
| Supabase | $0 (Free tier) | 500MB database; upgrade to Pro ($25/month) at first paying customer |
| Clerk | $0 (Free tier) | 10,000 MAU free |
| Claude API | ~$30–50/month | At prototype scale (10 users) |
| OpenAI Embeddings | ~$2–5/month | text-embedding-3-small |
| Resend | $0 (Free tier) | 100 emails/day |
| **Total** | **~$32–55/month** | Fully manageable at bootstrap stage |

---

## Observability Stack (Prototype)

| Layer | Tool | What It Captures |
|-------|------|-----------------|
| Application logs | Vercel Log Drain | All Next.js API route logs (structured JSON via `src/lib/logger.ts`) |
| Database logs | Supabase Dashboard | Slow queries, connection errors |
| Error tracking | Vercel error dashboard | Unhandled exceptions |
| AI cost tracking | Anthropic + OpenAI dashboards | Token usage and cost per day |
| Uptime | Vercel status | Deployment health |

**Log format:** All application logs use the structured logger at `src/lib/logger.ts`. Required fields: `service`, `event`. No PII in log statements (see security baseline).

**Alerting (prototype):** Manual monitoring via dashboards. Set billing alerts in Anthropic and OpenAI dashboards at $50/day. Phase 2: add automated alerting via Datadog or Axiom.

---

## Production Upgrade Path

| Trigger | Action |
|---------|--------|
| Streaming timeout errors on Vercel Hobby | Upgrade to Vercel Pro ($20/month) |
| Database approaching 500MB | Upgrade to Supabase Pro ($25/month) |
| First paying customer | Move to Supabase Pro + Vercel Pro |
| API response times >500ms under load | Migrate API routes to Railway or AWS |
| Workflow engine failures in production | Migrate to Temporal (Phase 2 hard requirement) |
| APAC design partner signed | Evaluate Supabase Singapore region; else Neon |
| >10,000 MAU | Clerk pricing review → evaluate WorkOS |

---

## Disaster Recovery (Prototype)

| Scenario | Recovery | Target Time |
|---------|---------|------------|
| Vercel deployment fails | Rollback via Vercel dashboard instant rollback | 2 minutes |
| Supabase outage | N/A — no fallback at prototype; communicate with design partners | N/A |
| Bad migration applied | `supabase migration repair` + coordinate with team | Case-by-case |
| Claude API outage | Chat shows graceful error: "AI temporarily unavailable. Use manual approval mode." | Immediate (code path exists) |

---

## On-Call (Prototype)

No formal on-call rotation in Phase 1. Founder monitors dashboards.

**Failure communication:** Email design partner contacts directly if there is an outage affecting their workflow. Response time target: 2 hours during business hours (London).

---

## Archived

> Superseded infrastructure decisions moved here. Never deleted.
