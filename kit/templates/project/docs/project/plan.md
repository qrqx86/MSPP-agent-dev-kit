# Project plan – <Name>

- Status: Draft | Approved (DECISION <id>, <person>, <date>)

## Architecture (ALM-09)
| Type | Needed | Components | Agents |
|---|---|---|---|
| Core | yes | tables, security roles, model-driven app | Dora, Sigi, Moritz |
| Automation | <yes/no> | cloud flows | Flo |
| Integration | <yes/no> | Custom APIs, Azure Functions | Peppi |
| Frontend | <yes/no> | Power Pages SPA / Code App | Paula / Cody |

## Data model outline (DV-01)
| Table | New/Standard | Purpose | Personal data |
|---|---|---|---|

## Security outline (SEC-01, SEC-04)
| Role | Internal/Web | Access |
|---|---|---|

## Integrations
| System | Direction | Mechanism | Owner of the data |
|---|---|---|---|

## ALM
- Solutions and repositories: see `CLAUDE.md`. Agents work only on DEV (ALM-01); TEST/PROD via pipeline (ALM-07).

## Verified facts (day 0)
| # | Fact | How it was verified |
|---|---|---|
| F1 | Tracker process of the real projects and state categories (e.g. Scrum: `Done`, Agile: `Closed`) | `workitemtypes/{type}/states` |
| F2 | Workstation ready: CLIs, logins to DEV, clone outside OneDrive | `doctor.cjs` |

## Conventions to fix before the first sprint
- Naming approved → **one** regeneration of the backlog texts (titles, criteria) with the final names, before sprint 1.
- Domain fields (profiles, types, states): for each one "free text or coded list?".
- Cross-cutting UI conventions (front end): a single "Refresh" command, buttons with an icon and no symbols in the text,
  standard grid filters (state, assignee, search), empty-list messages, confirmations. They go into a file of the front-end repository
  that the developer reads before every page and Kuno uses in the review.
- Process states by **category**, not by name, if the app reads work items or configurable processes.

## Rules that shape the design
- <rule ID>: <consequence>

## Assumptions
- <...>

## Risks
| Risk | Impact | Mitigation |
|---|---|---|

## Decisions for the sponsor
- <question> – options – recommendation
