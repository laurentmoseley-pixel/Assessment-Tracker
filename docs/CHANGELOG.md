# Assessment Tracker and Staff entry: V42.2

## V42.2 (25 November 2026)

- **GCSE grades are entered under Enter data → Qualifications.** Each GCSE subject is listed as GCSE English, GCSE Maths and so on, along with **GCSE – all subjects at once** for a whole class.
  - Each pupil has a grade now, a target and an exam result, all U to 9.
  - Status against target shows as you type, the same as before.
  - A pupil on a BTEC or another course that stands in for the subject shows its grade box instead.
- **Nothing to add and nothing moved.** The GCSE list comes from your subjects, and it shows the grades already saved, including imports from Evidence for Learning. No grade was copied, changed or deleted, and every other page reads them exactly as before.
- **Enter levels is for levels only** (FLS1–FLS10, 1E–9S). When pupils on GCSE grades are in the list you picked, a link takes you to their GCSE page, on the same drop, year and group. *Include GCSE years for levels* still works as before. **My classes** cards for GCSE classes now open the GCSE page.
- **Pupil pages list their GCSEs in the Qualifications section**, alongside BTECs. Each one shows the grades now at recent drops, the target, the exam result when there is one, and the status.
- **Curriculum statements for pupils who've moved from Key Stage 3 levels onto GCSE:**
  - The subject's GCSE framework is used even before anything is signed off in it.
  - Until enough is signed off there, the pupil page shows their grade now and the next steps from the next grade up.
  - If a subject has no GCSE framework, the page shows the grade with the Key Stage 3 next steps underneath, labelled as such.
  - A framework whose levels all count as GCSE grades (G1–G9) is treated as a GCSE framework, whatever its name.
- **Export for one data drop** (SLT only), from **Import & export** or the button on **Enter levels**. It has one row per pupil and subject, giving:
  - the level or GCSE grade at that drop
  - the previous result and when it was
  - the progress since then: Up 2 steps, No change, Down 1 grade, and so on
  - the status
  - for pupils on a BTEC or similar, where they are: On track, At risk, Achieved and so on

  Missing entries say **Not entered**.

## V42.1 (25 November 2026)

- **Pupils on two qualifications in one subject** (for example BTEC Home Cooking Level 1 and Level 2) are judged by the one they are working on now, and that one's grade box shows on **Enter levels**. Before, the first qualification on the list always won. A Level 1 finished last year could stand in for the Level 2 the pupil is doing now, and this half-term's grade went against Level 1. Both qualifications still have their own rows in the pupil page's Qualifications section.
- **FLS levels can be typed in the level box** (FLS1 to FLS10). The box stopped at three characters, so FLS couldn't be typed. `F3` still works as a shortcut for FLS3.
- **Clearing the last sign-off on a pupil's framework** no longer removes a tick a colleague added meanwhile.

## V42.0

**Date:** 25 November 2026
**Files:** `assessment_tracker_V39.html` (SLT) and `assessment_tracker_staff_entry_V39.html` (staff). The file names are unchanged, so existing links still work. The menu shows **V42.2**.

This release is about **trust in the data**. Most of the changes are invisible. They make sure that what staff type is what SharePoint keeps, even when the connection is poor, two people work at once, or a tab is closed part-way through a save.

## What changes for staff

- **Your levels can't be undone by someone else's unrelated edit.** Before, if SLT renamed a pupil while you were entering levels, SLT's save could put back that pupil's old levels. Now only the part that changed is sent.
- **Sign-offs are never lost when two people tick at once.** If you and a colleague sign off different statements for the same pupil, both are kept. Before, the second save wiped the first.
- **You can only change what you're allowed to change.** If a box isn't one of your pupils and subjects in an open window, the tracker says so straight away and leaves it unchanged. Before, it looked saved but never reached SharePoint.
- **The save chip shows your own work.** It says **All saved** with the time of your last save. Before, it showed SLT's last save.
- **Fewer clicks:**
  - Staff entry opens on your own subject and on the page you used last.
  - The menus remember your class and subject.
  - Each strand on **Sign off** has a **Sign off this strand** button.
  - **Qualifications** has **Set everyone shown to…**, so a whole BTEC class can be updated in one go.
- **The class list can't be read half-saved.** If SLT's save is still part-way through, Staff entry asks you to try again in a minute. Before, it could show pupils in the wrong class.

## What changes for SLT

- **A closed tab or dropped connection no longer risks colleagues' work.** Your unsent changes are kept in this browser as a list of changes. When you reopen the tracker, only those changes are sent, on top of the latest from SharePoint. Before, the whole browser copy was sent, which could undo or delete what staff had entered since.
- **Saves that fail part-way finish cleanly.** The tracker checks what reached SharePoint before trying again. That means no duplicates, and nothing wrongly listed as "set aside".
- **"Make it GCSE grade now"** (Data checks) and similar changes no longer lose the result.
- **A brief busy moment while opening** no longer opens the tracker without its curriculum, qualification and AAA lists.
- **Lists set up on another computer** appear straight away (no 30-day wait).
- **BTEC and other qualifications that replace a subject's level** now decide that subject's status everywhere: Home, Core subjects, the pupil card, reports and Flags. Before, they only did on the Curriculum page and the profile. Data checks no longer list those subjects as "no result this year".
- **New Data checks:**
  - **Saved twice in SharePoint**, with a button to remove the older copies.
  - **Staff subject lists that couldn't be read whole**, with a link to check them.
  - **Changes waiting because SharePoint refused them.**
- **A warning if the tracker is open in two tabs** on the same computer.
- **Download buttons** inside the tracker now use the V39 file names.

## The first time V42.0 opens

V42.0 makes a few small repairs by itself, then saves them:
- it adds a check to the Staff entry class list
- it removes leftover pieces of long settings
- it copies any pathway logged in Staff entry onto the Pupils list

Once any V42.0 copy has saved, older copies (V41.x) lock themselves, as they did before. Replace **both** files together.

## Looks

A light tidy:
- clearer focus rings, including on the box you're typing in
- steadier spacing
- faint row stripes on long class lists
- a clearer warning colour on the save chip when work is waiting

The colours and layout are otherwise unchanged. Dark mode and high-contrast mode still work.
