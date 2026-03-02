---
name: skill-name
description: |
  Replace this with a precise description of when Claude should invoke this skill.
  Example: "When a user asks to check the status of sprint tasks or wants a project overview."
  Leave blank or set disable-model-invocation: true if you only want manual invocation via /skill-name.
disable-model-invocation: true
user-invocable: true
argument-hint: "[optional-argument]"
allowed-tools: Read, Grep, Glob
---

# Skill: [Skill Name]

> **Arguments:** `$ARGUMENTS`
> Replace `$0` with first argument, `$1` with second, etc.

---

## Purpose

[One paragraph: what problem this skill solves, who uses it, when.]

---

## Protocol

### Step 1 — [First Step Name]

[Instructions for step 1. Be specific — what files to read, what to check, what to write.]

### Step 2 — [Second Step Name]

[Instructions for step 2.]

### Step 3 — Output

[What the skill produces — output format, files written, summary to display.]

---

## Output Format

```
[SKILL NAME] COMPLETE

[Key result]
[Secondary result]

Next: [What the user should do next]
```

---

## Edge Cases

- **If [condition]:** [How to handle it]
- **If [condition]:** [How to handle it]

---

## Supporting Files

If this skill needs templates, add them to `templates/` in this folder and reference them:
- `templates/output-template.md` — [describe what it's for]
