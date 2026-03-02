---
paths:
  - "infra/**"
  - "terraform/**"
  - ".github/**"
  - "docker/**"
  - "k8s/**"
  - "Dockerfile"
  - "docker-compose*.yml"
---

# DevOps Rules

> Path-scoped — loads when working in infrastructure files.
> Full standards: `.claude/standards/devops-standards.md`

---

## Infrastructure as Code — No Exceptions
- NEVER make changes via cloud console clicks — IaC only
- Every infrastructure change goes through a PR with `terraform plan` output reviewed
- No manual state modifications — if Terraform state is wrong, fix it properly
- All environments (dev/staging/prod) must be parity-configurable from the same IaC

## Deployment Pipeline — Mandatory Gates
Every deployment pipeline must include these stages in order:
1. `test` — unit and integration tests pass
2. `lint` — linter zero errors
3. `build` — artefact built successfully
4. `staging-deploy` — deploy to staging environment
5. `smoke-test` — critical paths verified in staging
6. `prod-deploy` — deploy to production
7. `health-check` — verify production is healthy after deploy

Skipping any stage requires written justification in the PR.

## Rollback Requirement
- Every deployment must have a tested rollback path documented before it ships
- Rollback must be tested in staging before first production deployment
- Maximum acceptable rollback time: 5 minutes for critical services
- Document rollback steps in `prd/08-infra-devops.md`

## Environment Parity
- Dev, staging, and prod must use structurally identical configuration
- Differences allowed: connection strings, feature flags, scale settings
- Not allowed: different services, different runtimes, different networking topology
- Test in staging exactly what will run in prod

## Secrets Management
- Secrets: vault or cloud provider secrets manager — never environment files committed to git
- `.env` files are for local dev only — never committed, not even `.env.staging`
- CI/CD secrets: provider secret store (GitHub Secrets, etc.) — never in workflow YAML
- Rotate all secrets that have existed longer than 90 days

## Observability Requirements
Before any service goes to production:
- Structured logs flowing to central log aggregator
- RED metrics per service: Request rate, Error rate, Duration (latency)
- Distributed tracing configured (at minimum, trace IDs in all logs)
- Alerting on: error rate spike, latency spike, service down

## On-Call Runbook
Every service must have a runbook before production:
- How to verify the service is healthy
- Top 5 failure modes and how to diagnose each
- Rollback procedure
- Who to escalate to and when

Log runbook location in `prd/08-infra-devops.md`.
