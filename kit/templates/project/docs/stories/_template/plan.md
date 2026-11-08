# Plan – Story <story ref>

- Status: Draft | Approved (DECISION <id>, <person>, <date>)

## Verified facts
Read-only checks in DEV and in the repositories before the plan: what really exists, not what is assumed.
| # | Fact | How it was verified |
|---|---|---|
| F1 | <e.g. table <prefix>_x exists with 0 rows; the product owner has no operator role> | <command or file> |

## Sprint authorizations
Decided with the plan approval, so they do not become separate DECISIONS during the build.
- Pushes to DEV with green gates (`pa app push`, `pac pages upload-code-site`): <yes/no, by whom>
- Cleanup of test data in DEV: <yes/no>, only rows with the prefix `<SPRINT-PREFIX>-`
- Test data prefix of the sprint: `<SPRINT-PREFIX>-`

## Approach
<summary of the solution>

## Components
| Component | Type | New/Changed | Agent |
|---|---|---|---|
| <prefix>_<table> | Dataverse table | New | Dora |

## Rules applied
- <rule ID>: <how it is met>

## Assumptions
- <...>

## Risks
| Risk | Impact | Mitigation |
|---|---|---|
