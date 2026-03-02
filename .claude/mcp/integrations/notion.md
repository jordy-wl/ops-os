# Notion MCP Integration Guide

**Status:** See `mcp/server-registry.md`
**What it enables:** Publish interpret/ docs to Notion pages for stakeholder access

---

## Primary Use Case

Investors and cofounders read Notion — not the repository. This integration publishes the `interpret/` documents to configured Notion pages so they stay current without manual copy-paste.

`interpret/` files are the source of truth. Notion is the publish target.

---

## What This Integration Enables

| Action | Who Uses It | When |
|--------|------------|------|
| Publish for-investors.md to Notion | PM / Orchestrator | After `/interpret investors` |
| Publish for-cofounders.md to Notion | PM | After cofounder sync prep |
| Publish for-developers.md to Notion | Orchestrator | When onboarding a developer |
| Sync research findings to Notion DB | Researcher | After completing research |
| Read Notion pages for feedback | Researcher | During signal processing |

---

## Recommended Notion Structure

```
[Project Name] Workspace/
├── For Investors           ← publishes from interpret/for-investors.md
├── For Cofounders          ← publishes from interpret/for-cofounders.md
├── For Developers          ← publishes from interpret/for-developers.md
└── Research/
    ├── Competitive Analysis ← publishes from research/findings/competitive-analysis.md
    └── User Personas        ← publishes from research/findings/user-personas.md
```

Configure page IDs in your MCP server configuration.

---

## Publish Workflow

1. Run `/interpret [audience]` — updates the relevant interpret/ file
2. Review the file — confirm it's accurate and honest
3. Run `/mcp-connect notion publish` — pushes to configured Notion page
4. Share the Notion page link — not the raw file

```
/mcp-connect notion publish-page
  source: interpret/for-investors.md
  target-page-id: [Notion page ID from config]
```

---

## Research Sync Workflow

Researcher can sync findings to Notion for stakeholder review:
```
/mcp-connect notion publish-page
  source: research/findings/competitive-analysis.md
  target-page-id: [Notion page ID]
```

---

## Caution on Bidirectional Sync

**Notion is a publish target, not a source of truth.**

Do not:
- Edit the Notion pages directly and expect changes to appear in the repo files
- Use Notion page content as input to PRD decisions (read the repo files directly)
- Share Notion pages as drafts — only publish when the content is reviewed

If stakeholders leave comments in Notion: read them, then log relevant feedback in `research/signals/user-feedback.md` manually. Don't automate this sync.

---

## Setting Up

1. Create a Notion integration: Notion Settings → Connections → Develop or manage integrations
2. Get the integration token
3. Share relevant Notion pages with the integration
4. Note page IDs for configuration (found in the page URL)
5. Configure MCP server with integration token and page ID mapping
6. Test: `/mcp-connect notion read-page [page-id]`
7. Mark active in server-registry.md

---

## `.mcp.json` Configuration

Add this block to `.mcp.json` at the project root (already present as a template):

```json
"notion": {
  "type": "http",
  "url": "https://api.notion.com/v1/mcp",
  "headers": {
    "Authorization": "Bearer ${NOTION_TOKEN}",
    "Notion-Version": "2022-06-28"
  }
}
```

**Required env var:** `NOTION_TOKEN` — the integration token from Notion Settings → Connections → Develop or manage integrations.

**To activate:**
1. Set `NOTION_TOKEN` in your shell profile
2. Add `"notion"` to `enabledMcpjsonServers` in `.claude/settings.json`
3. Update registry status to `active`
