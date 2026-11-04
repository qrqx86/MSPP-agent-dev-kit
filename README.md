# pp-kit – Vibe coding on the Power Platform with Claude Code

A reusable kit for building Power Platform solutions with Claude Code: 11 specialised subagents, shared team rules,
a baseline standards skill, workflow skills (`/story`, `/review`, ...), safety hooks and project templates.
It builds on **all** Microsoft `power-platform-skills` plugins and adds what they do not cover: DEV-only guard rails
(PROD/TEST blocked), secret scanning, a story-driven workflow linked to **Azure DevOps Boards or GitHub Issues**,
DECISION work items for every approval, and a multi-perspective review gate.

## Installation
Windows (PowerShell), macOS and Linux (bash/zsh) – the same commands:
```bash
git clone https://github.com/qrqx86/pp-kit.git pp-kit
cd pp-kit
node install.cjs --dry-run   # shows what would be copied
node install.cjs             # installs into ~/.claude (automatic backup of settings.json)
node install.cjs --uninstall # removes the kit (your other hooks, skills and config.json are preserved)
```
Restart Claude Code after installing.

What the installer touches in `~/.claude`:
| Path | Change |
|---|---|
| `agents/<11 agents>.md`, `skills/<9 skills>/` | copied; an agent or skill **with the same name that pp-kit did not install is skipped** (use `--force` to overwrite) |
| `hooks/pp-kit/` | hook scripts; your `config.json` there is never overwritten or removed |
| `pp-kit/` | templates, DECISION procedure, `manifest.json` (what was installed, used by `--uninstall`) |
| `settings.json` | pp-kit hook entries added (re-install replaces only them); backup `settings.json.bak-ppkit-<timestamp>` |

Re-installing overwrites local edits to pp-kit's own agents and skills: customise through the project `CLAUDE.md`,
your rulebook or `config.json` instead. Requires a Claude Code version with subagent `skills` preloading and
`SubagentStop` hooks (2025 or later).

Requirements:
- Node.js ≥ 18
- `dataverse` and `pa` CLIs: `npm i -g @microsoft/dataverse @microsoft/power-apps-cli`
- PAC CLI, up to date: `dotnet tool update --global Microsoft.PowerApps.CLI.Tool`
- Azure DevOps tracker: az CLI (`az login`) for the `azure-devops` MCP server · GitHub tracker: `gh` CLI (`gh auth login`)

Microsoft plugins (marketplace `microsoft/power-platform-skills`): power-pages, model-apps, canvas-apps,
code-apps-preview, mcp-apps, pcf, power-automate, dataverse, mobile-app, power-apps-mobile-extension,
process-intelligence. Update:
```powershell
$env:GIT_CONFIG_COUNT='1'; $env:GIT_CONFIG_KEY_0='url.https://github.com/.insteadOf'; $env:GIT_CONFIG_VALUE_0='git@github.com:'
claude plugin marketplace update power-platform-skills
claude plugin update dataverse@power-platform-skills   # repeat for each plugin
```
(The variable forces HTTPS: otherwise the `dataverse` plugin is cloned via SSH.)

## Tests
```powershell
node tests/hooks.test.cjs     # deterministic hook tests (copies the hooks to a temp folder)
node tests/install.test.cjs   # installer and uninstaller in a temporary ~/.claude
node tests/validate-kit.cjs   # kit structure, obsolete commands, real environment URLs, rule IDs
node tests/run-evals.cjs      # agent behaviour scenarios (calls Claude, costs tokens)
node tests/run-evals.cjs --only alma-no-prod-import
```
The evals run the agents **installed** in `~/.claude` (install first), headless in plan mode.

## Contents
| Folder | Destination | Content |
|---|---|---|
| `kit/agents/` | `~/.claude/agents/` | Pia, Alma, Dora, Sigi, Cody, Paula, Moritz, Flo, Peppi, Tessa, Kuno (model, colour, preloaded skills) |
| `kit/skills/pp-team-rules/` | `~/.claude/skills/` | common rules: Rule 0 environment, valid tools, story files, DECISIONS, escalation after 2 attempts, result format, PAC pitfalls |
| `kit/skills/pp-standards/` | `~/.claude/skills/` | baseline standards with rule IDs (+ optional `rules/` for your organization rulebook) |
| `kit/skills/{new-project,project-plan,story,data-model,review,test,deploy-test}/` | `~/.claude/skills/` | workflows invoked with `/name` |
| `kit/hooks/` | `~/.claude/hooks/pp-kit/` | Node.js hooks |
| `kit/templates/` | `~/.claude/pp-kit/templates/` | `CLAUDE.md`, `.mcp.json`, `.gitignore`, `docs/project/`, `docs/stories/_template/`, `docs/adr/`, DECISION procedure |
| `kit/evals/` | – | behaviour scenarios |

