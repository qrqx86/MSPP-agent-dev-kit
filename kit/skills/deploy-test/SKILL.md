---
name: deploy-test
description: Quality gate (Kuno + Tessa) and release to TEST through the release pipeline (Alma).
argument-hint: <Story-ID>
disable-model-invocation: true
---
Release to TEST for story $ARGUMENTS. Stop at the first failed check.
Agents never connect to TEST (ALM-01): the release is performed **only by the pipeline** `<repo> - Release`.

<!-- gate: decisions-closed -->
1. **Decisions**: no open DECISION under the story (tracker from `CLAUDE.md`; compare with `docs/stories/$ARGUMENTS/decisions.md`).
<!-- gate: quality -->
2. **Kuno**: `/review $ARGUMENTS` in **full** mode (before a release), no confirmed Critical/High finding. If the sprint review already passed on the same code, the full mode on the later diff is enough.
3. **Tessa**: `/test $ARGUMENTS` on DEV, all tests passed.
4. **Alma** (DEV only):
   - increase the version, `pac solution export` from DEV, `pac solution unpack` into `solution/<SolutionName>/`;
   - check dependencies, connection references, environment variables (`config/settings-test.json`);
   - commit `chore(release): <SolutionName> <version> <story ref>` with `AI-Assisted:` and `Verified:` lines; push or pull request according to the change flow in `CLAUDE.md`.
<!-- gate: pipeline-start -->
5. Show version, pipeline (`<repo> - Release`) and TEST stage, **wait for confirmation**, then start the pipeline
   (Azure DevOps: `azure-devops` MCP server; GitHub: `gh workflow run release-<repo>.yml -f environment=test`).
   STAGING and PROD are started by a person, never from here.
6. Summarise version, pipeline outcome and link; update the story.
