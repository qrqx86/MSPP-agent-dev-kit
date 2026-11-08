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
- Sprint rhythm (efficiency): sprint plan with Pia → build the whole sprint, one agent per **work block** and no
  intermediate review → a single verification round at the end of the sprint in parallel (Tessa `/test <sprint>`,
  Sigi permissions, Kuno `/review <sprint>`) → a single fix pass → story closing with Pia.
- Exceptions with an immediate check: Sigi before applying security role changes in DEV; Kuno before every release
  to TEST/PROD; irreversible operations never without a DECISION.
- Without agents (main session): targeted documentation changes, tracker comments and states, `decisions.md`, merge and
  push, small fixes (≤ ~50 lines, no security roles), descriptions and texts. Routine exports with Alma on `model: sonnet`.
- Agent assignments: exact files and commands, a done criterion and a tool-call budget; fixed-contract report
  (pp-team-rules §10); absence claims are checked with one targeted check; Medium/Low findings in
  `docs/stories/<sprint>/reviews/to-fix.md`; no `npm ci` in a new worktree when an identical `node_modules` exists.
- DECISION only for alternatives not covered by the approved plan, deviations and risky assumptions; one tracker comment per story at the end of the sprint.

## Agent operating rules
- Workstation: `node ~/.claude/hooks/pp-kit/doctor.cjs` on day 0 and at the start of every sprint (CLIs, logins to DEV,
  clone outside OneDrive, `core.longpaths`, RAM). The product owner renews expired logins.
- Clones and worktrees, in short folders outside OneDrive:

  | Repository | Clone | Active worktrees |
  |---|---|---|
  | `<project> - Core` | `C:\r\<repo>` | – |

  Agent worktrees in `C:\t\wt-<sprint>`, `node_modules` linked with a junction (known issues in `pp-team-rules`).
- Existing scripts, to use instead of rewriting them (update with every new script):

  | Script | Repository | Use |
  |---|---|---|
  | `~/.claude/hooks/pp-kit/pp.cjs` | kit | main session: `commit`, `task`, `decisions open/close`, `ado comment/state`, `stats` (one result line) |
  | `~/.claude/hooks/pp-kit/doctor.cjs` | kit | workstation and login check |
  | `tools/verify.cjs`, `tools/worktree.cjs`, `tools/merge-locales.cjs` | frontend | gates in 3–5 lines, worktrees with junctions, merge of resource files (template `templates/frontend/`) |
  | `<scripts/...>` | `<repo>` | <use> |

- **Agent assignment:** only the task, owned files, story references (`spec.md`, `plan.md`, `tasks.md`), check commands,
  done criterion and budget. Commit rules, prohibitions, known issues and the report format live in `pp-team-rules`: do not repeat them.
- **Agent prohibitions:** DEV only; no writes to the tracker (the main session does them); pushes to DEV
  (`pa app push`, `pac pages upload-code-site`) only with the sprint authorization (`plan.md`, § Sprint authorizations).
- **Organization (tokens first, then speed):**
  - one agent per specialist and sprint, resumed block by block with `SendMessage` instead of starting a new one;
  - one agent at a time runs builds and tests in the same repository; Tessa starts when the developer is done;
  - in parallel only agents on different repositories;
  - several stories in one assignment only if they touch the same files;
  - separate branches only when really needed (e.g. `main` blocked); a second developer in parallel only if the product owner asks to shorten the time.
- After every push to DEV: export the solution into the repository and tell the product owner "reload the app page" with 3–4 points to try (5–10 minutes).

## Tools (binding)
- PAC CLI, Dataverse CLI (`dataverse`), Power Apps CLI (`pa`); no manual changes in the maker portal.
- Project MCP servers (`.mcp.json`): `dataverse` (DEV only), `azure-devops` (only with that tracker; targeted reads with the needed `fields` only).
- Repetitive writes to the tracker and the registers (comments, states, closing decisions, task states, commits):
  `node ~/.claude/hooks/pp-kit/pp.cjs …` instead of the MCP server, which returns the whole work item every time.
  `--dry-run` shows what it would do; Azure DevOps writes ask for confirmation (hook).
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
- Open decisions are shown to the product owner as a table (ID, question, options, recommendation): they answer by ID ("1608–1614 A, 1616 C").
- A decision is closed only with an **explicit** answer that contains the approval and the ID or the option. Phrases like
  "don't block" or "ok go" with several open decisions are not an approval: ask which IDs. The verbatim answer goes into the outcome comment.

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
- Kuno **sprint** review without open Critical/High findings, Tessa sprint tests passed;
  Low findings tracked in `to-fix.md` do not block Done.
- No open DECISION for the story.
- A check blocked by external people or teams does not block Done if the team's work is complete, reviewed and tested:
  it becomes a linked follow-up story. The story whose purpose is exactly that check stays open.
- No secrets in the repository; environment variables and connection references used.
