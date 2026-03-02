## Handoff Note — Table Row Template

Add this row to the **Notes** table in `shared-state.md` when a task completes and unblocks others.

---

### Row format

```
| [DATE] | [COMPLETING_ROLE] | HANDOFF: [completed-task-id] DONE. Unblocked: [task-id] ([ROLE]), [task-id] ([ROLE]). Those roles: claim your task with /next-task or /focus-context [task-id]. |
```

### Example

```
| 2026-03-04 | BE | HANDOFF: P1-S1-BE-02 DONE. Unblocked: P1-S1-FE-03 (FE), P1-S1-QA-01 (QA). Those roles: claim your task with /next-task or /focus-context [task-id]. |
```

---

### When to use

- Write this row immediately after marking a task DONE in the Active Work table
- Only include tasks that are **fully unblocked** — all dependencies are now DONE
- If a task has multiple dependencies and not all are DONE yet, do not include it

### Status update rule

For each task in "Unblocked" that was BLOCKED, also change its status to OPEN in the Active Work table.
