---
name: review
description: Quality gate with Kuno - automated checks, parallel review by perspective (security, standards compliance, data protection, code quality) and verification of Critical/High findings.
argument-hint: [Story-ID]
---
Review of the changes against the main branch (`git diff origin/main...HEAD` + uncommitted changes). Story: $ARGUMENTS
Output folder: `docs/stories/$ARGUMENTS/reviews/` (without a story: `docs/reviews/<date>/`).

## Step 1 – Automated checks
Delegate to **kuno-quality** with perspective `automated`. Save the result in `reviews/automated.md`.
If the build or the Solution Checker fail with blocking errors, stop here and report.

## Step 2 – Review by perspective (in parallel)
Start **at the same time** four **kuno-quality** instances, one per perspective: `security`, `standards`, `data-protection`, `code-quality`.
Pass each one the diff, the story ID and the automated result. Save each result in `reviews/<perspective>.md`.

## Step 3 – Verification of serious findings
For **every** Critical or High finding start one **kuno-quality** instance in `verify` mode with that finding only.
REJECTED findings are downgraded to "To discuss" with the reason.

## Step 4 – Outcome
- Consolidated table (Severity | Location | Rule | Recommendation | Verification) in `reviews/outcome.md`.
- Gate PASSED only if no CONFIRMED Critical or High finding remains.
- If PASSED: write date/time and `git rev-parse HEAD` into `.claude/state/review.ok`.
- Every proposed deviation → "DECISION: Deviation <rule ID>".
