---
name: pp-team-rules
description: Common working rules of the Power Platform agent team (Pia, Alma, Dora, Sigi, Cody, Paula, Moritz, Flo, Peppi, Tessa, Kuno) - environment connection, hand-off through story files, DECISION work items, result format, escalation. Preloaded by every team agent.
---
# Team working rules

## 1. Precedence
Project `CLAUDE.md` → organization rulebook (if any) → baseline standards (skill `pp-standards`) → Microsoft skills
of the installed plugins → general knowledge. On conflict the higher source wins: report it, do not resolve it alone.
Deviations approved for the project are listed in its `CLAUDE.md`; Kuno does not report them as findings.

## 2. Rule 0 – Environment first
Before any operation against Dataverse or the Power Platform:
1. Look for a Dataverse MCP server among the available tools (name containing `dataverse`); if present, use it.
2. Otherwise check the CLI profiles: `pac auth list` and `dataverse auth who`.
3. Compare the active environment with the project `CLAUDE.md`: it must be the **DEV environment** declared there.
   Never TEST, UAT, STAGING or PROD, for any agent (ALM-01): only pipelines go there. The hooks block other environments.
4. Always pass the environment explicitly (`--environment <url>`); do not rely on the active profile.
5. Before creating a publisher or a solution, look for existing ones (skill `dataverse:dv-solution`). Never the `new` prefix.

## 3. Tools
- PAC CLI (verified 2.14.x): `pac solution init|export|unpack|pack|import|check|create-settings|add-reference|version`,
  `pac pages upload-code-site|download-code-site`, `pac pcf init|push`, `pac plugin init|push`, `pac pipeline list|deploy`,
  `pac power-pages start-quick-scan|get-security-scan-report`, `pac env who|fetch`.
  **Do not exist / do not use:** `pac solution create` (→ `pac solution init` + skill `dv-solution`),
  `pac test run` (Test Engine deprecated), `pac code *` (→ `pa` CLI for Code Apps).
- `pac data` exists (import/export of configuration data): `pac data import` asks for confirmation, `pac data bulk-delete` is denied.
- Dataverse CLI `dataverse` (npm `@microsoft/dataverse`, preview): query, CRUD, describe, Custom API. Prefer it to curl/raw Web API.
- Power Apps CLI `pa` (npm `@microsoft/power-apps-cli`): Code Apps.
- Work items, DECISIONS, comments, pipelines – according to the tracker in `CLAUDE.md`:
  - `azure-devops`: MCP server `azure-devops` (work items `wit_*`, pipelines);
  - `github`: `gh` CLI (`gh issue`, `gh workflow`) or a GitHub MCP server, if configured.
- Documentation: the `microsoft-learn` MCP server is the authoritative source before stating platform behaviour.
- Known PAC CLI pitfalls: see [references/pac-gotchas.md](references/pac-gotchas.md).

## 4. Hand-off through files
Project level: `docs/project/spec.md`, `plan.md`, `tasks.md` (initial backlog) written by Pia with `/project-plan`,
and `docs/project/decisions.md` – the project decision register (one row per DECISION of the whole project); read it before proposing alternatives.
Each story has the folder `docs/stories/<ID>/` (templates in `~/.claude/pp-kit/templates/project/docs/stories/_template/`):
- `spec.md` – requirements and acceptance criteria (from the story work item), written by Pia.
- `plan.md` – approved plan, with rule IDs.
- `tasks.md` – tasks with **owner agent** and **owned files**. Change only the files assigned to you;
  if you must touch another agent's files, stop and report it to the orchestrator.
- `decisions.md` – local mirror of the DECISION work items (ID, title, status).
- `reviews/` – Kuno's findings per perspective.
Read these files at the start of the task and update `tasks.md` (status of your task) at the end.

## 5. Decisions
Team agents run as subagents: they **cannot ask the user** and **cannot start other agents**. They return proposals,
DECISION texts and requests for other agents in their result; the main session records DECISIONS, asks for approval and delegates.
A specialist creates components that need approval only when its task states that the DECISION is Approved.
Every approval, choice between alternatives, assumption or deviation from a rule → DECISION work item under the story
(procedure in `~/.claude/pp-kit/decision.md`) and a row in the story `decisions.md` and in the project register `docs/project/decisions.md`. Without status Approved, do not proceed on that point.
Lasting architectural decisions: also an ADR in `docs/adr/NNNN-<title>.md` (MADR template), linked to the DECISION.

## 6. Escalation after two attempts
If the same step fails twice (command, build, import, test), **do not retry a third time blindly**:
stop, search the documentation (Microsoft Learn MCP, Microsoft skills), summarise both errors and propose an alternative.
Never delete or recreate resources to "unblock" a situation without a DECISION.

## 7. Result format (mandatory)
End every result with:
```
### Rules applied
- <rule ID>: <how it is met>   (or: "No applicable rule - assumption: ...")
### Assumptions and decisions
- <assumption / DECISION ID and status>
### Files changed
- <path>
```
A hook checks that the "Rules applied" section is present.

## 8. Commits
Change flow as declared in `CLAUDE.md` (pull request by default; direct push only if the project says so).
Commit message:
```
feat: <description> AB#<ID>        (GitHub: feat: <description> #<ID>)

<details>

AI-Assisted: Claude Code (<agents involved>)
Verified: <build, lint, test, review run and outcome>
```
Never declare checks that were not run.

## 9. Common prohibitions
- No manual changes in the maker portal; no component in the Default solution.
- No secrets in the repository (secret-scan hook active): environment variables, Key Vault, pipeline secrets.
- No real personal data in logs, tests or examples.
