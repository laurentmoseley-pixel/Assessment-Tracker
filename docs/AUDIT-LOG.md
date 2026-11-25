# Audit log (working notes, V41.26 → V42.0)

Started 24 Nov 2026 22:01. Attached files report APP_BUILD 41.26 (the brief mentions 41.27; the
41.27 Settings-baseline change is not in these files, so it is redone here for every list).
Both files differ in exactly the four expected places (checked with diff). Build reproduces both byte for byte.

## Read
- SharePoint layer: spRecords / spToState / spDiff / spWrite / spReadLists / gs(loadState, saveState), flowRun, passphrase.
- Local copy: IndexedDB, encryption, boot recovery (startLoad), autosave, retries, send panel, watcher, quiet reload.
- Staff entry: entryLimit, entryScope, entryRosterItems, staff settings chunking (stsub), roster chunking.
- Calculations: lvlValue/gcseValue, levelJudge, gcseJudge, subjStatus, qualForSubject/qualRowFor, ceStatus/ceQualStatus,
  summativeConflicts, data checks (qualityChecks), Enter levels (renderCurEntry, commitCurInput), Qualifications entry.

## Found (with test that shows it on 41.26)
1. Two copies of one key (CurKey/ResultKey not unique on a site): screen shows one copy, saves go to the other;
   an edit appears to vanish (levels) or silently never saves (summative results: first shown, last saved).
   Clearing a value leaves the older copy to come back. TEST duplicate items… FAILS on 41.26.
2. Changing a record's key (Data checks → "Make it GCSE grade now", merging drops) deletes the item first, then
   PATCHes the deleted item (found by Title) → refused → set aside → the result is lost from SharePoint.
   TEST changing a result's kind… FAILS on 41.26.
3. Batch failure → one-at-a-time resend of every request, including the ones that got through:
   additions refused as duplicates and shown as "set aside" though saved; lists without a unique key
   (PathwayLog where Title isn't unique) get duplicates. TEST lost answer… FAILS on 41.26 (8 set aside).
4. Updates send every field: SLT renaming a pupil re-sends every result of theirs with SLT's old values,
   undoing levels Staff entry saved meanwhile (Staff entry never touches the "last saved" stamp, so the
   conflict peek can't see it). TEST renaming… FAILS on 41.26 (7S became 6S).
5. Sign-offs are one item per pupil × framework (MarksJson): two people signing different statements for
   the same pupil → last writer wins, other's ticks lost. Two people starting a pupil's first sign-off at
   once → second refused (MarkKey unique) and set aside. TESTS FAIL on 41.26.
6. Browser copy recovery sends the WHOLE copy: after a closed tab / lost connection, reopening "sends what
   differs", which reverts colleagues' changes made since and can delete their new items (Staff entry
   saves don't move the stamp, so the "SharePoint saved since" guard doesn't trigger). TEST FAILS on 41.26.
7. One passing 5xx while opening drops into V28 "legacy mode": curriculum, AAA, qualifications not loaded.
   TEST FAILS on 41.26.
8. Baseline = what this copy would write (after migrate), not what SharePoint holds (41.27 fixed Settings only;
   not in these files). Leftover roster / staff-subject pieces never deleted; a pathway logged in Staff
   entry never reaches the Pupils list (SLT suite reads Pupils.Pathway).
9. Chunked values: leftover pieces of a longer staff subject list are joined onto a shorter one → old subjects
   come back → wrong Staff entry scope. Mixed pieces from a save stopped part-way read as a valid but wrong list.
10. Reads have no retry: one 429/5xx fails a load.
11. In-app "Download" buttons name files *_V41.html, breaking the links that rely on the V39 names.

## Fixed so far (stage 1, saved to outputs/V42.0)
- spDiff field-level changes; PATCH only changed fields. (4)
- Re-keyed items updated in place; deletes absorbed. (2)
- Probe after a failed batch (what got through), then one at a time; refused additions with the key already
  present become updates; answers carrying SharePoint errors are noticed. (3)
- Merge on write for MarksJson/ReasonsJson and QualResults UnitsDone; colleague's ticks kept; quiet reload after. (5)
- Newest item wins for duplicated keys everywhere; removing a key removes every copy. (1)
- Baseline from SharePoint values in every list (soft fields excluded); leftover pieces removed; repairs sent on open. (8)
- roster_meta {n,h} and staff record {k,h}: Staff entry only uses a whole, matching list. (9)
- Browser copy keeps its unsent changes (was/now); recovery lays only those on SharePoint's latest. (6)
- Legacy mode only on "list does not exist"; read-only flow calls retried twice. (7, 10)
- Download names. (11)
