# Audit report: Assessment Tracker and Staff entry, V41.26 → V42.2

## V42.2 addendum (25 November, afternoon)

These are new features Laurent asked for. Nothing in SharePoint changed: no lists or columns were added, renamed or removed, and no stored values changed. GCSE grades stay in CurriculumResults under the same keys. Data saved by V41.26 still loads and shows identically.

Seven new tests each fail on V42.1 and pass on V42.2:
- GCSE on the Qualifications page shows the grades already saved, for every pupil on GCSE grades in the subject and no others. Grade now, target and exam result save to the same CurriculumResults rows as before.
- Enter levels offers levels only, and points to the GCSE page with the same drop, year and group. *Include GCSE years for levels* still works.
- In Staff entry, teachers see GCSE for their own pupils and subjects only, can't set targets, and can't save outside their scope. **My classes** lands on the GCSE page.
- A pupil on BTEC Science shows its grade box on the GCSE Science page, and the grade saves to the BTEC.
- The pupil page lists GCSEs, but only for subjects with GCSE grades saved.
- Curriculum statements for a pupil who moved onto GCSE:
  - the GCSE framework is used before any sign-off
  - it starts from their grade now, with next steps from the next grade up
  - a G1–G9 ladder counts as GCSE
  - Key Stage 3 pupils are unchanged
  - with no GCSE framework, the grade is shown with the Key Stage 3 steps labelled
- The drop export has one row per pupil and subject. The level and progress for 100+ rows were checked against a calculation done separately from the app. BTEC rows give the status, and missing entries say so.

The full suite was rerun on V42.2:
- every check passes
- randomised fault runs (seeds 1, 41, 42, 44 labelled, 45 stopping at the first error) pass
- Chrome: no console errors and no axe failures, including the new GCSE pages, the pupil page and the export panel

Totals: 63 checks. V42.1 fails the 7 new ones, and V41.26 fails 27.

## V42.1 addendum (25 November, morning)

Three fixes, each with a regression test that fails on V41.26 and passes on V42.1:
- **Two qualifications standing in for one subject** (BTEC Home Cooking Level 1 and Level 2). The subject was judged by whichever was first on the list, and its grade box on Enter levels belonged to that one. So a pupil who finished Level 1 last year and is at risk on Level 2 showed **Ahead · Level 1 Merit**, and a grade typed this half-term was saved against Level 1. Now the one in progress and most recently updated is used (then the higher level). The test covers six combinations.
- **FLS couldn't be typed:** the level box had a three-character limit. It now takes FLS1–FLS10. Checked by typing in Chrome and confirming FLS10 reached SharePoint.
- **Clearing the last sign-off on a pupil's framework row** deleted the whole row, including a tick a colleague had added since. Found by a new randomised fault run (seed 41). The row is now checked first, and the colleague's ticks are kept.

The full suite was rerun on V42.1:
- every check passes
- randomised runs: seeds 1, 41–45, including out-of-order answers and a flow that stops at its first error
- Chrome: no console errors and no axe failures

The figures below include the V42.1 and V42.2 tests.

**Date:** night of 24–25 November 2026
**Scope:** both files, built from one source; every weak spot named in the brief.
**Method:** read the code; built a Node test harness with a fake SharePoint behind a fake TrackerAPI flow; fixed what was found; gave every fix a regression test; then a real-browser pass in Chrome and click counts.

## 1. Summary

The tracker's calculations were sound. Its saving and loading had real ways to lose or misplace data, mostly when two people worked at once, when a save failed part-way, or when a browser copy was recovered.

V41.26 fails 27 of the 63 checks below. V42.2 passes all 63, plus randomised fault runs and 60 real-browser page checks.

| Area | Checks | V41.26 | V42.2 |
|---|---|---|---|
| Saving and loading | 18 | 8 pass | 18 pass |
| Staff entry scope, class list, statuses, qualifications, FLS | 13 | 4 pass | 13 pass |
| Calculations (worked by hand) | 23 | 23 pass | 23 pass |
| Data checks | 2 | 1 pass | 2 pass |
| GCSE page, levels-only entry, pupil page, statements, drop export (V42.2) | 7 | 0 pass | 7 pass |
| Randomised fault runs (see 4.3) | 10 runs | fails or stalls | all pass |
| Same data on screen as V41.26 for data V41.26 saved | 15,988 levels | – | identical |
| Real browser: console errors / axe WCAG 2.2 AA failures | 60 page views | – | 0 / 0 |

