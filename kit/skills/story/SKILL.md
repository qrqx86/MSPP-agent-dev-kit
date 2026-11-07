---
name: story
description: Implement a user story from Azure DevOps or a GitHub issue with an approved plan, delegation to the specialists, review and test.
argument-hint: <Story-ID>
disable-model-invocation: true
---
Story **$ARGUMENTS**. Tracker and its coordinates come from `CLAUDE.md` (Work tracking).

## 1. Specification
- Load the story with its acceptance criteria: Azure DevOps through the `azure-devops` MCP server; GitHub with `gh issue view $ARGUMENTS --json title,body,state,labels`. If the tool is not available, stop and ask.
- Delegate to **pia-planner** in **story mode** (story ID and, if she cannot load it, the story text): she creates `docs/stories/$ARGUMENTS/` from the templates and writes `spec.md`, `plan.md` and `tasks.md`.
- Suggest a branch `feature/$ARGUMENTS-<slug>` if you are not already on a branch of the story.

## 2. Plan
- Review Pia's `plan.md` (approach, components, rule IDs, assumptions, risks) and `tasks.md` (each task with **owner agent**, **owned files/components** without overlap, dependencies), consistent with `docs/project/plan.md` if present.
- Consistency check: every acceptance criterion is covered by at least one task and one test by Tessa; no file assigned to two agents; every task cites its rules. Gaps go back to Pia before continuing.
<!-- gate: plan-approval -->
- Record the plan as "DECISION: Plan story $ARGUMENTS" (`~/.claude/pp-kit/decision.md`), update `decisions.md` and `docs/project/decisions.md` (with Pia's new rows) and **wait for approval** (status Approved, or explicit answer in chat → update the DECISION).

## 3. Implementation
Delegate the tasks of `tasks.md` in dependency order (data model → security → front end/back office/flows → pro-code). Pass each agent: story ID, task, owned files and the Approved DECISIONS it relies on (subagents cannot ask the user). Independent tasks with disjoint files may run in parallel. One agent per **work block**, not per single task; small changes (documentation, tracker comments, merges, fixes ≤ ~50 lines without security roles) are done by the main session without agents.
Brief with exact files, exact commands, done criterion and tool-call budget (pp-team-rules §10). If the files are not known, first a cheap read-only search (`Explore` agent with `model: haiku`, answer only `path:line`), then the specialist: the specialist does not explore the repository on its own.
An agent's absence claims ("no findings", "section missing", "unchanged", "no match") are checked with **one** targeted check by the main session before acting or closing.

## 4. Quality (at the end of the sprint)
No intermediate review or test per story or per merge. When all stories of the sprint are built: `/review <sprint>` and `/test <sprint>` in parallel with Sigi (permissions). A single fix pass per owner agent; Medium/Low findings are collected in `docs/stories/<sprint>/reviews/to-fix.md`. Immediate exceptions: Sigi before applying security roles; Kuno before a release to TEST/PROD.

## 5. Closing
Update the story status and `tasks.md`; link the commits with the story reference (`AB#$ARGUMENTS` or `#$ARGUMENTS`). With a pull request flow, open the PR referencing the story.
