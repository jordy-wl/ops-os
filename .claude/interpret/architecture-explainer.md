# Architecture Explainer

> Living document maintained by all engineers.
> Engineers update relevant sections when making significant architectural decisions.
> Current state: EMPTY — engineers populate this as the system is built.

---

## System Purpose and Scope

[2-3 sentences: what this system does technically, what it doesn't do, what the boundaries are]

---

## Architecture Principles

[3-5 principles that guide all architectural decisions. These should be stable across phases.]

1. **[Principle]:** [What it means and how it shows up in implementation decisions]
2. **[Principle]:** [What it means]
3. **[Principle]:** [What it means]

---

## Component Map

| Component | Purpose | Technology | Owner Role | Status |
|-----------|---------|-----------|-----------|--------|
| [Frontend App] | User interface | [FRONTEND_FRAMEWORK] | Frontend Engineer | PLANNED |
| [API Server] | Business logic and data access | [BACKEND_RUNTIME] | Backend Engineer | PLANNED |
| [Database] | Persistent data storage | [DATABASE] | Data Engineer | PLANNED |
| [AI Service] | AI feature orchestration | [AI_PROVIDER] | AI/ML Engineer | PLANNED |

---

## Data Flow — Primary User Journey

Step-by-step, component by component, for the core user action:

```
[Filled in by engineers after implementation]

Example:
1. User fills login form → Frontend validates email format
2. Frontend POST /api/v1/auth/login → API Server
3. API Server → auth middleware validates credentials against DB
4. DB returns user record → API Server generates JWT
5. API Server returns access_token + refresh_token → Frontend
6. Frontend stores access_token in memory, refresh_token in httpOnly cookie
7. Frontend redirects to /dashboard
```

---

## External Integrations

| Integration | What For | Our Dependency Level | Failure Impact | Fallback |
|------------|---------|---------------------|----------------|---------|
| [service] | [purpose] | CRITICAL / HIGH / LOW | [what breaks] | [fallback] |

---

## Infrastructure Overview

[Where it runs, how it's deployed, how it scales]

**Deployment:** [platform and approach]
**Environments:** dev / staging / prod
**Scale approach:** [how the system scales when load increases]
**Current capacity:** [what it can handle now]

---

## Observability

[How we know it's working and how we know when it's broken]

| Layer | Tool | What It Captures |
|-------|------|-----------------|
| Logs | [tool] | Structured JSON events |
| Metrics | [tool] | RED metrics per service |
| Traces | [tool] | Request traces |
| Alerts | [tool] | When to wake someone up |

---

## Architecture Decisions Log

Engineers: add an entry here when making a significant architectural decision.

| Date | Decision | Options Considered | Rationale | Tradeoffs Accepted | Author |
|------|----------|-------------------|-----------|-------------------|--------|
| [date] | [what was decided] | [A vs B vs C] | [why] | [what was given up] | [ROLE] |

---

*This document is maintained by all engineering roles.*
*Major decisions logged here are also visible in `/interpret developers`.*