Some V41.26 failures are checks of new safeguards, such as the class-list fingerprint. The data-loss ones are listed in 3.1.

## 2. What was checked

- **Files.** The two files differ only in the four expected lines. The build script now makes both from one source and refuses to build if anything else differs. It reproduces the original V41.26 files byte for byte.
- **Saving:**
  - batching (25 per call) and the one-at-a-time fallback
  - the set-aside list
  - unique Title, CurKey and other key clashes
  - removals before updates
  - retries and backoff, and the big-save guard
  - the conflict peek and the "last saved" stamps
  - two people saving at once
  - a batch that half-succeeds, a run stopped by the 2-minute limit, and a lost answer
  - closing the tab mid-save, and recovering the browser copy
- **Loading:**
  - parallel paged reads over 5,000 items, including gaps in item numbers
  - the 30-day list memory
  - "legacy mode"
  - the Staff entry class list in 240-character pieces: mixed, leftover and duplicate pieces
  - long staff subject lists in pieces
- **Scope.** Five teachers were checked against an independent calculation of their pupils and subjects:
  - teaching groups and year groups
  - individually added pupils
  - a teacher with every subject (list in pieces)
  - a pupil in a group of the wrong age
  - pupils listed twice
- **Calculations:**
  - levels against 0.8 a year (on track, behind, well behind, ahead, too early)
  - the typing shortcuts (`=`, `+`, `-`, `++`, `+3`)
  - GCSE against target
  - Year 10 switching to grades
  - qualification grades replacing levels in mixed GCSE/BTEC classes
  - status with no grade
  - triangulation only flagging when something went down
- **Data checks:** duplicates, odd teaching groups, orphans, early exam grades and "no result this year".
- **Screens** in Chrome at 1366×768 and 1920×1080, both files, every page:
  - Enter levels (list and grid)
  - Sign off, including bulk
  - Overview
  - pupil card
  - Qualifications
  - AAA
  - the send panel

  Each was checked for console errors, axe-core (WCAG 2.0–2.2 A/AA), keyboard focus and dark mode.

## 3. What was found and fixed

### 3.1 Data integrity (priority 1)

Each item shows the effect in V41.26, then the fix in V42.0. Every one has a test that fails on V41.26 and passes on V42.0, except item 14 (tested in Chrome) and item 13.

1. **SLT's unrelated edit undid a Staff entry level.**
   - **V41.26:** every update re-sent the whole item. Renaming a pupil re-sent all of their results with the values SLT had loaded hours before. In the test, a teacher's 7S became 6S. Staff entry never moves the "last saved" stamp, so the conflict peek couldn't see it.
   - **V42.0:** only the fields that changed are sent.
2. **Sign-offs lost when two people ticked the same pupil.**
   - **V41.26:** one SharePoint item holds all of a pupil's ticks for a framework. The second save replaced the first. Two people starting the same pupil at once: the second was refused and set aside.
   - **V42.0:** sign-offs (and qualification units) are merged with what SharePoint holds just before sending. A refused addition becomes an update.
3. **A failed batch caused duplicates and false "set aside" items.**
   - **V41.26:** after a lost answer or the 2-minute limit, the fallback re-sent every request, including ones that had got through. Additions came back refused (shown as set aside although saved). On a list without a unique key, they were duplicated.
   - **V42.0:** the tracker first asks SharePoint which requests got through, then sends the rest one at a time.
4. **Changing a result's kind or drop lost it.**
   - **V41.26:** "Make it GCSE grade now" (Data checks) or merging drops deleted the item, then tried to update the deleted item. It was refused, and the result was gone from SharePoint.
   - **V42.0:** the item is updated in place.
5. **Duplicate copies of one key.**
   - **V41.26:** the screen showed one copy while saves went to the other. Levels typed seemed to revert. Assessment results showed the edit but never saved it. Clearing a value let the old copy return.
   - **V42.0:**
     - the newest copy is used everywhere
     - removing a key removes every copy
     - a new Data check offers to remove older copies
6. **Recovering a closed tab undid colleagues' work.**
   - **V41.26:** the browser copy was the whole tracker. Reopening sent everything that differed from SharePoint, which reverts what others changed since and deletes items they added. In the test, a teacher's newer level was put back to the old one.
   - **V42.0:** the copy now keeps its own unsent changes (before and after values). Only those are laid on SharePoint's latest. This includes work typed while offline or while the tracker was still loading.
