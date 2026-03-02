# Custom MCP Server Template

**Status:** See `mcp/server-registry.md`
**What it enables:** [Describe what this server enables — one sentence]

---

## When to Create a Custom Server

Add a custom MCP server when:
- An external service your agents need is not covered by the standard integrations
- You need to wrap an internal API or tool with a consistent Claude Code interface
- You want to expose a batch operation that multiple agents will use repeatedly

Do not create a custom server for one-off tasks — use Bash tool commands instead.

---

## Template: Integration Guide

Copy this section and replace all `[PLACEHOLDER]` values.

---

### [SERVICE NAME] MCP Integration Guide

**Status:** inactive
**What it enables:** [One sentence — what agent workflows does this unblock?]

---

#### Primary Use Case

[2-3 sentences describing the main problem this solves and which agents benefit. Why is MCP better than an alternative approach here?]

---

#### What This Integration Enables

| Action | Who Uses It | When |
|--------|------------|------|
| [action 1] | [role] | [trigger] |
| [action 2] | [role] | [trigger] |
| [action 3] | [role] | [trigger] |

---

#### Core Workflow

```
1. [First step — describe what the agent does]
   /mcp-connect [server-name] [action]
     param: [value]

2. [Second step]
   /mcp-connect [server-name] [action]
     param: [value]

3. [Verification step]

4. [Logging step — what to record in gate-results.md or shared-state.md]
```

---

#### Gate Evidence Format

[If this integration produces evidence for any of the 7 gates, show the evidence format here]

```
GATE [N] — [GATE NAME]
[Evidence format specific to this integration]
```

---

#### Setting Up

1. [Step 1 — where to get credentials]
2. [Step 2 — what config values are needed]
3. [Step 3 — how to configure the MCP server]
4. Test: `/mcp-connect [server-name] [test-action]`
5. Mark active in `server-registry.md`

---

#### Caution

Do not:
- [Safety constraint 1]
- [Safety constraint 2]
- [Safety constraint 3]

---

## Registering Your Server

After creating the integration guide, add an entry to `mcp/server-registry.md`:

```markdown
| [server-name] | inactive | [brief description] | [integration guide link] |
```

Then configure the MCP server in your Claude Code settings (`.claude/settings.json` or user settings) following the standard MCP server configuration format.

---

## MCP Server Configuration Reference

Standard configuration block for a custom MCP server:

```json
{
  "mcpServers": {
    "[server-name]": {
      "command": "npx",
      "args": ["-y", "@your-org/mcp-[server-name]"],
      "env": {
        "API_KEY": "[secret — use env var, never hardcode]",
        "BASE_URL": "[service URL]"
      }
    }
  }
}
```

For stdio transport (local process):
```json
{
  "mcpServers": {
    "[server-name]": {
      "command": "node",
      "args": ["path/to/server.js"],
      "env": {
        "API_KEY": "[env var reference]"
      }
    }
  }
}
```

Secrets: use environment variables set in your shell profile or secrets manager — never hardcode values in the configuration block.

---

## Testing a New Server

Before marking active in the registry:
1. Verify the server starts without errors
2. Run a read-only action to confirm connectivity
3. Run a write action against a non-production resource
4. Confirm the response schema matches what your agents expect
5. Document any undocumented behaviours in the integration guide's Caution section