## Agents
| Agent | Model | Delegates to (Microsoft skills) |
|---|---|---|
| Pia (planner) | opus | – (writes spec.md, plan.md, tasks.md; builds nothing) |
| Alma (ALM) | opus | dataverse:dv-solution, power-pages:plan-alm/setup-pipeline/deploy-pipeline/export/import |
| Dora (Dataverse) | opus | dataverse:dv-metadata, power-pages:setup-datamodel |
| Sigi (security) | opus | dataverse:dv-security, power-pages:create-webroles/table-permissions/audit-permissions |
| Cody (Code Apps) | sonnet | code-apps-preview:* (`pa` CLI) |
| Paula (Power Pages SPA) | sonnet | power-pages:create-site/integrate-webapi/add-localization/deploy-site |
| Moritz (model-driven apps) | sonnet | model-apps:app-builder/genpage, dataverse:dv-metadata |
| Flo (Power Automate) | sonnet | power-automate:* (FlowAgent MCP) |
| Peppi (pro-code) | sonnet | pcf:pcf |
| Tessa (tests) | sonnet | Playwright + power-platform-playwright-samples, power-pages:test-site |
| Kuno (quality, read-only) | opus | power-pages:scan-code/security-review/audit-permissions |

## Workflow
1. `/new-project <Name>` – repositories, `CLAUDE.md`, `.mcp.json`, pac/dataverse auth, solutions.
2. `/project-plan <brief>` – **project level**. Pia writes `docs/project/spec.md`, `plan.md` (architecture) and
   `tasks.md` (initial backlog of proposed stories); then the main session records the DECISION, waits for approval
   and creates the stories in the tracker.
3. `/story <ID>` – **story level**, for each story of the backlog. Pia writes `docs/stories/<ID>/spec.md`, `plan.md`,
   `tasks.md` (owner agent and owned files per task); then the main session runs the consistency check, records the
   DECISION, waits for approval and delegates the tasks to the specialists.

   Pia only writes the planning files and adds rows to the project decision register `docs/project/decisions.md`:
   she never approves, creates work items or delegates (subagents cannot); the main session updates the register states.
4. `/data-model` – Dora proposes, Sigi derives roles and permissions, approval, creation.
5. `/review` – automated checks → Kuno in parallel on 4 perspectives → verification of every Critical/High finding.
6. `/test` – Tessa with Playwright on DEV.
7. `/deploy-test` – quality gate, then Alma and the release pipeline to TEST.

`/new-project`, `/project-plan`, `/story` and `/deploy-test` can only be started by a person (`disable-model-invocation`).

## Work item tracker: Azure DevOps or GitHub
Declared per project in `CLAUDE.md` (`- Work item tracker: azure-devops | github`).
| | Azure DevOps | GitHub |
|---|---|---|
| Story | User Story work item | Issue |
| Commit reference | `AB#123` | `#123` |
| DECISION | Task child of the story, tag `Decision` | Issue with label `decision`, `Parent: #123` in the body |
| Tooling | `azure-devops` MCP server | `gh` CLI (or a GitHub MCP server) |
| Pipelines | Azure Pipelines + Power Platform Build Tools | GitHub Actions + `microsoft/powerplatform-actions` |

