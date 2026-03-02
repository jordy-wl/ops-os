# Ops OS

[![CI](https://github.com/Jordy-Langdon/ops-os/actions/workflows/ci.yml/badge.svg)](https://github.com/Jordy-Langdon/ops-os/actions/workflows/ci.yml)

A Business Operating System for capital markets and operations-heavy firms — stateful entities, immutable audit trail, AI-routed workflows.

---

## 3-Step Local Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd Ops-OS_v1.1
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local — fill in Clerk, Supabase, and Anthropic API keys (see below)

# 3. Start the development server
npm run dev
# → App running at http://localhost:3000
# → /api/health returns {"status":"ok"}
```

---

## First-Time Setup — External Services

You need accounts for three services. All have free tiers sufficient for development.

### 1. Clerk (Auth)

1. Create an account at [clerk.com](https://clerk.com)
2. Create a new application → select "Next.js"
3. Enable **Organizations** in Clerk dashboard (required for multi-tenancy)
4. Copy `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` → paste into `.env.local`

### 2. Supabase (Database)

**Option A — Cloud (remote Supabase project):**
1. Create a project at [supabase.com](https://supabase.com)
2. Go to Settings → API → copy URL, anon key, and service_role key → paste into `.env.local`
3. Enable the `pgvector` extension: Dashboard → Database → Extensions → search "vector" → enable

**Option B — Local (recommended for development):**
```bash
npm run db:start       # starts local Postgres, Studio, and API
npm run db:migrate     # applies schema migrations
npm run db:seed        # populates demo data (Thornfield Capital Partners scenario)
# Local Studio at http://localhost:54323
```
Local connection values are printed by `supabase start`. Copy them into `.env.local`.

### 3. Anthropic (Claude API)

1. Get an API key at [console.anthropic.com](https://console.anthropic.com)
2. Paste into `.env.local` as `ANTHROPIC_API_KEY`

### 4. OpenAI (Embeddings only)

Used for pgvector semantic embeddings (`text-embedding-3-small`, 1536 dimensions).
The Claude API does not provide embeddings.

1. Get an API key at [platform.openai.com](https://platform.openai.com)
2. Paste into `.env.local` as `OPENAI_API_KEY`

---

## Local Database Commands

```bash
npm run db:start     # Start local Supabase (Postgres + Studio + API)
npm run db:stop      # Stop local Supabase
npm run db:reset     # Reset DB + apply all migrations + run seed
npm run db:migrate   # Apply pending migrations only
npm run db:seed      # Populate demo data (safe to run multiple times)
npm run db:studio    # Open Supabase Studio in browser
```

---

## Development Commands

```bash
npm run dev          # Start Next.js development server (http://localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Unit tests (Vitest)
npm run test:api     # API contract tests (requires local Supabase running)
npm run test:e2e     # E2E smoke tests (Playwright)
```

---

## Project Structure

```
src/
├── app/
│   ├── api/           ← API routes (blocks/, events/, actions/, ai/, health/)
│   ├── dashboard/     ← Main dashboard
│   ├── blocks/        ← Block list + detail views
│   ├── sign-in/       ← Clerk sign-in
│   ├── sign-up/       ← Clerk sign-up
│   └── org-setup/     ← Organisation creation
├── lib/
│   ├── supabase/      ← Supabase client (server + browser)
│   ├── auth/          ← Auth middleware (withAuth)
│   ├── context-assembly.ts  ← AI context assembly service
│   └── embeddings.ts  ← pgvector embedding pipeline
├── components/        ← Shared UI components (shadcn/ui)
└── middleware.ts      ← Clerk auth middleware (protects routes)

supabase/
├── migrations/        ← SQL migration files (run in order)
├── seed.sql           ← Demo data (Thornfield Capital Partners scenario)
└── config.toml        ← Local Supabase configuration

.claude/               ← Orchestration system (agents, sprints, PRD, research)
```

---

## Architecture

Ops OS is built on 5 core primitives:

| Primitive | What it is |
|-----------|------------|
| **Block** | A stateful business entity (client, deal, project, contract, contact). Blocks connect to each other in a graph. |
| **Event** | An immutable, append-only record of something that happened. Never updated or deleted — the compliance audit trail. |
| **Action** | The only permitted way to mutate business state. Every action creates an Event. |
| **Workflow** | A trigger-based pipeline of steps (Postgres queue in prototype; Temporal in production). |
| **AI Layer** | Claude reads the business graph + event timeline and routes workflow steps to humans or executes automatically based on confidence × risk policy. |

---

## Key Design Decisions

- **Events are immutable**: The `events` table has RLS policies that deny UPDATE and DELETE for all roles. This is the compliance foundation.
- **Actions are the only mutation path**: Direct PATCH to a Block is only permitted for internal metadata. All business logic goes through `/api/actions/:type`.
- **AI confidence threshold = 1.0 in Phase 1**: All AI actions require human approval. Threshold is tuned with real data in Phase 2.
- **Canvas is Phase 2+**: The no-code workflow canvas is not in Phase 1 scope.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 15 (App Router) + Tailwind CSS v4 + shadcn/ui |
| Backend | Next.js API routes |
| Database | Supabase (Postgres + pgvector + Realtime) |
| Auth | Clerk (multi-tenant, RBAC, org support) |
| AI reasoning | Claude claude-sonnet-4-6 (Anthropic) |
| AI embeddings | OpenAI text-embedding-3-small (1536 dims) |
| Workflow engine | Postgres job queue (prototype) → Temporal (production) |
| Infrastructure | Vercel + Supabase |

---

## Orchestration System

This repo uses a multi-agent Claude Code orchestration system in `.claude/`. To work within it:

```bash
# In a Claude Code session:
/load-agent devops         # Load DevOps Engineer persona
/next-task                 # Claim next available task
/complete-task P1-S1-OPS-01  # Mark task done + run gates
```

See `.claude/README.md` for the full orchestration guide.