7. **One busy moment while opening dropped the curriculum.**
   - **V41.26:** any error on the first read fell back to "V28 legacy mode", opening without curriculum, AAA, frameworks and qualifications.
   - **V42.0:** that fallback only happens when a list really doesn't exist. Reads are retried twice.
8. **The save baseline wasn't what SharePoint held.**
   - **V41.26:** the comparison was against what this copy would write, so damaged class-list pieces and leftovers were never rewritten. V41.27 fixed Settings, but that fix isn't in the attached files.
   - **V42.0:** the baseline is SharePoint's actual values in every list. Cosmetic copied names, sort orders and JSON columns are excluded so opening doesn't queue noise. Repairs go on opening.
9. **Long staff subject lists picked up old subjects.**
   - **V41.26:** a leftover piece from a longer list was joined on, giving the teacher old subjects and a wider Staff entry scope. In the test: 33 subjects instead of 30.
   - **V42.0:** the record carries a piece count and fingerprint. Leftovers are removed. A mixed list is refused with a "try again in a minute" message.
10. **Half-saved class list read as a wrong one.**
    - **V41.26:** pieces from two saves could form valid but wrong data.
    - **V42.0:** `roster_meta` (count and fingerprint). Staff entry falls back to the Pupils list or asks to try again.
11. **Staff entry let teachers type what it would never save.**
    - **V41.26:** edits outside entryScope looked saved but were silently dropped. Separately, a level box could save to the drop chosen in the menu rather than the drop it was drawn for.
    - **V42.0:** such edits are refused at the box with a message. Boxes save to their own drop and kind.
12. **New lists waited up to 30 days.**
    - **V41.26:** a list group once remembered as missing was skipped for 30 days, even after Set up.
    - **V42.0:** read the careful way until every group exists.
13. **In-app downloads used `_V41.html` names**, which break the links. They now use the V39 names.
14. **Two tabs in one browser share one copy of unsent work.** There's now a warning.

### 3.2 Calculations and statuses (priority 2)

- **Hand-worked checks:**
  - levels at 0.8 a year, with a half-step margin
  - too early under 0.4 of a year
  - GCSE against target
  - the typing shortcuts
  - Year 10 switching to grades

  All 23 pass in both versions. No calculation bugs were found there.
- **Qualification grades replacing levels.** This was only applied on Curriculum and the profile. Home, Core subjects, pupil cards and concerns, reports and Flags used levels or GCSE for the same pupils, so one pupil could show two different statuses. `subjStatus` is now the single place, as its comment intended.
- **The grade rule for qualifications** is kept as agreed: down = well behind, same = on track, up = ahead. With fewer than two grades, the qualification status decides: at risk = behind. The entry-screen tag now matches the Curriculum page for a first grade (it showed green "on track" even for "at risk").
- **Triangulation** names the qualification grade for these pupils. A pupil is only flagged for "behind" when their grade went down or they are at risk, never on stale levels.
- **Data checks** no longer list a subject replaced by a qualification as "no result this year" or "lower than joining".
- **Defensive fix:** a level judged without a readable start point now shows "No baseline" instead of being able to fall through to "Well behind".

### 3.3 Usability (priority 3): click counts

Counted in Chrome, doing the routine for real and checking it reached SharePoint. A menu choice counts as 2 clicks.

| Routine | V41.26 | V42.0 first time | V42.0 next time |
|---|---|---|---|
| Half-term levels for one class (Staff entry, 34 pupils; typing is the same) | 2 clicks | 0 | 0 |
| Sign off a strand for a class | 4 | 3 | 2 (opens on Sign off) |
| BTEC status update for a class of 7 | 20 | 10 | 6 |

The save chip still shows **Waiting to send…**, then **Saved** or **All saved**. Unsaved boxes keep their orange edge. Nothing about saving is hidden.

### 3.4 Speed (priority 4)

Opening the same 16,000-level site takes about half a second in both versions (458–577 ms across runs). Working out what changed takes 42–44 ms in V41.26 and 35–37 ms in V42.0. Both were measured in the test harness, excluding the flow's own time. A quick open is still 2 flow runs for lists over 5,000 items.