## Hooks
| Hook | Event | Scope | Effect |
|---|---|---|---|
| `pre-shell.cjs` | PreToolUse Bash/PowerShell | everywhere | **denies** creating, deleting, resetting, restoring or copying environments (`pac admin …`, `pac env …`) and `pac data bulk-delete`; **blocks** TEST, UAT, QA, STAGING and PROD – checked only on environment designators: Power Platform hosts, `--environment`/`--environment-id`/`-env`/`--url` values of pac/pa/dataverse, the active pac profile and release commands (so `vite build --mode production` is fine); **asks for confirmation** for imports, data imports, site uploads, pushes, pipeline/workflow runs, GitHub issue changes |
| | | pp-kit projects with a declared DEV | **allow-list**: only the DEV environment of `CLAUDE.md` (exact URL or ID), also for the active pac profile; local pac commands (`solution pack/unpack`, …) skip the profile check |
| | | pp-kit projects | blocks pushes without a solution (`pac pcf push`, `pa app push`) and `git commit` (also `-F file`, `git -C dir`) without a story reference of the project tracker (`AB#<ID>` or `#<ID>`) |
| `pre-mcp.cjs` | PreToolUse MCP Dataverse/Azure DevOps/GitHub/FlowAgent | everywhere | blocks TEST/STAGING/PROD hosts and environment arguments and, in projects, any environment (URL or GUID) other than DEV; asks for confirmation for write operations (verbs such as create, update, set, edit, run; reads such as `get_run_history` do not ask) |
| `pre-write.cjs` | PreToolUse Write/Edit | everywhere | blocks passwords, keys, tokens (also unquoted in `.env`/YAML), client secrets, connection strings, SAS tokens, JWTs |
| `post-lint.cjs` | PostToolUse Write/Edit | everywhere | Prettier/ESLint `--fix` if installed in the project, `dotnet format whitespace` |
| `session-start.cjs` | SessionStart | pp-kit projects | active story (from the branch), open DECISIONS and unfinished tasks |
| `subagent-stop.cjs` | SubagentStop | pp-kit projects | sends back a team agent's result that lacks the "Rules applied" section |
| `stop-reminder.cjs` | Stop | pp-kit projects | reminds you of /review and /test if missing or if the code changed since (state recorded by `state.cjs`; committing reviewed code keeps it valid) |

"pp-kit project" = a folder whose `CLAUDE.md` contains the marker `<!-- pp-kit:project -->` (the template has it).
Kill switch: `PPKIT_DISABLE_HOOKS=1`. Texts are in `hooks/pp-kit/messages.json`. Local configuration (not overwritten
by the installer; if it is not valid JSON or contains an invalid regex, the hooks block until it is fixed):
`~/.claude/hooks/pp-kit/config.json`, for example to add your environment naming scheme:
```json
{
  "prodPatterns": ["contoso-prd-\\d+\\.crm4\\.dynamics\\.com"],
  "nonDevPatterns": ["-(tst|acc)-\\d{2}\\.crm4\\.dynamics\\.com"],
  "allowPatterns": ["az boards"]
}
```
False positive in the secret scan: add the comment `pp-kit:allow-secret` on that line.

## Standards and your organization rulebook
The `pp-standards` skill contains baseline rules with stable IDs (ALM-01 DEV only, NAM-* naming, DV-* data model,
SEC-* security, FE-* front end, AU-* automation, TST-* testing, ...) that agents cite in plans, results and reviews.
To use your own rulebook, either reference it in the project `CLAUDE.md` or link it into the skill:
```powershell
$env:PPKIT_RULES_REPO = "$HOME\repos\my-pp-rules"; node install.cjs
```
Precedence: project `CLAUDE.md` → organization rulebook → `pp-standards` → Microsoft skills → general knowledge.
Project-specific deviations go into the "Approved deviations" section of `CLAUDE.md`.

## Design choices
- Hooks in Node.js (Windows without Git Bash, macOS, Linux).
- Distributed with an installer, not as a plugin/marketplace.
- The MCP server built into PAC (`pac copilot mcp`) is not used: it is redundant and would bypass the shell hooks.
- Test Engine (`pac test run`) is deprecated: tests use Playwright.
- Dataverse native Git integration does not support SPA sites: the SPA source stays in the repository.
- Permission rules (`permissions.deny`) are not written into the global settings: prohibitions live in the tested hooks.

## Disclaimer
Community project, not affiliated with or endorsed by Microsoft or Anthropic. The hooks are guard rails, not a
security boundary: they read the command text, so values hidden in shell variables or scripts (`$u=...; pac ... --environment $u`,
`pwsh -File deploy.ps1`) are not seen. Keep proper environment permissions, DLP policies and approvals in place.

## License
[MIT](LICENSE) © 2026 Lorenz Corradini
