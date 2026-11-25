# Decisions for Laurent

These are the choices I made on your behalf overnight. Each one took the safer option and can be changed with a word.

**SharePoint or flow changes needed: none.** No lists or columns were added, renamed or removed. The flow contract, the built-in flow link and the passphrase step are exactly as they were.

## About the starting point

1. **The attached files were V41.26, not V41.27.** Their in-app version reads 41.26, and the V41.27 Settings change isn't in them. I redid that change and extended it to every list (item 8 below). If you have a V41.27 file with other changes in it, tell me what they were and I'll merge them in.

## Things that change what is stored (all listed in the audit report)

2. **One new row in the Settings list, `roster_meta`.** It holds how many pieces make up the Staff entry class list, and a short fingerprint of it.
   - It's a row, not a column.
   - Older copies ignore it.
   - Staff entry uses it to refuse a half-saved class list.
3. **Long staff subject lists gain two fields in their stored text:** `k` (the number of pieces) and `h` (a fingerprint).
   - This only affects staff whose subject list is too long for one row.
   - Older copies ignore both fields.
4. **On first open, V42.2 saves small repairs by itself.** This continues what V41.27 began. The repairs are:
   - the class list check
   - removing leftover pieces of long settings
   - copying any AAA pathway logged in Staff entry onto the Pupils list, which the SLT suite reads
   - the new fields on long staff records

   They go only if there are 300 changes or fewer. A bigger batch waits for you in the send panel.
5. **Duplicate items of one key are left in SharePoint.** If your lists ever lacked a unique key column, some items may be saved twice. The tracker now shows and saves the newest copy everywhere.
   - The older copies are only removed when you click **Remove the older copies** in Data checks.
   - Removing a key (clearing a level) removes every copy, so an old value can't come back.

## Behaviour choices

6. **Sign-offs and qualification units are merged just before sending.** When sign-offs on an existing pupil-and-framework item change, the tracker first reads what SharePoint holds. This costs **one extra flow run** on those saves, and it's why two people's ticks can't undo each other. Plain levels and results don't need it.
7. **Browser copies saved by V41.x are not sent automatically.** They hold the whole tracker, not a list of changes, so sending them could undo colleagues' work.
   - If one holds unsent work, V42.2 shows the SharePoint version and offers **Use this browser's copy instead**.
   - It asks first, and explains what that replaces.
   - This only matters once, on the first open after the update.
8. **The comparison a save makes is now against what SharePoint really holds.** Names copied onto results for reading in SharePoint (`PupilName`, `SubjectName` and the like), sort orders and the long JSON columns are left out of this check. So opening the tracker never queues a pile of cosmetic writes.
9. **Set-aside changes are tried again by themselves**, every few minutes, up to four times. After that they wait for **Try these again**. Before, they waited for that button straight away. From the tracker's side a passing flow error looks the same as a real refusal.
10. **Subjects that a qualification stands in for** (BTEC Science or Sport, catering) now take their status from the qualification on every page and report, as the Curriculum page already did.
    - Some percentages on Home, Core subjects and in reports will shift slightly for those pupils.
    - That's the intended V41.18 rule, now applied consistently.
11. **The Staff entry save chip** says **All saved · time of your last save**, instead of SLT's last save and name.
12. **Menus remember the last choice on each computer:** subject, class, framework and qualification. The data drop isn't remembered; it always opens on the latest. Staff entry opens on the page the teacher used last. Only the menu choice is kept, never pupil data.
13. **The tracker warns when it's open in two tabs** on the same computer, because the tabs share one browser copy of unsent work.
14. **Version number:** V42.2. Once any V42.2 copy saves, V41.x copies lock themselves, as before. **Replace both files together.**
15. **I removed the last traces of Google Sheets** from the code and messages:
    - an old error message
    - two "coming later" cards on the Data sources page
16. **Two qualifications for one subject (V42.1).** The subject is judged by the one the pupil is working on now, and that one gets the grade box on **Enter levels**. "Working on now" means:
    - still in progress (started, on track, at risk, entered); then enrolled but not started; then finished (achieved or not achieved)
    - within that, the one updated most recently
    - then the higher level

    So a pupil on Level 1 who is enrolled on Level 2 but hasn't started it stays on Level 1. Once Level 2 is updated, it takes over.
17. **Clearing the last sign-off on a pupil's framework (V42.1).** The tracker checks for a colleague's newer ticks before removing the row, and keeps them if it finds any.
18. **GCSE moved where you type it, not where it's kept (V42.2).**
    - GCSE grades stay in the CurriculumResults list, with the same keys as before. The Qualifications page reads and writes them there.
    - So there's nothing to copy, nothing to lose, and no second copy that could disagree.
    - Status against target, triangulation, reports, Data checks and exports all work as before.
    - Making GCSE a qualification in the Qualifications list instead would have meant copying every grade into QualResults and keeping two versions in step. I didn't do that.
19. **Which subjects appear as GCSE (V42.2).** A subject appears when someone takes it on GCSE grades at the chosen drop, and either:
    - it's ticked as a GCSE subject (Settings & data → Curriculum), or
    - it already has GCSE grades saved.

    To take a subject off the list, untick it there. Subjects like PSHE are left off unless they already have GCSE grades.
20. **Staff entry can't set GCSE targets (V42.2).** Teachers see the target and enter grade now and the exam result. This is the same as before.
21. **Which subjects show as GCSE on the pupil page (V42.2).** Only subjects where the pupil has a GCSE grade, target or exam result saved. Subjects where nothing is entered yet aren't listed, so the section doesn't fill up with empty rows.
22. **Where a moved pupil starts on the GCSE statements (V42.2).**
    - This applies until enough of the GCSE framework is signed off to suggest a grade.
    - Their latest grade now is used. If there isn't one, their exam result. If there isn't one of those either, the grade their last level points to.
    - The next steps are the key statements for the next grade up.
    - Once enough is signed off, the statements decide, as for everyone else.
23. **The drop export (V42.2):**
    - It's a CSV that opens in Excel, available in the SLT copy only. Staff entry keeps nothing on the computer, by design.
    - "Previous" is the pupil's most recent earlier result, even if they missed the drop just before.
    - Progress counts level steps (FLS steps count too) or whole GCSE grades.
    - With nothing earlier, progress is left blank rather than shown as "No change".
24. **Subjects without a GCSE page (V42.3).** For a subject that isn't ticked as GCSE and has no GCSE grades saved (PSHE, say), pupils in Years 10+ are entered as levels on **Enter levels**, the same as younger pupils. To give a subject a GCSE page, tick it as a GCSE subject in Settings & data → Curriculum.
25. **Tests use a made-up school only.** About 150 invented pupils, 20 staff and 15 subjects, with three years of drops and BTEC pupils. No real data was used or saved anywhere, including memory.

## If you'd prefer otherwise

Any of 4, 7, 9, 12 or 13 can be switched off in a later build if you'd rather.

**Going back to V41.26:** put the old files back, then change the **appBuild** row in the Settings list from `42.1` to `41.26` (see TESTING.md).
