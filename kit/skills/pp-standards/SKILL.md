---
name: pp-standards
description: Baseline engineering standards for Power Platform solutions (ALM, environments, naming, Dataverse data model, security, Power Pages SPA, Code Apps, model-driven apps, Power Automate, pro-code, observability, accessibility, testing). Use ALWAYS before designing, building or reviewing any Power Platform component. An organization rulebook linked in rules/ or referenced in the project CLAUDE.md takes precedence.
---
# Power Platform baseline standards

These are the kit's default rules. Each has a stable ID that agents cite in plans, results and reviews.
**Level:** **MUST** (mandatory; deviation only through an approved DECISION) or **SHOULD** (recommended; skipping it
requires a reason in the result).

## Precedence and customization
1. Project `CLAUDE.md` (project conventions and approved deviations).
2. Organization rulebook, if any: files in `~/.claude/skills/pp-standards/rules/` (the installer links the folder
   given in `PPKIT_RULES_REPO`) or a skill named in the project `CLAUDE.md`. Cite its own rule IDs.
3. This baseline → Microsoft skills of the installed plugins → general knowledge.
If a request conflicts with a MUST rule, the rule wins: report the conflict, do not resolve it on your own.
If a topic is not covered by any rule, state it as an assumption; **never invent rule IDs**.

## ALM and environments
| ID | Level | Rule |
|---|---|---|
| ALM-01 | MUST | Agents, MCP servers and CLIs operate **only on the DEV environment** declared in `CLAUDE.md`. TEST, UAT, STAGING and PROD are reached only through the release pipeline. |
| ALM-02 | MUST | Every component lives in the project solution(s); nothing in the Default solution; no manual changes in the maker portal. |
| ALM-03 | MUST | Changes made in DEV (also via MCP) are brought back to source: `pac solution export` + `unpack` into `solution/<SolutionName>/` and committed. |
| ALM-04 | MUST | DEV is unmanaged; every downstream environment receives managed solutions. |
| ALM-05 | MUST | Version `Major.Minor.Build.Revision`, increased before every release (`pac solution version`). |
| ALM-06 | MUST | Environment-specific values via environment variables and connection references; per-stage deployment settings in `config/settings-<environment>.json` (from `pac solution create-settings`); secrets only in Key Vault / pipeline secrets. |
| ALM-07 | MUST | Release pipeline: build → Solution Checker (SARIF) → import TEST → approval gate → later stages. Azure DevOps (Power Platform Build Tools v2) or GitHub Actions (`microsoft/powerplatform-actions`), with workload identity federation / OIDC instead of client secrets. |
| ALM-08 | MUST | Work only on a user story with an ID; commits reference it (`AB#<ID>` or `#<ID>`) and declare AI use and the checks actually run. |
| ALM-09 | SHOULD | One repository and one solution per type (Core, Automation, Integration, Extension/Frontend), only the types the project needs. |
| ALM-10 | MUST | Search for existing publishers and solutions before creating new ones; never the `new` prefix. |

## Naming (kit defaults – the project `CLAUDE.md` may override them)
| ID | Object | Pattern | Example |
|---|---|---|---|
| NAM-01 | Publisher prefix | 2–8 lowercase letters, one per organization/product | `cnt` |
| NAM-02 | Solution | `<Area>_<Domain>_<Type>`, Type = Core, Automation, Integration, Extension | `Grants_Funding_Core` |
| NAM-03 | Tables, columns | `{prefix}_{name}`: English, lowercase, **singular**, no internal underscores (except language suffixes such as `_en`) | `cnt_application`, `cnt_submissiondate` |
| NAM-04 | Yes/No, dates, lookups | `{prefix}_is…`/`_has…`; `…date`; `{prefix}_{targettable}[{role}]` | `cnt_ispaid`, `cnt_contactapplicant` |
| NAM-05 | Choices | global choice `{prefix}_{name}`, values with stable numeric codes | `cnt_applicationstatus` |
| NAM-06 | Display names | Sentence case, in the base language; other languages via translations | `Submission date` |
| NAM-07 | Cloud flows | `<Project> - <Trigger> - <Entity> - <Action>`; actions `Verb_Object`; variables `var<Name>` | `Grants - Dataverse - Application - Notify` |
| NAM-08 | Environment variables, connection references | `{prefix}_<Purpose>` / `{prefix}_<connector>_<purpose>` | `cnt_ApiBaseUrl` |
| NAM-09 | Security roles | `<solution> - <role>` | `Grants - Case worker` |
| NAM-10 | Web resources | `{prefix}_/<solution>/<path>/<file>.<ext>` | `cnt_/grants/js/application.js` |
| NAM-11 | Pipelines | `<repo> - Export`, `<repo> - Release`; files `pipelines/export-<repo>.yml` or `.github/workflows/release-<repo>.yml` | |
Every deviation is justified and recorded as a DECISION.

