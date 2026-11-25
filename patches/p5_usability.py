import sys; sys.path.insert(0, "/home/claude/work/patches")
from rp import rp
F = "d_app.js"

# ---------- remembered choices (this computer only; no pupil data) ----------
rp(F, '''function fillSelect(sel, items, value, blankLabel){''', '''/* V42: the class, subject and drop menus remember the last choice on this computer, so the
   half-termly routine opens where it was left (no pupil data is kept: only which menu option) */
const PICK_IDS = ["ceSubject","ceGroup","ceYear","ceMode","ceKind","fwFw","fwGroup","fwYear","qeQual","qeYear","qeGroup","entryAssessment","entryGroup","entryYear","cvSub","cvClass"];
function picks(){ try { return JSON.parse(localStorage.getItem(LS_NS + "picks") || "{}") || {}; } catch(e){ return {}; } }
function pickGet(k){ return picks()[k]; }
function pickSet(k, v){ try { const o = picks(); o[k] = v; localStorage.setItem(LS_NS + "picks", JSON.stringify(o)); } catch(e){} }
if(typeof document !== "undefined") document.addEventListener("change", function(e){ const t = e.target; if(t && t.id && PICK_IDS.indexOf(t.id) >= 0) pickSet(t.id, t.value); }, true);
function fillSelect(sel, items, value, blankLabel){
  if(value == null && sel && !sel.options.length && sel.id && PICK_IDS.indexOf(sel.id) >= 0){ const p = pickGet(sel.id); if(p != null) value = p; }''')
# the static menus (view, entering) take their remembered value once
rp(F, '''  const kSel = document.getElementById("ceKind");
  if(!kSel.options.length) kSel.innerHTML = Object.keys(CUR_KINDS).filter(function(k){ return !ENTRY_MODE || k !== "target"; }).map(function(k){ return '<option value="'+k+'">'+esc(CUR_KINDS[k])+'</option>'; }).join("");''',
'''  const kSel = document.getElementById("ceKind");
  if(!kSel.options.length){
    kSel.innerHTML = Object.keys(CUR_KINDS).filter(function(k){ return !ENTRY_MODE || k !== "target"; }).map(function(k){ return '<option value="'+k+'">'+esc(CUR_KINDS[k])+'</option>'; }).join("");
    const pk = pickGet("ceKind"); if(pk && Array.prototype.some.call(kSel.options, function(o){ return o.value === pk; })) kSel.value = pk;
    const pm = pickGet("ceMode"), mSel = document.getElementById("ceMode"); if(pm && mSel && Array.prototype.some.call(mSel.options, function(o){ return o.value === pm; })) mSel.value = pm;
  }''')
# Staff entry: the teacher's own subjects first, so the screen opens on their main class
rp(F, '''  const subs = (state.subjects||[]).filter(function(s){ return s.active; });
  const sSel = document.getElementById("ceSubject");
  fillSelect(sSel, subs.map(function(s){ return {v:s.id, l:s.name}; }));''', '''  const subs = (state.subjects||[]).filter(function(s){ return s.active; });
  if(ENTRY_MODE && entryMeRec){ const own = entryMeRec.subjects || []; subs.sort(function(a, b){ return (own.indexOf(a.id) < 0) - (own.indexOf(b.id) < 0); }); }
  const sSel = document.getElementById("ceSubject");
  fillSelect(sSel, subs.map(function(s){ return {v:s.id, l:s.name}; }));''')
# Staff entry: open on the page used last
rp(F, '''    lsSet(LS_SETUP, "1"); lsSet(LS_TOUR, "1");
    switchTab("curentry");
    return;''', '''    lsSet(LS_SETUP, "1"); lsSet(LS_TOUR, "1");
    const lt = lsGet(LS_NS + "lastTab");
    switchTab(lt && ENTRY_TABS.indexOf(lt) >= 0 ? lt : "curentry");     /* V42: where this teacher left off */
    return;''')
rp(F, '''function switchTab(name){
  if(ENTRY_MODE && ENTRY_TABS.indexOf(name) < 0) name = "classview";''', '''function switchTab(name){
  if(ENTRY_MODE && ENTRY_TABS.indexOf(name) < 0) name = "classview";
  if(ENTRY_MODE) try { lsSet(LS_NS + "lastTab", name); } catch(e){}''')

# ---------- Sign off: one button per strand ----------
rp(F, '''    if(s.strand !== lastStrand){ lastStrand = s.strand; if(s.strand) pre = '<tr class="fwstrand"><td colspan="' + (pupils.length + 2) + '">' + esc(s.strand) + '</td></tr>'; }''',
      '''    if(s.strand !== lastStrand){ lastStrand = s.strand; if(s.strand) pre = '<tr class="fwstrand"><td colspan="' + (pupils.length + 2) + '"><span class="fwstrandname">' + esc(s.strand) + '</span> <button class="btn ghost sm noprint" data-fwbulk-strand="' + esc(s.strand) + '" title="Sign off every statement in ' + esc(s.strand) + ' for the pupils shown">Sign off this strand</button></td></tr>'; }''')
rp(F, '''  const bp = e.target.closest("[data-fwbulk-p]"); if(bp){ fwBulkModal(bp.getAttribute("data-fwbulk-p")); return true; }''',
      '''  const bp = e.target.closest("[data-fwbulk-p]"); if(bp){ fwBulkModal(bp.getAttribute("data-fwbulk-p")); return true; }
  const bs = e.target.closest("[data-fwbulk-strand]"); if(bs){ fwBulkModal(null, bs.getAttribute("data-fwbulk-strand")); return true; }''')
