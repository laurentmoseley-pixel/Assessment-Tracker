# Code review: V42.1 and V42.2 → V42.3

**Date:** 25 November 2026
**Scope:** everything changed since the overnight audit:
- V42.1: two qualifications in one subject, FLS in the level box, merging sign-offs on delete
- V42.2: GCSE on the Qualifications page, levels-only Enter levels, the pupil page, statements for pupils who moved onto GCSE, the drop export
- the build script and the web version's build

**Method:** each suspicion was checked by running the app, not by reading the code alone. Every confirmed problem has a fix and a test that fails on V42.2 and passes on V42.3. Most of this code was written in the same chat as this review, so a second opinion before staff use is still worthwhile.

## Fixed in V42.3

| # | Severity | What happened | Fix |
|---|---|---|---|
| 1 | Medium (new in V42.2) | For a subject that isn't a GCSE subject, such as PSHE, Year 10+ pupils had nowhere to be entered. **Enter levels** listed nobody. The "enter their GCSE grades" link and the teacher's **My classes** card opened another subject's GCSE page: in the test, PSHE opened **GCSE Art**. | A subject without a GCSE page (not ticked as GCSE, and no GCSE grades saved) keeps its Year 10+ pupils on Enter levels. Links and cards only go to GCSE when the subject has a GCSE page. |
| 2 | Low (also on Enter levels before V42.2) | **Enter** and the arrow keys stopped on the row above a pupil whose BTEC grade is entered instead of a level, because that row has no level box. | The cursor carries on to the next row that has a box, in the same column. |
| 3 | Low (safeguard) | The drop export could in principle be started from Staff entry: its button is hidden there, but the code didn't refuse. Staff entry keeps nothing on the computer by design. | The export does nothing in Staff entry. |

## Checked and found sound

- **Two qualifications in one subject.** The ranking compares in progress, then most recently updated, then higher level, in that order. It's covered by six cases.
- **Clearing the last sign-off.** The merge before deleting held up under the randomised fault runs, including out-of-order answers and a flow that stops at its first error.
- **Entry boxes on two pages.** Saving, paste from Excel, "fill from the previous drop" and the statements suggestion each work on the page they're on. A target or exam result box doesn't overwrite the grade-now status.
- **GCSE storage.** Grades still go to the same CurriculumResults rows, with the same keys. Data saved by V41.26 still loads identically.
- **The flow link.** It isn't in the source or the web copies. The web build refuses to finish if anything like a link gets in. A release build with the link added is checked against the delivered files.
- **The web version's first open.** It only chooses SharePoint when nothing has been chosen on that computer, and a later choice is kept.

## Left as they are

- **Export of an older drop:**
  - It uses each pupil's **current** teaching group, not the one they were in then.
  - Pupils who have since left aren't included. The export works from the current pupil list.
- **Very old GCSE data.** A Year 10+ pupil whose GCSE grades were saved as levels shows "Not entered" in the export. **Data checks → Make it GCSE grade now** puts these right.
- **Shared browser storage.** The web version shares its web address, and so its browser storage, with the Timetable Builder site. That's fine while only Laurent can change either site.
- **Building the files needs Node.js** on the computer that runs the build. The tracker files themselves need nothing installed.

## Tests

Three new tests were added, one per fix (tests_gcse.js, "review: …"). All three fail on V42.2 and pass on V42.3.

The full suite was rerun on V42.3:
- saving and loading
- Staff entry scope
- calculations
- data checks
- GCSE
- compatibility with V41.26 data
- randomised fault runs
- the Chrome pass
