# DevOps Tasks — Phase 1, Sprint 1

> Tasks for DevOps Engineer only. Source of truth: `tasks.md` (master list).
> Run `/load-agent devops` then `/next-task` to claim your first task.

---

## Sprint Header

**Phase:** 1 | **Sprint:** 1 | **Role:** DEVOPS-ENGINEER
**Sprint Goal:** Stand up the project scaffold and local development environment. OPS-01 is the single most critical dependency in the entire sprint — everything else waits for it.
**Your critical path:** OPS-01 (scaffold) → OPS-02 (local dev) — these two tasks unlock all other roles.
**Do these first.** All other engineers are blocked until OPS-01 is complete.

---

## P1-S1-OPS-01: Scaffold Project — Next.js + Supabase + Vercel

**Description:** Create the full project scaffold. This task unlocks every other engineer. It must be done in Day 1 of the sprint.

**Deliverables:**
1. Next.js 15 App Router project with TypeScript + Tailwind CSS v4 + shadcn/ui initialised
2. Supabase project created (free tier); `pgvector` extension enabled
3. GitHub repo connected to Vercel; auto-deploy on push to `main`
4. Working `/api/health` endpoint
5. Clerk application created with keys in `.env.example`

**Setup commands reference:**
```bash
npx create-next-app@latest ops-os --typescript --tailwind --app --src-dir --import-alias "@/*"
npx shadcn@latest init
npm install @clerk/nextjs @supabase/supabase-js
```

**Acceptance Criteria:**
- [ ] Next.js 15 project with App Router, TypeScript, Tailwind v4, shadcn/ui initialised
- [ ] Supabase project created; `pgvector` extension enabled via SQL migration
- [ ] Vercel project connected to GitHub; auto-deploy on push to `main` works
- [ ] `GET /api/health` returns `{"status":"ok","version":"0.1.0"}` at localhost:3000 AND Vercel preview URL
- [ ] `.env.example` documents every environment variable with description + required/optional
- [ ] `README.md`: 3-step setup — clone → copy .env → `npm run dev`
- [ ] Clerk application created; `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in `.env.example`
- [ ] No secrets committed — `.env` in `.gitignore`

**Applicable Gates:** 1, 5
**Dependencies:** none
**Complexity:** MEDIUM
**Estimate:** 2 days
**Assigned Role:** DEVOPS-ENGINEER

---

## P1-S1-OPS-02: Local Development Environment

**Description:** Ensure every engineer can run the full stack locally. Set up Supabase CLI, migration commands, and database reset/seed scripts. This task should be done immediately after OPS-01.

**npm scripts to add to `package.json`:**
```json
{
  "db:start": "supabase start",
  "db:stop": "supabase stop",
  "db:reset": "supabase db reset",
  "db:migrate": "supabase db push",
  "db:seed": "npx ts-node scripts/seed.ts",
  "db:studio": "supabase studio"
}
```

**Acceptance Criteria:**
- [ ] Supabase CLI configured; `npm run db:start` launches local Postgres, Studio, and API
- [ ] `npm run db:reset` runs all migrations + seed scripts from clean state
- [ ] `npm run db:migrate` applies pending migrations
- [ ] Local Supabase Studio accessible at `http://localhost:54323`
- [ ] README updated: how to start local stack, reset DB, access Studio
- [ ] All `.env.example` variables have working local defaults (local Supabase URL, anon key)
- [ ] `supabase/config.toml` committed to repo with correct project settings

**Applicable Gates:** 1, 5
**Dependencies:** P1-S1-OPS-01
**Complexity:** LOW
**Estimate:** 1 day
**Assigned Role:** DEVOPS-ENGINEER