rp(F, '''function fwBulkModal(onlyPid){''', '''function fwBulkModal(onlyPid, preStrand){''')
rp(F, '''    return pre + '<label class="chk" style="display:flex;gap:8px;align-items:flex-start;margin:3px 0"><input type="checkbox" data-bk-st="' + esc(s.id) + '" data-bk-strandof="' + esc(s.strand || "") + '"> <span>' ''',
      '''    return pre + '<label class="chk" style="display:flex;gap:8px;align-items:flex-start;margin:3px 0"><input type="checkbox" data-bk-st="' + esc(s.id) + '" data-bk-strandof="' + esc(s.strand || "") + '"' + (preStrand != null && (s.strand || "") === preStrand ? ' checked' : '') + '> <span>' ''')
rp(F, '''      sc.addEventListener("change", count);''', '''      sc.addEventListener("change", count);
      count();''')

# ---------- Qualifications: set everyone shown at once; keep focus after a change ----------
rp(F, '''  const prevDrop = (function(){ const all = orderedDataPoints(); const i = all.findIndex(function(d){ return d.id === dp.id; }); return i > 0 ? all[i - 1] : null; })();
  host.innerHTML = '<table class="qetable">''', '''  const prevDrop = (function(){ const all = orderedDataPoints(); const i = all.findIndex(function(d){ return d.id === dp.id; }); return i > 0 ? all[i - 1] : null; })();
  qeShown = on.map(function(p){ return p.id; });
  const bulk = on.length > 1 ? '<div class="row noprint qebulk" style="margin:0 0 8px;gap:8px;align-items:flex-end"><label class="fld">Set everyone shown (' + on.length + ') to<select id="qeBulkStatus"><option value="">Choose a status\\u2026</option>' +
      QUAL_STATUS.map(function(s){ return '<option value="' + s[0] + '">' + esc(s[1]) + '</option>'; }).join("") + '</select></label><button class="btn" data-act="qe-bulk">Apply</button>' +
      '<span class="hint" style="margin:0">at ' + esc(dp.name) + '; then change any one on its own</span></div>' : '';
  host.innerHTML = bulk + '<table class="qetable">''')
rp(F, '''let qeOpenGroups = {};      /* "pupil|module" -> open */''', '''let qeOpenGroups = {};      /* "pupil|module" -> open */
let qeShown = [];           /* the pupils on the page, for "Set everyone shown" */
function qeBulk(){
  const st = fieldVal("qeBulkStatus"), qid = fieldVal("qeQual"), dpid = fieldVal("qeDrop");
  const S = QUAL_STATUS_BY[st];
  if(!S || !qid || !dpid){ toast("Choose a status first.", ""); return; }
  const todo = qeShown.filter(function(pid){ const own = qualOwnAt(pid, qid, dpid); return !own || own.status !== st; });
  if(!todo.length){ toast("Everyone shown is already " + S.label + ".", ""); return; }
  const dp = byId(state.settings.dataPoints, dpid);
  if(!confirm("Set " + todo.length + " pupil" + (todo.length === 1 ? "" : "s") + " to " + S.label + " at " + (dp ? dp.name : "this drop") + "?")) return;
  let n = 0;
  todo.forEach(function(pid){ if(setQualResult(pid, qid, dpid, {status:st}) !== false) n++; });
  renderQualEntry();
  toast(n + " set to " + S.label + ". Saving now.", "ok");
}''')
rp(F, '''  else if(f === "note") setQualResult(pid, qid, dpid, {note:String(t.value).slice(0, 250)});
  renderQualEntry();
}''', '''  else if(f === "note") setQualResult(pid, qid, dpid, {note:String(t.value).slice(0, 250)});
  renderQualEntry();
  /* V42: back to the same box, so the keyboard carries on down the list */
  const again = document.querySelector('[data-qe="' + f + '"][data-qp="' + pid + '"]'); if(again) again.focus();
}''')
rp(F, '''function handleAction(act){''', '''function handleAction(act){
  if(act === "qe-bulk"){ qeBulk(); return; }''')

# ---------- Staff entry's save chip: about this person's work, not SLT's last save ----------
rp(F, '''  const el = document.getElementById("dirtyFlag");
  el.textContent = (state.meta.saved
    ? "Saved " + fmtDateTime(state.meta.saved) + (state.meta.savedBy ? " by " + state.meta.savedBy : "")
    : "Saved") + (lastSaveMs != null ? " \\u00B7 " + (lastSaveMs < 10000 ? (lastSaveMs/1000).toFixed(1) : Math.round(lastSaveMs/1000)) + "s" : "");''', '''  const el = document.getElementById("dirtyFlag");
  el.textContent = (ENTRY_MODE
    ? (entrySavedAt ? "All saved \\u00B7 " + entrySavedAt : "All saved")
    : (state.meta.saved
    ? "Saved " + fmtDateTime(state.meta.saved) + (state.meta.savedBy ? " by " + state.meta.savedBy : "")
    : "Saved")) + (lastSaveMs != null ? " \\u00B7 " + (lastSaveMs < 10000 ? (lastSaveMs/1000).toFixed(1) : Math.round(lastSaveMs/1000)) + "s" : "");''')
rp(F, '''let lastSaveMs = null;          /* how long the last save took, shown once in the header */''', '''let lastSaveMs = null;          /* how long the last save took, shown once in the header */
let entrySavedAt = "";          /* Staff entry: when this person's own work last reached SharePoint */''')
rp(F, '''      if(revision === at){ lastSaveMs = Date.now() - t0; markClean(); persistLocal(); }   /* nothing typed while it saved */''',
      '''      if(ENTRY_MODE) entrySavedAt = new Date().toLocaleTimeString("en-GB", {hour:"2-digit", minute:"2-digit"});
      if(revision === at){ lastSaveMs = Date.now() - t0; markClean(); persistLocal(); }   /* nothing typed while it saved */''')
print("p5 ok")
