# Known issues and the right command

Mistakes every agent made at least once. Read the row that applies to you before working around a problem your own way.

## Git and commits
| Symptom | Cause | What to do |
|---|---|---|
| Commit rejected by the hook with `-qam`, a PowerShell here-string (`@'…'@`) or `-m "$MSG"` | the hook reads the message only from literal `-m`/`-F` and looks for the story reference | commit **in Bash** with separate `-m`: `git commit -m "feat: … AB#123" -m "<details>" -m "AI-Assisted: Claude Code (<agent>)" -m "Verified: …"` |
| Another agent's files in the commit | `git add -A` / `git commit -a` | `git add <your files>` only; then `git pull --rebase` and `git push` |
| Incomplete index, a commit that deletes hundreds of files, `unable to append to .git/logs/HEAD` | paths beyond 260 characters or a clone synced by OneDrive | clone into a short folder outside OneDrive; `node ~/.claude/hooks/pp-kit/doctor.cjs --fix` sets `core.longpaths` and `windows.appendAtomically` |
| `npm ci` of 10+ minutes in every worktree | every worktree reinstalls the dependencies | `node tools/worktree.cjs new C:\t\wt-<sprint> <branch> --app <app folder>`: junction to a `node_modules` with the same `package-lock.json` |
| `git worktree remove --force` deletes the `node_modules` of another worktree | the junction is followed | **never `--force`**: `node tools/worktree.cjs remove <worktree> --app <app folder>` (drops the junction first); without the script: `cmd /c rmdir <worktree>\<app>\node_modules`, then `git worktree remove <worktree>` |
| Conflict markers `<<<<<<<` in the resource files | merges of parallel sprints on the same JSON | merge driver `tools/merge-locales.cjs` (key merge, `main` wins); without it: merge by hand, then `git diff --check` and a JSON parse before the commit |

## Dataverse and Power Platform
| Symptom | Cause | What to do |
|---|---|---|
| Scripts calling the Web API fail, every agent writes its own wrapper | Dataverse CLI missing or profile expired | use the `dataverse` CLI; if it is missing or the profile does not point to DEV, **stop and report it** (the product owner installs/renews it, `doctor.cjs`): no own wrappers outside the repository |
| A token for the DEV Web API is needed | – | `az account get-access-token --resource <DEV URL>`; never extract the token from the `pac` cache |
| `pa app push` fails with AADSTS70043 or similar | `pa` CLI login expired | stop: the product owner renews the login |
| Solution export older than `main` (Kuno finding) | push without a following export | after every push to DEV: `pac solution export` (unmanaged) → `unpack` → commit with the push hash |
| `MissingDependency` on import | import order between solutions | import the solution the other depends on first (e.g. Integration before Extension) |
| The product owner does not see the changes after the push | the app is cached in the browser | always end the push message with "reload the app page" |

## Work item tracker
| Symptom | Cause | What to do |
|---|---|---|
| Thousands of tokens per MCP write | `work_item_write`, `link_write`, `comment_write` return the whole work item | batch the writes, or use `pp.cjs` in the main session; read with the needed `fields` only, never `expand=all` |
| Wrong percentages and counts across projects | state names differ per process (Agile `Closed`, Scrum `Done`) | reason by state **category** (`Proposed`, `InProgress`, `Resolved`, `Completed`, `Removed`), read from `workitemtypes/{type}/states` |

## Tests (Vitest, Playwright, Fluent UI)
| Symptom | Cause | What to do |
|---|---|---|
| Flaky tests or timeouts that pass on an idle machine | several agents run builds and tests at the same time | one agent at a time runs tests in the same repository; Vitest `--maxWorkers=2`; before investigating, rerun the single file once on an idle machine |
| `aria-hidden` stays on the page after a Fluent dialog | two modal layers open together | close the first dialog before opening the second; in tests find the dialog with `findByRole('dialog')` after opening |
| A test finds a text "by chance" elsewhere on the page | queries on the whole screen | scope the queries to the component: `within(<container>).getByRole(...)` |
| axe specs time out as data grows | timeout tuned for little data | a dedicated, higher timeout for the axe specs, not for the whole suite |
| Other agents' tests broken without anyone noticing | different gates per agent (excluded folders) | one gate: `npm test` runs every folder (unit, acceptance, contract) for everyone |
