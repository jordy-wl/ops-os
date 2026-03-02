# DevOps Standards — Reference

> **Reading guide:** At session start, skim section headers only — do not read in full.
> Full file: load only when actively implementing a task that requires these standards.
> Auto-load: `/focus-context [task-id]` reads this file when your task's role or gate requires it.
> Skipping at session start saves significant context tokens.

Stack placeholders: `[IAC_TOOL]` (Terraform/Pulumi), `[CLOUD_PROVIDER]`, `[CI_PLATFORM]`
Confirmed stack recorded in `prd/03-system-architecture.md`.

---

## Infrastructure as Code — Always

No infrastructure change exists unless it is in code. No exceptions.

**Rules:**
- Terraform (or confirmed IaC tool) for all cloud resources
- Every change: PR with plan output (`terraform plan`) reviewed before apply
- No manual state modifications — if state is wrong, fix via IaC, never `terraform state rm` without understanding the consequences
- State stored remotely in encrypted backend (S3 + state locking, or equivalent) — never local state in repos

### IaC File Structure
```
terraform/
  environments/
    dev/      — dev-specific variable values
    staging/  — staging-specific variable values
    prod/     — prod-specific variable values
  modules/
    database/ — reusable database module
    network/  — reusable network module
    compute/  — reusable compute module
  main.tf     — root module
  variables.tf
  outputs.tf
```

---

## Environment Parity

Dev, staging, and prod must be structurally identical:
- Same services, same runtime, same network topology
- Only allowed differences: connection strings, feature flags, scale/size settings
- Staging must be deployable from the same IaC as prod with different variable file

**Test in staging exactly what will run in prod.**
Any "it works in staging" claim requires a staging deploy that matches prod configuration.

---

## Deployment Pipeline — Mandatory Gates

All stages run in this order for every deploy. Skipping any stage requires written justification.

```yaml
stages:
  test:
    - unit tests pass
    - integration tests pass
  lint:
    - linter zero errors
    - IaC validation passes (terraform validate)
  build:
    - artefact built successfully
    - Docker image tagged with git SHA
  staging-deploy:
    - deploy to staging environment
    - wait for health check to pass
  smoke-test:
    - critical user paths verified in staging
    - key API endpoints respond correctly
  prod-deploy:
    - manual approval gate for first deploy to production
    - automated for subsequent deploys after review
  health-check:
    - verify production service healthy post-deploy
    - metrics show no spike in error rate
    - alert if health check fails → automatic rollback trigger
```

---

## Rollback Protocol

Every service must have a tested rollback path documented before first production deploy.

### Rollback Documentation (in `prd/08-infra-devops.md`)
```
Service: [name]
Rollback method: [blue/green swap / image rollback / feature flag / database revert]
Rollback command: [exact command or pipeline step]
Rollback time target: [N minutes]
Data impact: [none / migrations must be rolled back separately / describe]
Tested: [date + staging environment]
```

### Rollback Decision Criteria
Trigger automatic or manual rollback when:
- Error rate exceeds 5× baseline within 10 minutes of deploy
- P95 latency exceeds 3× baseline within 10 minutes of deploy
- Health check fails after deploy
- Any critical alert fires in the first 30 minutes

---

## Secrets Management

| Category | Storage | Never |
|----------|---------|-------|
| Application secrets | Cloud provider secrets manager (e.g. AWS Secrets Manager, GCP Secret Manager) | In code or IaC |
| CI/CD secrets | CI provider secrets store (e.g. GitHub Secrets) | In workflow YAML files |
| Local dev secrets | `.env` file (gitignored) | Committed to version control |
| Infrastructure state encryption key | Cloud KMS | In IaC code or variables |

**`.env` policy:**
- `.env` — gitignored, for local dev only
- `.env.example` — committed, placeholder values only, documents every required variable

**Rotation policy:** Rotate all secrets older than 90 days. Document rotation schedule in `prd/08-infra-devops.md`.

---

## Observability Stack — Required Before Production

### Logging
```json
{
  "level": "info",
  "timestamp": "2024-01-01T00:00:00Z",
  "service": "api",
  "version": "1.2.3",
  "request_id": "req_abc",
  "event": "http.request",
  "method": "POST",
  "path": "/api/v1/users",
  "status": 201,
  "duration_ms": 42
}
```
All logs: structured JSON, centralised aggregator, searchable by request_id and service.

### Metrics — RED per Service
- **R**equest rate: requests per second
- **E**rror rate: 5xx responses as percentage of total
- **D**uration: p50, p95, p99 latency in milliseconds

### Distributed Tracing
- Trace ID generated at API gateway, propagated in headers to all downstream calls
- Minimum: trace ID present in all logs
- Ideal: OpenTelemetry spans for all service-to-service calls and DB queries

### Alerting — Required Before Production
```
alert: HighErrorRate
condition: error_rate > 5% for 5 minutes
severity: critical
action: page on-call + trigger rollback review

alert: HighLatency
condition: p95_latency > 3× baseline for 5 minutes
severity: warning
action: notify on-call

alert: ServiceDown
condition: health_check fails 3 consecutive times
severity: critical
action: page on-call immediately
```

---

## On-Call Runbook — Required Before Production

Every service must have an on-call runbook in `prd/08-infra-devops.md` or linked from it:

1. **How to verify the service is healthy**: exact commands and expected outputs
2. **How to check logs**: log query for common error patterns
3. **Top 5 failure modes**: symptoms → diagnosis → fix for each
4. **Rollback procedure**: step by step
5. **Escalation contacts**: who to call when you can't fix it
6. **Recovery verification**: how to confirm the service is healthy after a fix

---

## CI/CD for Multiple Environments

```yaml
# GitHub Actions example pattern (adapt for confirmed CI platform)
on:
  push:
    branches: [main]     # → staging deploy
  release:
    types: [published]   # → prod deploy

jobs:
  deploy-staging:
    if: github.ref == 'refs/heads/main'
    environment: staging
    steps:
      - run: terraform apply -var-file=environments/staging/terraform.tfvars

  deploy-prod:
    if: github.event_name == 'release'
    environment: production   # requires manual approval in GitHub environments
    steps:
      - run: terraform apply -var-file=environments/prod/terraform.tfvars
```
