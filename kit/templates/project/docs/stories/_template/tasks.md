# Tasks – Story <story ref>

Each file/component belongs to exactly one agent. States: to do | in progress | done | blocked.

| # | Task | Agent | Owned files/components | Depends on | Rules | State |
|---|---|---|---|---|---|---|
| T1 | Data model | dora-dataverse | docs/data-model.md, tables <prefix>_* | – | DV-02 | to do |
| T2 | Roles and permissions | sigi-security | docs/security.md, roles, table permissions | T1 | SEC-01 | to do |
| T3 | SPA wizard | paula-pages-spa | src/pages-spa/src/features/<...>/** | T2 | FE-04 | to do |
| T4 | E2E tests | tessa-tests | tests/e2e/<...>.spec.ts | T3 | TST-01 | to do |
