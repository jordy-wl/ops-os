# Skills

Skills are the recommended format for reusable workflows in Claude Code. They supersede the single-file `.claude/commands/` format (which still works for backward compatibility).

---

## Skills vs Commands

| Feature | Commands (`.claude/commands/*.md`) | Skills (`.claude/skills/*/SKILL.md`) |
|---------|----------------------------------|--------------------------------------|
| File structure | Single `.md` file | Folder with `SKILL.md` + optional support files |
| Supporting files | No | Yes — templates, examples, scripts |
| Auto-invocation | No | Yes — Claude reads `description` and auto-invokes |
| Prevent auto-invoke | No | Yes — `disable-model-invocation: true` |
| Hide from user menu | No | Yes — `user-invocable: false` |
| Lifecycle hooks | No | Yes — skill-scoped `hooks:` in frontmatter |
| Model override | No | Yes — `model:` field |
| Isolated subagent | No | Yes — `context: fork` |
| Status | Works (deprecated) | **Recommended** |

---

## Folder Structure

```
.claude/skills/
├── README.md                    ← this file
├── _skill-template/             ← copy this to create a new skill
│   └── SKILL.md
├── my-skill/
│   ├── SKILL.md                 ← required entrypoint
│   ├── templates/               ← optional: reusable templates for the skill
│   │   └── output-template.md
│   ├── examples/                ← optional: example inputs/outputs
│   │   └── example.md
│   └── scripts/                 ← optional: helper scripts the skill can run
│       └── helper.sh
```

---

## SKILL.md YAML Frontmatter

```yaml
---
name: skill-name                    # lowercase, hyphens, max 64 chars (defaults to folder name)
description: |                      # REQUIRED for auto-invocation — Claude reads this to decide when to use the skill
  One or two sentence description of when this skill applies and what it does.
  Be specific: "When a user asks to review a task for quality gates" not "Reviews tasks".
disable-model-invocation: true      # true = only invocable via /skill-name (safer for destructive operations)
user-invocable: true                # false = hidden from /menu, but Claude can still auto-invoke
argument-hint: "[task-id]"          # shown during autocomplete
allowed-tools: Read, Grep, Glob     # tools available without permission prompt when skill runs
model: claude-sonnet-4-6            # override default model for this skill
context: fork                       # fork = run in isolated subagent (recommended for task-heavy skills)
agent: general-purpose              # subagent type: general-purpose, Explore, Plan, or a custom agent name
---
```

---

## Creating a New Skill

1. Copy `_skill-template/` and rename the folder to your skill name (kebab-case)
2. Edit `SKILL.md` — update the frontmatter and write the skill instructions
3. Add any supporting files (`templates/`, `examples/`, `scripts/`)
4. Test: type `/your-skill-name` in Claude Code to invoke it
5. Skill is project-scoped — to make it personal (all projects), move to `~/.claude/skills/`

---

## Argument Handling

Inside SKILL.md:
- `$ARGUMENTS` — the full argument string passed after the skill name
- `$0`, `$1`, `$2` ... — individual arguments split by space
- `${CLAUDE_SESSION_ID}` — current session ID (for logging)

---

## When to Use Skills vs Commands

**Use a skill when:**
- You want Claude to auto-invoke the workflow based on context (omit `disable-model-invocation`)
- The workflow needs supporting files (templates, examples, scripts)
- You want a model override (e.g. use Opus for complex tasks, Haiku for quick ones)
- You want the workflow to run in an isolated subagent (`context: fork`)

**Keep as a command when:**
- It's an existing command you don't want to refactor
- It's a simple one-file workflow with no supporting files needed

---

## Existing Commands Reference

All project orchestration workflows are in `.claude/commands/`:
`load-agent`, `plan-prd`, `next-task`, `complete-task`, `review-task`,
`evolve-prd`, `adjust-roadmap`, `sprint-retro`, `interpret`,
`feature-change`, `status-report`, `mcp-connect`

These work identically to skills via `/command-name`. No migration needed.

---

## When to Use `context: fork`

A forked skill runs in an isolated subagent. Only a summary returns to the main context.
Use fork for output-heavy or multi-file workflows to prevent context bloat.

| Condition | Use fork? | Reason |
|-----------|-----------|--------|
| Reads 5+ files | Yes | Prevents all file content from sitting in main context |
| Generates 50+ lines of output | Yes | Report stays in a file; only summary returned |
| Writes to multiple files | Yes | Subagent coordinates writes without polluting context |
| Read-only check (1–3 files) | No | Result needed immediately; fork adds unnecessary overhead |
| Coordination write (1 file) | No | Must complete before agent continues — fork delays this |
| Result needed before next step | No | Fork is async — use inline when you need the answer now |

**Skills using fork:** `status-report` (generates 100+ line report → saves to `.claude/sprints/status-[date].md`)