Saves that update existing sign-offs or units cost one extra flow run, for the merge.

### 3.5 Look (priority 5)

An additive CSS layer:
- a two-tone focus ring on every control, including the box being typed in
- one spacing and type scale
- tabular numbers
- faint stripes on long class lists
- styles for the new strand and bulk controls

axe-core: 0 violations across 60 page views at both sizes, after fixing one accessible-name mismatch on the chart **PNG** buttons. Keyboard focus is visible on every control tried. Dark mode was checked.

## 4. Test harness and results

### 4.1 The fake SharePoint and flow

The fake models:
- lists and items
- `$select`, `$filter`, `$orderby` and `$top`
- 5,000-item pages with `odata.nextLink`
- the list-view threshold on unindexed filters
- unique Title and key columns, case-insensitive as SharePoint is
- DateOnly fields returned as UK midnight in UTC
- empty text stored as null

The fake flow:
- checks the passphrase
- runs every call, as Apply to each carries on after a failed iteration (also tested stopping at the first error)
- answers in order, or labelled `{i,b}` in any order as with concurrency on
- answers 502 if any call failed

Faults can be injected:
- before running
- after running (answer lost)
- part-way (2-minute limit)
- dropped connection

### 4.2 The made-up school

- 150 invented pupils in Years 3–13
- 20 staff, one with every subject
- 15 subjects and 14 drops across three school years (one window open now)
- 15,988 levels and grades, 810 assessment results
- BTEC Science, BTEC Sport and a catering award in mixed GCSE/BTEC Year 10–11 classes
- two curriculum frameworks with sign-offs
- AAA logs, individually added pupils, and a pupil in a group of the wrong age

### 4.3 Randomised fault runs

Two people (SLT and a teacher) make random edits for 20–25 rounds:
- levels and clears
- results
- sign-offs
- renames
- AAA logs
- key changes

About a third of flow runs fail at random, and the SLT tab is closed and reopened part-way 1–7 times per run.

Afterwards, a fresh open must show exactly what each person last had on screen, with no duplicates in any key column and nothing set aside. V42.0 passed every seed run:
- seeds 1–9 and 11–14 during the night
- seeds 1–4, 21–24 and 31–32 in the final runs
- answers in order, labelled out of order, and the flow stopping at its first error

V41.26 failed or stalled on both seeds tried.

### 4.4 Running the tests

The harness is in `source-and-tests.zip` (made-up data only). Unzip it, then:
1. `npm install jsdom@24 fake-indexeddb@6 playwright-core axe-core`
2. `node build.js out/current` and `node build.js out/baseline-41.26 src/parts-41.26` (the tests seed data as V41.26 saved it)
3. `cd harness && ./run_all.sh`

## 5. Left as they are, and risks

- **Same box, same time:** if two people change the very same box, the last save wins. That's the usual rule, now limited to the box itself.
- **SLT copies don't see Staff entry saves until they reload.** Staff entry never writes the "last saved" stamp (it can't write Settings), and SLT's minute-by-minute check only sees SLT saves. Field-level saving means an SLT copy no longer overwrites what it didn't change. To see staff entries, reload or wait for the next SLT save from elsewhere.
- **Staff entry keeps nothing in the browser,** by design, for data protection. Closing it with unsent work loses that work. The browser asks "Leave site?" first, and work normally saves within a second or two.
- **Data damaged before V42.0 can't always be put right automatically.** If a V41 save once joined a leftover piece onto a staff subject list and saved it back, the extra subjects are now part of the list. Check long subject lists once in **Settings & data → Staff**.
- **Older browser copies** (saved by V41.x) holding unsent work are offered, not sent (see Decisions 7).
- **Power Apps edition:** code paths are shared, and the record-number filters use `ID` there, but it wasn't run against a real Power Apps connector tonight.
- **The fake flow is a model.** What the real TrackerAPI returns when one request fails (502 and an error, or a 200 carrying the error) is handled both ways, but the 10-minute check in TESTING.md is the real proof.

## 6. Files

- `assessment_tracker_V39.html`, `assessment_tracker_staff_entry_V39.html`: V42.2, built from one source.
- `CHANGELOG.md`, `TESTING.md`, `DECISIONS-FOR-LAURENT.md`, this report.
- `source-and-tests.zip`: the source parts, `build.js`, the test harness, the made-up school and the patch scripts that turned V41.26 into V42.2.
