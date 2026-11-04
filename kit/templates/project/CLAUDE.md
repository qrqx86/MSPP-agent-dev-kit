# Project: <Name>
<!-- pp-kit:project  (marker: enables the pp-kit project hooks – do not remove) -->

## Project
- Owner: <team / department>
- Purpose: <one sentence>
- Area / domain (NAM-02): <Area> / <Domain>
- Publisher prefix (NAM-01): <prefix>
- DEV environment (the only one agents may use): URL https://<org-dev>.crm4.dynamics.com | ID <environment guid>
- Other environments (pipeline only, never connected to agents – ALM-01): TEST <name> | STAGING <name> | PROD <name>
- DEV pac auth profile: <profile name>
- Power Pages SPA site: <site name>
- Languages: <base language>, <other languages>

## Work tracking
- Work item tracker: <azure-devops | github>
- Azure DevOps: organization <org> | project <project>   (MCP server `azure-devops` in `.mcp.json`)
- GitHub: repository <owner>/<repo>   (`gh` CLI; labels `decision`, `approved`, `rejected`)
- Story reference in commits: `AB#<ID>` (Azure DevOps) or `#<ID>` (GitHub)
- DECISION states: Open → Approved / Rejected
- Change flow: <pull request | direct push>

## Repositories and solutions (ALM-09, NAM-02, NAM-11)
One repository and one solution per type; only the types the project needs.
| Type | Repository | Solution unique name | Pipelines |
|---|---|---|---|
| Core | `<project>-core` | `<Area>_<Domain>_Core` | export / release `<repo>` |
| Automation | `<project>-automation` | `<Area>_<Domain>_Automation` | export / release `<repo>` |
| Integration | `<project>-integration` | `<Area>_<Domain>_Integration` | export / release `<repo>` |
| Frontend | `<project>-frontend` or `<project>-<component>` | `<Area>_<Domain>_Extension` | export / release `<repo>` |
- Solution display name: `<Domain> - <Purpose> - <Type>`.
- Deployment settings (Core repository only): `config/settings-<environment>.json` + `config/settings-template.json`.
- Pipelines: Azure DevOps `pipelines/export-<repo>.yml`, `pipelines/release-<repo>.yml` | GitHub `.github/workflows/export-<repo>.yml`, `release-<repo>.yml`.

## Standards (binding)
- Baseline: skill `pp-standards` (rule IDs ALM-*, NAM-*, DV-*, SEC-*, FE-*, AU-*, PC-*, TST-*).
- Organization rulebook: <none | path or skill name> – takes precedence over the baseline.
- Front end for external users: Power Pages SPA (React/TypeScript). Back office: model-driven app. Data: Dataverse.
  Observability: Application Insights. Automation: Power Automate.
- Identity providers: <e.g. Microsoft Entra External ID>. External systems / master data: <list>.
- Pro-code only when justified (plug-ins, PCF, Azure).
- Precedence: this file → organization rulebook → `pp-standards` → Microsoft skills → general knowledge.

## Working mode
- Plan first, then build: for relevant changes present a plan and wait for approval.
- Planning with Pia (`/project-plan`, `/story`): spec, plan and tasks before any build.
- Delegate to the specialists: Alma (ALM), Dora (Dataverse), Sigi (security), Cody (Code Apps),
  Paula (Power Pages SPA), Moritz (model-driven apps), Flo (Power Automate), Peppi (pro-code),
  Tessa (functional tests), Kuno (quality and security).
- Agents, MCP servers and CLIs work **only on the DEV environment** above (ALM-01), with development identities
  and test data. TEST, STAGING and PROD only through pipelines.
- Everything goes through solutions: nothing in the Default solution. Changes made in DEV (also via MCP) are
  brought back to the solution source (ALM-03).
- Missing information is reported as an assumption, never invented.

## Tools (binding)
- PAC CLI, Dataverse CLI (`dataverse`), Power Apps CLI (`pa`); no manual changes in the maker portal.
- Project MCP servers (`.mcp.json`): `dataverse` (DEV only), `azure-devops` (only with that tracker).
- Microsoft Power Platform skills (all plugins of the power-platform-skills marketplace).
- Team working rules: skill `pp-team-rules` (preloaded by the agents).
- Work only on a user story with an ID; branch `feature/<ID>-<slug>`.
- Story documents in `docs/stories/<ID>/` (spec, plan, tasks, decisions, reviews); ADRs in `docs/adr/`; project decision register `docs/project/decisions.md`.

## Decisions (binding)
- Every approval, choice between alternatives, assumption or deviation from a rule is created as a
  "DECISION: ..." work item under the user story (procedure: `~/.claude/pp-kit/decision.md`).
- Description: context, options with pros/cons, recommendation, rule IDs.
- Wait for status Approved before proceeding on that point.
- If the user answers in chat, record answer, person and date in the DECISION and set its state.

## Approved deviations
- <rule ID> – <deviation, who approved it, date>

## Conventions
- Naming: NAM-* rules of `pp-standards` (or the organization rulebook); technical names in English, singular,
  no internal underscores; display names in Sentence case in the base language, others via translations.
- Documentation: <language>; code comments: English.
- Commits: Conventional Commits (feat:, fix:, chore: ...) with the story reference and the `AI-Assisted:` / `Verified:` lines.

## Repository structure (each repository)
- solution/<SolutionName>/   unpacked solution
- src/                       code (SPA, Code Apps, PCF, plug-ins, web resources)
- config/                    settings-<environment>.json (Core only)
- pipelines/ or .github/workflows/   export and release pipelines
- tests/e2e/                 Playwright tests
- docs/stories/<ID>/  docs/adr/

## Definition of Done
- Solution exported, unpacked and versioned in the repository.
- Names compliant with the naming rules (checked by Kuno).
- Security roles checked by Sigi.
- Kuno review without open critical findings, Tessa tests passed.
- No open DECISION for the story.
- No secrets in the repository; environment variables and connection references used.
