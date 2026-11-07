---
name: test
description: Playwright functional tests with Tessa on DEV, report linked to the user story.
argument-hint: [Story-ID | sprint]
---
Normally run **once at the end of the sprint** (`/test <sprint>`: all stories of the sprint in one run) and before every release to TEST. Run Vitest with `--maxWorkers=2`; don't reinstall dependencies in a new worktree when an identical `node_modules` exists.

Delegate steps 1–4 to **tessa-tests**: story $ARGUMENTS. Steps 5–6 are done by the main session.

1. Check that the target URL is the DEV environment of `CLAUDE.md` (never TEST, STAGING or PROD – ALM-01).
2. Update/create the tests in `tests/e2e/` from the acceptance criteria (`docs/stories/$ARGUMENTS/spec.md`).
3. Run `npx playwright test --project=chromium` with trace on failure.
4. Report in `docs/stories/$ARGUMENTS/test-report.md` (cases, passed/failed, paths of screenshots/traces).
5. If all tests pass: `node ~/.claude/hooks/pp-kit/state.cjs test`.
6. With a story given, add a summary comment (Azure DevOps: `azure-devops` MCP server; GitHub: `gh issue comment $ARGUMENTS`).
