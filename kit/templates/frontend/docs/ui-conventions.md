# UI conventions – <app>

They apply to every page of the Code App / SPA. The developer reads them before every new page, Kuno uses them in the review
(code quality perspective). They change with a DECISION, not page by page.

## Page structure
- A single **"Refresh"** command, in the app header (`refreshAll`): no refresh button in single pages or grids.
- Page title, then command bar, then filters, then content. Primary actions on the left of the bar, secondary ones in the "More" menu.

## Buttons and texts
- Buttons with a Fluent icon and a text; **no symbols in the text** ("+ New" → icon `Add` and text "New").
- Labels with a verb ("Save", "Delete"), Sentence case, all from the resource files.
- An empty-list message in every grid: what is missing and, if any, the action that creates it.

## Grids and filters
- Standard filters of every grid with process data: **state** (by category), **assignee**, **text search**. Other filters only if the plan asks for them.
- Paging or incremental loading beyond <N> rows; declared default sort order.
- Domain fields (profiles, types, states): coded lists, not free text, unless the plan decides otherwise.

## Dialogs and confirmations
- One modal layer at a time: close the first dialog before opening a second one (otherwise `aria-hidden` stays on the page).
- Confirmation only for irreversible actions (delete, submit); the confirmation text names the object ("Delete system "X"?").
- Multi-step saves: the main row returns id and `modifiedon` even if a later step fails; the retry updates, it does not duplicate.

## Accessibility and languages
- WCAG 2.1 AA: every control with an accessible name, visible focus, no information by color only.
- Languages with namespaces per page (`src/i18n/namespaces.ts`); no fixed texts in components.

## After the push to DEV
Message to the product owner with "reload the app page" and 3–4 points to try in 5–10 minutes.
