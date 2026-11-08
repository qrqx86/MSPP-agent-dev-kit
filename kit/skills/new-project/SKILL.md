---
name: new-project
description: Initialize a new Power Platform project (repositories and solutions per type, naming, CLAUDE.md, .mcp.json, DEV pac profile, publisher and solution) with Azure DevOps or GitHub as work item tracker.
argument-hint: <ProjectName>
disable-model-invocation: true
---
Initialize the project **$ARGUMENTS** with the **alma-alm** agent. One step at a time. Naming: skill `pp-standards` (NAM-*), unless the organization rulebook says otherwise.

0. Check the workstation: `node ~/.claude/hooks/pp-kit/doctor.cjs`. Missing CLIs and expired logins are fixed by the product owner
   before going on. Clones go into a short folder outside OneDrive (e.g. `C:\r\<repo>`).
1. Collect (asking for whatever is missing):
   - owner/sponsor, purpose, Area and Domain (NAM-02), publisher prefix (NAM-01);
   - **work item tracker**: `azure-devops` (organization, project) or `github` (owner/repository);
   - **change flow**: pull request (default) or direct push;
   - **DEV environment**: URL and ID (`pac env list`); the other environments only as names, for the pipelines;
   - needed types: Core, Automation, Integration, Frontend (one or more components); SPA site name; project languages.
2. Compute the names and check each against the naming rules: repositories, solutions and display names, pipelines and YAML files (NAM-11), deployment settings.
<!-- gate: project-data -->
3. Show the summary (table type → repository → solution → pipeline) and **wait for confirmation**.
4. Repositories: for each type create the repository (Azure DevOps: `azure-devops` MCP server; GitHub: `gh repo create`), clone it, structure:
   `solution/ src/ tests/e2e/ docs/stories/ docs/adr/` + `pipelines/` (Azure DevOps) or `.github/workflows/` (GitHub) + `config/` only in Core.
5. In each repository copy from `~/.claude/pp-kit/templates/project/`: `CLAUDE.md`, `.gitignore`, `.mcp.json`,
   `docs/stories/_template/`, `docs/adr/0000-template.md`. In the Frontend repository also copy `templates/frontend/`
   (`docs/ui-conventions.md`, `tools/`) and set up the merge driver of the resource files as described in its README. Fill in `CLAUDE.md` (Project, **DEV environment with URL and ID**,
   Work tracking, Repositories and solutions) and `.mcp.json` (DEV URL; keep `azure-devops` only for that tracker). Unknown values stay `<...>`.
6. Authentication: only the DEV profile (`pac auth create --name <profile> --environment <DEV url>`, `dataverse auth create`
   with the skill `dataverse:dv-connect`). **No TEST/STAGING/PROD profile** (ALM-01). GitHub: `gh auth status`.
   Then, in every clone, `node ~/.claude/hooks/pp-kit/doctor.cjs --fix` (compares the logins with the DEV of CLAUDE.md and sets
   `core.longpaths`); fill in the "Clones and worktrees" table of CLAUDE.md.
<!-- gate: solution-creation -->
7. Ask for confirmation, then Alma looks for existing publishers and solutions in DEV and creates the missing ones (skill `dataverse:dv-solution`),
   then `pac solution export` + `unpack` into `solution/<SolutionName>/` of each repository.
8. Create the work item "DECISION: Project setup $ARGUMENTS" with names, data and assumptions (`~/.claude/pp-kit/decision.md`).
9. First commit `chore: project setup <story ref>` (with `AI-Assisted:` and `Verified:` lines), only after the user
   has provided the ID of the setup story/issue. Alma prepares the export and release pipelines in a dedicated story.
10. Suggest the next step: `/project-plan <brief>` – Pia writes the project spec, architecture plan and initial backlog in `docs/project/`.
