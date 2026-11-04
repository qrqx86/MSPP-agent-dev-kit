---
name: story
description: Implement a user story from Azure DevOps or a GitHub issue with an approved plan, delegation to the specialists, review and test.
argument-hint: <Story-ID>
disable-model-invocation: true
---
Story **$ARGUMENTS**. Tracker and its coordinates come from `CLAUDE.md` (Work tracking).

## 1. Specification
- Load the story with its acceptance criteria: Azure DevOps through the `azure-devops` MCP server; GitHub with `gh issue view $ARGUMENTS --json title,body,state,labels`. If the tool is not available, stop and ask.
- Create `docs/stories/$ARGUMENTS/` from the templates (`~/.claude/pp-kit/templates/project/docs/stories/_template/`) and fill in `spec.md`.
- Suggest a branch `feature/$ARGUMENTS-<slug>` if you are not already on a branch of the story.

## 2. Plan
- Identify the relevant rules (project `CLAUDE.md`, organization rulebook, skill `pp-standards`).
- Write `plan.md` (approach, components, rule IDs, assumptions, risks) and `tasks.md`: each task with **owner agent**, **owned files/components** (no overlap between agents), dependencies.
- Consistency check: every acceptance criterion is covered by at least one task and one test by Tessa; no file assigned to two agents; every task cites its rules. Fix before continuing.
<!-- gate: plan-approval -->
- Record the plan as "DECISION: Plan story $ARGUMENTS" (`~/.claude/pp-kit/decision.md`), update `decisions.md` and **wait for approval** (status Approved, or explicit answer in chat → update the DECISION).

## 3. Implementation
Delegate the tasks of `tasks.md` in dependency order (data model → security → front end/back office/flows → pro-code). Pass each agent: story ID, task, owned files. Independent tasks with disjoint files may run in parallel.

## 4. Quality
Run `/review $ARGUMENTS` and `/test $ARGUMENTS`. Fix confirmed Critical/High findings by delegating to the owner agent.

## 5. Closing
Update the story status and `tasks.md`; link the commits with the story reference (`AB#$ARGUMENTS` or `#$ARGUMENTS`). With a pull request flow, open the PR referencing the story.
