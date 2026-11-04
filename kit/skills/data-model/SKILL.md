---
name: data-model
description: Design the Dataverse data model (Dora) and derive roles, table permissions and site settings from it (Sigi), with approval before creation.
argument-hint: [Story-ID] [description]
---
Context: $ARGUMENTS

1. Delegate to **dora-dataverse**: analysis of the existing schema and model proposal (Mermaid ER in `docs/data-model.md`, labels in the project languages, personal data, assumptions, rule IDs). No component is created yet.
2. Delegate to **sigi-security** with Dora's result: Dataverse role matrix, web roles, table permissions with scope, Web API site settings with explicit columns, risk assessment in `docs/security.md`.
<!-- gate: model-approval -->
3. Present both proposals; create "DECISION: Data model" and "DECISION: Roles and permissions" under the story (if given) and **wait for approval**.
4. After approval, delegate stating that the DECISIONS are Approved (with their IDs): Dora creates the components in the project solution, Sigi creates roles and permissions, Alma exports and unpacks the solution.
5. For lasting architectural decisions (e.g. references to master data instead of copies) write an ADR in `docs/adr/`.
