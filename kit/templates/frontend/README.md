# Template for the front-end repository (Code App, Power Pages SPA)

Copy it into the front-end repository at the first sprint (`/new-project`, step 5). It contains the choices that previous projects
fixed only after several sprints.

| File | Use |
|---|---|
| `docs/ui-conventions.md` | cross-cutting UI conventions: fill in with the product owner before the first page |
| `tools/verify.cjs` | quality gates with a 3–5 line result (`node tools/verify.cjs --app <app folder>`); full log in `.verify/` |
| `tools/worktree.cjs` | agent worktrees with a linked `node_modules` (junction) and safe removal, without `--force` |
| `tools/merge-locales.cjs` | merge driver for the JSON resource files (key merge) |

## One-time setup per clone
```bash
git config merge.locales.name "deep merge of JSON resources"
git config merge.locales.driver "node tools/merge-locales.cjs %O %A %B"
echo "**/locales/**/*.json merge=locales" >> .gitattributes
echo ".verify/" >> .gitignore
```

## Technical choices for the first sprint
- **Single gate:** the `test` script runs every folder (unit, acceptance, contract); the same gates for agents and the main session.
- **Budget of the initial bundle** as a `budget` script and a gate from the start.
- **Vite:** no `manualChunks` for the UI library (Fluent): it ends up in the initial page. Pages loaded with `lazy()`.
- **i18n:** namespaces per page (`src/i18n/namespaces.ts`), not a single resource file.
- **Tests:** a `findDialog` helper for Fluent dialogs, queries scoped to the component (`within`), a dedicated higher timeout for the axe specs.
- **Process states by category** (e.g. `stateCategory.ts`), never by name: Agile, Scrum and Basic use different names.
- **Multi-step saves:** the "main write + junctions" use case returns `savedRow` (id, `modifiedon`) even on error.
