---
name: project-plan
description: Start a project with Pia the planner - project spec, architecture plan and initial backlog in docs/project/, approval as a DECISION, then creation of the stories in the tracker.
argument-hint: <brief or path to requirements>
disable-model-invocation: true
---
Project plan from: **$ARGUMENTS**. Tracker and coordinates come from `CLAUDE.md` (Work tracking).

## 1. Input
- Collect the brief (text above, documents in the repository, linked files). If purpose, actors or scope are missing, ask before delegating.
- If `docs/project/` already exists, this is a revision: tell Pia to update, not overwrite.

## 2. Plan
Delegate to **pia-planner** in **project mode** with the brief and the paths of the documents.
She writes `docs/project/spec.md`, `plan.md`, `tasks.md` (templates in `~/.claude/pp-kit/templates/project/docs/project/`).
Check her result: every goal covered by a story, the first stories are setup, data model and release pipeline, open questions listed.
<!-- gate: project-plan-approval -->
Record "DECISION: Project plan" (`~/.claude/pp-kit/decision.md`) with the summary and the open questions, note it together with Pia's new rows in `docs/project/decisions.md` and **wait for approval**.
Answers to open questions → Pia updates the files.

## 3. Backlog
<!-- gate: backlog-creation -->
After approval ask for confirmation, then create the stories of `tasks.md` in the tracker (Azure DevOps: User Story via the
`azure-devops` MCP server; GitHub: `gh issue create --label story`), with acceptance criteria in the body, and set
their state in `tasks.md` to `created (<story ref>)`. Then each story is planned with `/story <ID>`.
