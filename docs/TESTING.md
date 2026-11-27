# 12-minute check before staff use V42.4

You need:
- the SLT tracker on your laptop
- **Staff entry** on a second computer, or in a second browser profile on the same one
- the SLT and staff passphrases
- one teacher on the staff list (you can use yourself)

Every change below is small and you undo it at the end.

**Before you start:** copy the current `assessment_tracker_V39.html` and `assessment_tracker_staff_entry_V39.html` somewhere safe (for example a folder called `V41.26 backup`). That's your way back (see the end).

## 1. Put the files in place (1 minute)

1. Copy both new files into **SLT dashboards** and choose **Replace**. Do the same for the Staff entry file in its own folder.
2. Open the SLT tracker and enter the passphrase.
   - The menu should say **V42.4**.
3. Watch the save chip at the top.
   - It may say **Waiting to send…** for a few seconds the first time. That's the one-time repairs from V42.0 onwards.
   - It should then say **Saved**.
4. Click the chip.
   - **What's waiting to send** should say **Nothing is waiting**.

## 2. Data checks (1 minute)

1. Go to **Set up → Data checks** and scroll to the bottom.
2. Note what the three new sections say. All three should normally show **All clear**:
   - **Saved twice in SharePoint**
   - **Staff subject lists that couldn't be read whole**
   - **Changes waiting because SharePoint refused them**
3. If **Saved twice** lists anything, click **Remove the older copies**. The tracker already uses the newest copy, so nothing on screen changes.

## 3. Staff entry opens on the right class (2 minutes)

1. On the second computer, open Staff entry, enter the staff passphrase and choose the test teacher.
2. Check it opens on **Levels**, on that teacher's own subject, with their pupils.
3. Type a level for one pupil and press **Enter**.
   - The chip should say **All saved ·** followed by the time.
4. Type **FLS3** for another pupil and press **Enter**.
   - It should be accepted. FLS used to be cut off after three letters.

## 4. Two people at once (2 minutes)

1. Leave Staff entry open.
2. In the SLT tracker, open the pupil from step 3 and add an **x** to the end of their name.
3. Wait for **Saved**, then press **F5** to reload the SLT tracker.
   - The level the teacher typed should still be there.
   - The name should end in **x**.
4. On **Sign off**, sign off one statement for a pupil in Staff entry. In the SLT tracker, sign off a **different** statement for the **same pupil**.
5. Wait for both to say saved, then reload the SLT tracker.
   - Both sign-offs should be there.

## 5. A dropped connection (2 minutes)

1. In the SLT tracker, turn Wi-Fi off and change one level.
   - The chip should say **Not saved yet — retrying**.
2. Close the tab.
3. Turn Wi-Fi back on and open the tracker again.
   - A blue banner should say **This browser held 1 change… Sending it now**.
4. Check two things:
   - your level is there
   - the teacher's level from step 3 is still there

## 6. Qualifications and older copies (1 minute)

1. Go to **Enter data → Qualifications** and pick a BTEC with two or more pupils.
2. Check that **Set everyone shown to…** is there.
3. Choose a status, click **Apply**, then click **Cancel** on the question.
   - Nothing should change.
4. If a pupil is on two qualifications for one subject (for example BTEC Home Cooking Level 1 and Level 2), open **Enter levels** for that subject.
   - The grade box beside them should be for the one they're doing now.
   - Their pupil page should list both, in the Qualifications section.
5. If an old V41 copy is still about (for example in Downloads), open it.
   - It should show the red **This is an older copy** message and refuse to save.

## 7. GCSE, statements and the drop export (2 minutes)

1. In the SLT tracker, go to **Enter data → Qualifications** and choose **GCSE English** and the current drop.
   - The grades already entered should be there.
   - Check two or three pupils against what you'd expect. These grades haven't moved; they're just entered here now.
2. Type a grade now for one pupil and press **Enter**.
   - The status should update against their target.
3. Go to **Enter data → Levels**, choose English and Year 11.
   - There should be no GCSE boxes, and there should be a link to **enter their GCSE grades under Qualifications**.
   - Now choose PSHE (or another subject that isn't a GCSE) and Year 11. The pupils should be listed with level boxes.
4. Open a Year 10 or 11 pupil who did Key Stage 3 levels.
   - Their **Qualifications** section should list their GCSEs.
   - Under **Curriculum statements**, the subject should show their GCSE grade first, with Key Stage 3 marked *before GCSE*.
5. On **Enter levels**, click **Export *this drop* (every subject)** and open the file in Excel.
   - Check a few rows against the tracker.
   - BTEC pupils should say **On track**, **At risk** or similar.

## 8. Tidy up (1 minute)

Undo everything you changed:
- remove the **x** from the pupil's name
- clear the test levels (including FLS3), the level from step 5 and the GCSE grade from step 7
- clear both test sign-offs

Wait for **Saved**.

## If anything fails

Don't give V42.4 to staff. Send me the step number and a screenshot, including the chip and any message.

**Going back to V41.26:**

1. Put your backup files back in place.
2. Old copies lock once V42.4 has saved. To unlock them:
   1. In SharePoint, open the **Settings** list.
   2. Find the item whose SettingKey is **appBuild**.
   3. Change its SettingValue from `42.4` to `41.26` (or `42.3` to go back only one version).

V42.4 keeps all data in the same lists and columns, so earlier versions read everything V42.4 saved. In those versions, GCSE grades are back on Enter levels. It ignores the extra class-list check.
