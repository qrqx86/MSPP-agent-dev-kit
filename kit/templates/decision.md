# DECISION procedure

Values from the project `CLAUDE.md` (Work tracking): tracker (`azure-devops` or `github`) and its coordinates.
States: **Open → Approved / Rejected**. Every write asks for confirmation (hooks `pre-mcp` / `pre-shell`).

## Azure DevOps (MCP server `azure-devops`, `wit_*` tools)
### Create
1. Create a work item of type **Task** in the project:
   - Title: `DECISION: <short question>`
   - Tags: `Decision; <Agent>`
   - Assigned to: the person who decides
   - Description (HTML): Context · Options with pros/cons · Recommendation · Rule IDs
2. Link it to the user story as **child** (`System.LinkTypes.Hierarchy-Reverse` from the Task to the story).
3. Add the row to `docs/stories/<storyId>/decisions.md` (status Open).

### List the open decisions of a story
WIQL query through the MCP server:
```
SELECT [System.Id],[System.Title],[System.State] FROM WorkItemLinks
WHERE [Source].[System.Id] = <storyId>
  AND [System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward'
  AND [Target].[System.Tags] CONTAINS 'Decision'
  AND [Target].[System.State] NOT IN ('Approved','Rejected','Closed','Done')
MODE (MustContain)
```
Map Approved/Rejected to the states of your process (e.g. Done + tag `Approved`) as declared in `CLAUDE.md`.

## GitHub (`gh` CLI)
### Create
```bash
gh issue create --title "DECISION: <short question>" --label decision --assignee <person> \
  --body "Parent: #<storyId>

## Context
...
## Options
1. ... (pros/cons)
## Recommendation
...
## Rules
<rule IDs>"
```
If the repository uses sub-issues, also add it as a sub-issue of the story. Create the labels once:
`gh label create decision`, `gh label create approved`, `gh label create rejected`.
Then add the row to `docs/stories/<storyId>/decisions.md` (status Open).

### List the open decisions of a story
```bash
gh issue list --label decision --state open --search "Parent: #<storyId> in:body"
```

### Close
Approved: `gh issue close <n> --reason completed` + label `approved`; rejected: `--reason "not planned"` + label `rejected`.

## Closing after an answer in chat (both trackers)
Set the state (Approved / Rejected) and add a comment: `Outcome: <option> · decided by <person> · <YYYY-MM-DD>`.
Update the row in `decisions.md`. For lasting architectural decisions also write an ADR
(`docs/adr/NNNN-<title>.md`, template `0000-template.md`) and cite its number in the DECISION.

## Rules
- Without status Approved no agent proceeds on that point.
- If the tracker tool is not available or the coordinates are placeholders: stop, show the DECISION text in chat
  and ask the user to create it or to configure the tool.
