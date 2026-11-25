import sys; sys.path.insert(0, "/home/claude/work/patches")
from rp import rp
F = "d_app.js"

# ---------- 1. subjects that aren't GCSE subjects (PSHE and the like) in Years 10+ ----------
# V42.2 sent these pupils to a GCSE page that doesn't exist for the subject, so the link and the
# My classes card landed on another subject's GCSE page, and Enter levels showed nobody.
rp(F, '''function gcseEntryItems(dp){
  if(!dp || !state) return [];
  const ay = acYearOf(dp.date) || currentAY(), withData = {};
  (state.curResults || []).forEach(function(r){ if((r.kind === "predicted" || r.kind === "actual" || r.kind === "target") && r.value !== "" && r.value != null) withData[r.subjectId] = true; });
  const out = (state.subjects || []).filter(function(su){
    if(!su.active || !(isGcseSubject(su) || withData[su.id])) return false;''', '''/* the subjects with a GCSE page on Qualifications: ticked as GCSE subjects, or already holding GCSE
   grades. Other subjects (PSHE and the like) keep their Year 10+ pupils on Enter levels. */
function gcsePageSubjects(){
  const out = {};
  (state.curResults || []).forEach(function(r){ if((r.kind === "predicted" || r.kind === "actual" || r.kind === "target") && r.value !== "" && r.value != null) out[r.subjectId] = true; });
  (state.subjects || []).forEach(function(su){ if(isGcseSubject(su)) out[su.id] = true; });
  return out;
}
function gcseEntryItems(dp){
  if(!dp || !state) return [];
  const ay = acYearOf(dp.date) || currentAY(), gPage = gcsePageSubjects();
  const out = (state.subjects || []).filter(function(su){
    if(!su.active || !gPage[su.id]) return false;''')
rp(F, '''  const fits = function(p, s){ return mayEnter(p, s) && takesSubject(p, s, ay) && (kind!=="level" ? usesGcse(p, ay, s.id) : (!usesGcse(p, ay, s.id) || allYrs)); };''',
      '''  const gPage = gcsePageSubjects();       /* V42.2 review: a subject with no GCSE page keeps everyone on levels */
  const fits = function(p, s){ return mayEnter(p, s) && takesSubject(p, s, ay) && (kind!=="level" ? usesGcse(p, ay, s.id) : (!usesGcse(p, ay, s.id) || allYrs || !gPage[s.id])); };''')
rp(F, '''    return (!ySel.value || String(p.year)===ySel.value) && (!gSel.value || p.group===gSel.value) && (grid ? subs : [su]).some(function(s){ return mayEnter(p, s) && takesSubject(p, s, ay) && usesGcse(p, ay, s.id); });''',
      '''    return (!ySel.value || String(p.year)===ySel.value) && (!gSel.value || p.group===gSel.value) && (grid ? subs : [su]).some(function(s){ return gPage[s.id] && mayEnter(p, s) && takesSubject(p, s, ay) && usesGcse(p, ay, s.id); });''')
rp(F, '''  if(spec.k && spec.k !== "level"){ gcseGo(spec.s, spec.d, spec.y, spec.g); return; }      /* V42.2 */''',
      '''  if(spec.k && spec.k !== "level" && gcsePageSubjects()[spec.s]){ gcseGo(spec.s, spec.d, spec.y, spec.g); return; }      /* V42.2: GCSE classes open their GCSE page; other subjects stay on levels */''')

# ---------- 2. Enter / arrow keys skip a row that has no level box (a pupil on a BTEC) ----------
rp(F, '''function ceMove(el, dr, dc){
  const r = parseInt(el.getAttribute("data-row"),10) + dr, c = parseInt(el.getAttribute("data-col"),10) + dc;
  const nx = ((el.closest && el.closest("#ceTable, #qeTable")) || document.getElementById("ceTable")).querySelector('.lvlin[data-row="'+r+'"][data-col="'+c+'"]');
  if(nx){ nx.focus(); nx.select(); }
}''', '''function ceMove(el, dr, dc){
  const host = (el.closest && el.closest("#ceTable, #qeTable")) || document.getElementById("ceTable");
  let r = parseInt(el.getAttribute("data-row"),10) + dr;
  const c = parseInt(el.getAttribute("data-col"),10) + dc, last = host.querySelectorAll("tr").length;
  /* V42.2 review: carry on past a row with no box here (a pupil whose BTEC grade is entered instead) */
  for(; r >= 0 && r <= last; r += dr){
    const nx = host.querySelector('.lvlin[data-row="'+r+'"][data-col="'+c+'"]');
    if(nx){ nx.focus(); nx.select(); return; }
    if(!dr) return;
  }
}''')

# ---------- 3. the drop export is SLT only, by design: Staff entry keeps nothing on the computer ----------
rp(F, '''function exportDropCsv(dpId){
  const dp = byId(state.settings.dataPoints, dpId);''', '''function exportDropCsv(dpId){
  if(ENTRY_MODE) return;
  const dp = byId(state.settings.dataPoints, dpId);''')
rp(F, 'const APP_BUILD = "42.2";', 'const APP_BUILD = "42.3";')
rp(F, """/* ===== CHANGELOG =====
   V42.2""", """/* ===== CHANGELOG =====
   V42.3 (code review of V42.1-V42.2)
   - Subjects that aren't GCSE subjects (PSHE and the like) keep Year 10+ pupils on Enter levels,
     and their My classes cards and links no longer open another subject's GCSE page.
   - Enter and the arrow keys move past a pupil whose BTEC grade is entered instead of a level.
   - The drop export can't run in Staff entry.
   V42.2""")
print("p10 ok")
