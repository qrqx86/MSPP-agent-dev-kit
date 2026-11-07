---
name: review
description: Quality gate with Kuno at the end of the sprint - a single review (automated checks and perspectives security, standards compliance, data protection, code quality) and verification of Critical/High findings; full parallel mode for large diffs, security or releases.
argument-hint: [Story-ID | sprint]
---
Review of the changes against the base branch (`git diff $(git merge-base HEAD origin/HEAD)` – fallback `origin/main` or `origin/master` – plus uncommitted changes). Story: $ARGUMENTS
Output folder: `docs/stories/$ARGUMENTS/reviews/` (without a story: `docs/reviews/<date>/`).

## Modes
- **Sprint (default):** a single **kuno-quality** instance in `sprint` mode on the sprint diff (automated checks and all perspectives). Save in `reviews/outcome.md`. For each Critical/High finding: fix, then one instance in `verify` mode (`model: sonnet`). Go to Step 4.
- **Full (Steps 1–4):** only if the diff exceeds ~2,000 lines, touches roles/permissions or precedes a release to TEST/PROD.

## Step 1 – Automated checks
Delegate to **kuno-quality** with perspective `automated` and `model: haiku` (deterministic checks). Save the result in `reviews/automated.md`.
If the build or the Solution Checker fail with blocking errors, stop here and report.

## Step 2 – Review by perspective (in parallel)
Start **at the same time** four **kuno-quality** instances, one per perspective: `security`, `standards`, `data-protection`, `code-quality`.
Pass each one the diff, the story ID and the automated result. Save each result in `reviews/<perspective>.md`.

## Step 3 – Verification of serious findings
For **every** Critical or High finding start one **kuno-quality** instance in `verify` mode (`model: sonnet`) with that finding only.
REJECTED findings are downgraded to "To discuss" with the reason.

## Step 4 – Outcome
- A "No findings" result of a perspective is checked with one targeted look at the diff before accepting it.
- Consolidated table (Severity | Location | Rule | Recommendation | Verification) in `reviews/outcome.md`.
- Gate PASSED only if no CONFIRMED Critical or High finding remains.
- If PASSED, the main session runs `node ~/.claude/hooks/pp-kit/state.cjs review` (records the reviewed state of the code;
  committing it afterwards does not make it stale).
- Every proposed deviation → "DECISION: Deviation <rule ID>".