## Dataverse data model
| ID | Level | Rule |
|---|---|---|
| DV-01 | MUST | Analyse and reuse the existing schema; **extend** standard tables (`contact`, `account`) instead of recreating them. |
| DV-02 | MUST | Data model proposed as a Mermaid ER diagram with a column table (schema name, type, required, labels, personal data yes/no) and approved **before** any component is created. |
| DV-03 | MUST | Data minimization: no copies of master data owned by another system; store references (external IDs as alternate keys). |
| DV-04 | SHOULD | Global choices; alternate keys for integrations; auditing on tables with personal or business-critical data. |
| DV-05 | SHOULD | For each table: ownership type, data owner, personal-data columns, retention. |

## Security
| ID | Level | Rule |
|---|---|---|
| SEC-01 | MUST | Least privilege: role matrix (table × privilege × depth) approved before creation. |
| SEC-02 | MUST | Teams and business units instead of individual assignments; application users only for integrations, each with a dedicated role. |
| SEC-03 | MUST | Column-level security for sensitive columns. |
| SEC-04 | MUST | Power Pages: table permissions with the narrowest scope (self, contact, account, parent); **Global scope never without a written reason**. |
| SEC-05 | MUST | Power Pages Web API site settings `Webapi/<table>/fields` with explicit columns, never `*`. |
| SEC-06 | MUST | No secrets, tokens or real personal data in the repository, logs, telemetry, tests or examples. |
| SEC-07 | SHOULD | OWASP Top 10 review for every front end and API; dependency audit before release. |

## Front ends and back office
| ID | Level | Rule |
|---|---|---|
| FE-01 | MUST | Power Pages sites for external users are built as SPAs (React + TypeScript strict, Vite), managed from source with `pac pages upload-code-site`/`download-code-site`. |
| FE-02 | MUST | SPA data only through the Power Pages Web API (`/_api/...`, CSRF token) with explicit `$select`; never direct Dataverse calls. |
| FE-03 | MUST | Authentication through the identity providers configured on the site (e.g. Microsoft Entra External ID, Azure AD B2C, OpenID Connect). |
| FE-04 | SHOULD | Multi-step wizards as reusable components: per-step validation, draft save, summary before submit. |
| CA-01 | MUST | Code Apps with the `pa` CLI, data only through generated connectors/Dataverse services, no hard-coded endpoints. |
| BE-01 | SHOULD | Model-driven apps designed around operator work queues; custom/generative pages only when standard UI is not enough. |
| BE-02 | MUST | Client logic in TypeScript web resources, namespaced, linted with `@microsoft/eslint-plugin-power-apps`; selective publishing (`PublishXml`). |

## Automation, pro-code, observability
| ID | Level | Rule |
|---|---|---|
| AU-01 | MUST | Flows inside the solution, with connection references and environment variables; no personal connections, no fixed URLs or IDs. |
| AU-02 | MUST | Error handling with Try/Catch/Finally scopes and explicit retry policies; idempotent processing. |
| AU-03 | SHOULD | Synchronous, transactional or performance-critical logic → plug-in instead of a flow (justify). |
| AU-04 | MUST | Respect the environment DLP policies. |
| PC-01 | MUST | Pro-code only with a written reason why low-code is not enough (DECISION). |
| PC-02 | MUST | Plug-ins stateless, idempotent, with `ITracingService`; Custom APIs instead of custom actions; unit tests. |
| OB-01 | SHOULD | Telemetry to Application Insights, without personal data. |

## Accessibility, languages, testing
| ID | Level | Rule |
|---|---|---|
| ACC-01 | MUST | WCAG 2.1 AA; no serious/critical axe-core violations. |
| MUL-01 | MUST | All languages declared in `CLAUDE.md` supported through resource files/translations; no hard-coded UI text. |
| TST-01 | MUST | Each acceptance criterion covered by a Playwright test, run on DEV; stable selectors, no fixed waits, test data created and removed. |
| TST-02 | MUST | Power Apps Test Engine (`pac test run`) is deprecated: do not use it. |

## Obligations
- Cite the IDs of the relevant rules in every plan, result and review.
- A deviation from a MUST rule requires a DECISION ("DECISION: Deviation <ID>") and, if lasting, an ADR.
