# Initial backlog – <Name>

Proposed user stories in delivery order. After approval they are created in the tracker and planned one by one with `/story <ID>`.
States: proposed | created (<story ref>) | dropped

| # | Story | As a … I want … so that … | Acceptance criteria | Agents | Depends on | Rules | State |
|---|---|---|---|---|---|---|---|
| S1 | Project setup | as the team I want repositories, solutions and the DEV profile so that we can build | repositories and solutions exist; CLAUDE.md filled in | Alma | – | ALM-09, NAM-02 | proposed |
| S2 | Data model | as the team I want the approved data model so that features can be built | ER diagram approved; tables in the Core solution; role matrix approved | Dora, Sigi | S1 | DV-02, SEC-01 | proposed |
| S3 | Release pipeline | as the team I want an export and release pipeline so that TEST gets managed solutions | export and release run green on TEST | Alma | S1 | ALM-07 | proposed |
