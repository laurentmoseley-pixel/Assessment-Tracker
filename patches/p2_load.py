import sys; sys.path.insert(0, "/home/claude/work/patches")
from rp import rp
F = "d_app.js"

# ---------- one record per key, the newest, everywhere ----------
rp(F, '''/* the lists, as SharePoint sends them, turned into a tracker */
function spToState(env){
  const val = function(list){ return Array.isArray(env[list]) ? env[list] : []; };''', '''/* V42: one record per key. When a list holds two items for the same key (a list whose key column
   was never made unique), the newest is kept everywhere: on screen, in reports and when saving,
   because it is the one a save updates. Before, the screen could show one copy while saves went
   to the other, so an edit seemed to vanish. */
function lastPerKey(arr, keyFn){
  const last = new Map();
  arr.forEach(function(x, i){ last.set(keyFn(x), i); });
  if(last.size === arr.length) return arr;
  return arr.filter(function(x, i){ return last.get(keyFn(x)) === i; });
}
/* the lists, as SharePoint sends them, turned into a tracker */
function spToState(env){
  const val = function(list){ return Array.isArray(env[list]) ? spById(env[list]) : []; };''')
rp(F, '''  const pupils = val("pupils").filter(function(p){ return p.IsActive!==false; }).map(mapPupil);
  const leavers = val("pupils").filter(function(p){ return p.IsActive===false; }).map(mapPupil);''', '''  const pupils = lastPerKey(val("pupils").filter(function(p){ return p.IsActive!==false; }).map(mapPupil), function(p){ return p.id; });
  const leavers = lastPerKey(val("pupils").filter(function(p){ return p.IsActive===false; }).map(mapPupil), function(p){ return p.id; });''')
rp(F, '''  const results = val("results").filter(function(r){ return keep[r.PupilId]; }).map(function(r){
    const o = {id:r.Title, pupilId:r.PupilId, assessmentId:r.AssessmentId, dataPointId:r.DataDropId, value:spText(r.ResultValue)};
    const c = parseCtx(r.ContextJson); if(c) o.ctx = c;
    return o;
  });''', '''  const results = lastPerKey(val("results").filter(function(r){ return keep[r.PupilId]; }).map(function(r){
    const o = {id:r.Title, pupilId:r.PupilId, assessmentId:r.AssessmentId, dataPointId:r.DataDropId, value:spText(r.ResultValue)};
    const c = parseCtx(r.ContextJson); if(c) o.ctx = c;
    return o;
  }), function(r){ return r.pupilId + "_" + r.assessmentId + "_" + r.dataPointId; });''')
rp(F, '''  const curResults = val("curresults").filter(function(r){ return keep[r.PupilId]; }).map(function(r){
    const o = {id:r.Title, pupilId:r.PupilId, subjectId:r.SubjectId, dataPointId:spText(r.DataDropId), kind:spText(r.Kind), value:spText(r.CurValue)};
    const c = parseCtx(r.ContextJson); if(c) o.ctx = c;
    return o;
  });
  const baselines = val("baselines").filter(function(b){ return keep[b.PupilId]; }).map(function(b){
    return {id:b.Title, pupilId:b.PupilId, subjectId:b.SubjectId, value:spText(b.BaseValue), date:spDateIn(b.BaseDate), source:spText(b.Source)};
  });''', '''  const curResults = lastPerKey(val("curresults").filter(function(r){ return keep[r.PupilId]; }).map(function(r){
    const o = {id:r.Title, pupilId:r.PupilId, subjectId:r.SubjectId, dataPointId:spText(r.DataDropId), kind:spText(r.Kind), value:spText(r.CurValue)};
    const c = parseCtx(r.ContextJson); if(c) o.ctx = c;
    return o;
  }), function(r){ return curKey(r.pupilId, r.subjectId, r.dataPointId, r.kind); });
  const baselines = lastPerKey(val("baselines").filter(function(b){ return keep[b.PupilId]; }).map(function(b){
    return {id:b.Title, pupilId:b.PupilId, subjectId:b.SubjectId, value:spText(b.BaseValue), date:spDateIn(b.BaseDate), source:spText(b.Source)};
  }), function(b){ return b.pupilId + "_" + b.subjectId; });''')
rp(F, '''  const qualResultsIn = val("qualresults").filter(function(r){ return keep[r.PupilId]; }).map(function(r){
    return {id:r.Title, pupilId:r.PupilId, qualId:spText(r.QualId), dataPointId:spText(r.DataDropId), status:spText(r.QualStatus),
            units:String(r.UnitsDone || "").split(",").map(function(x){ return x.trim(); }).filter(Boolean), grade:spText(r.QualGrade),
            cert:spBool(r.Certificate), due:spDateIn(r.DueDate), note:spText(r.QualNote)};
  });''', '''  const qualResultsIn = lastPerKey(val("qualresults").filter(function(r){ return keep[r.PupilId]; }).map(function(r){
    return {id:r.Title, pupilId:r.PupilId, qualId:spText(r.QualId), dataPointId:spText(r.DataDropId), status:spText(r.QualStatus),
            units:String(r.UnitsDone || "").split(",").map(function(x){ return x.trim(); }).filter(Boolean), grade:spText(r.QualGrade),
            cert:spBool(r.Certificate), due:spDateIn(r.DueDate), note:spText(r.QualNote)};
  }), function(r){ return qualKey(r.pupilId, r.qualId, r.dataPointId); });''')
rp(F, '''  const fwIn = fwRecordsIn(val("fwrows"), val("fwmarks"), keep);''', '''  const fwIn = fwRecordsIn(val("fwrows"), val("fwmarks"), keep);
  fwIn.fwMarks = lastPerKey(fwIn.fwMarks, function(r){ return r.pupilId + "~" + r.fwId; });''')
# settings: the newest item for a Title wins (they arrive in item order now)
# migrate: the same rule for a backup file or this browser's copy
rp(F, '''    if(r.ctx) o.ctx = r.ctx;
    return o;
  }).filter(function(r){ return r.pupilId && r.assessmentId && r.dataPointId; });''', '''    if(r.ctx) o.ctx = r.ctx;
    return o;
  }).filter(function(r){ return r.pupilId && r.assessmentId && r.dataPointId; });
  st.results = lastPerKey(st.results, function(r){ return r.pupilId + "_" + r.assessmentId + "_" + r.dataPointId; });''')
rp(F, '''    if(r.kind === "gcse"){ const g = /^([0-9])\\s*([EDS])?$/i.exec(o.value); if(g){ const n = +g[1], b = (g[2] || "S").toUpperCase(); o.value = n === 0 ? "U" : (b === "S" ? String(n) : (n - 1 >= 1 ? String(n - 1) : "U")); } }
    if(r.ctx) o.ctx = r.ctx;
    return o;
  });''', '''    if(r.kind === "gcse"){ const g = /^([0-9])\\s*([EDS])?$/i.exec(o.value); if(g){ const n = +g[1], b = (g[2] || "S").toUpperCase(); o.value = n === 0 ? "U" : (b === "S" ? String(n) : (n - 1 >= 1 ? String(n - 1) : "U")); } }
    if(r.ctx) o.ctx = r.ctx;
    return o;
  });
  st.curResults = lastPerKey(st.curResults, function(r){ return curKey(r.pupilId, r.subjectId, r.dataPointId, r.kind); });''')
rp(F, '''  fwMigrate(obj, st);
  st.quals =''', '''  st.baselines = lastPerKey(st.baselines, function(b){ return b.pupilId + "_" + b.subjectId; });
  fwMigrate(obj, st);
  st.fwMarks = lastPerKey(st.fwMarks, function(r){ return r.pupilId + "~" + r.fwId; });
  st.quals =''')
rp(F, '''            grade:str(r.grade), cert:!!r.cert, due:isoish(r.due), note:str(r.note)};
  });
  st.staff =''', '''            grade:str(r.grade), cert:!!r.cert, due:isoish(r.due), note:str(r.note)};
  });
  st.qualResults = lastPerKey(st.qualResults, function(r){ return qualKey(r.pupilId, r.qualId, r.dataPointId); });
  st.staff =''')
rp(F, '''    return {id:sid(s.id), name:str(s.name), initials:str(s.initials), subjects:(Array.isArray(s.subjects) ? s.subjects : []).map(sid),
            years:str(s.years), groups:str(s.groups), role:str(s.role) === "slt" ? "slt" : "teacher", email:str(s.email).trim()};
  });''', '''    const o = {id:sid(s.id), name:str(s.name), initials:str(s.initials), subjects:(Array.isArray(s.subjects) ? s.subjects : []).map(sid),
            years:str(s.years), groups:str(s.groups), role:str(s.role) === "slt" ? "slt" : "teacher", email:str(s.email).trim()};
    if(s.damaged) o.damaged = true;
    return o;
  });''')
rp(F, '''  st.pupils = (obj.pupils||[]).map(normalisePupil);
  st.leavers = (obj.leavers||[]).map(normalisePupil);''', '''  st.pupils = lastPerKey((obj.pupils||[]).map(normalisePupil), function(p){ return p.id; });
  st.leavers = lastPerKey((obj.leavers||[]).map(normalisePupil), function(p){ return p.id; });''')

# the screen, and the setters, use the same record a save sends (the last one)
rp(F, '''    state.results.forEach(function(r){ const k = r.pupilId + "|" + r.assessmentId + "|" + r.dataPointId; if(!map.has(k)) map.set(k, r); });''',
      '''    state.results.forEach(function(r){ map.set(r.pupilId + "|" + r.assessmentId + "|" + r.dataPointId, r); });   /* the last one, as a save sends */''')
rp(F, '''  if(existing){
    if(v===""){ state.results = state.results.filter(function(r){ return r!==existing; }); }''', '''  if(existing){
    if(v===""){ state.results = state.results.filter(function(r){ return !(r.pupilId===pupilId && r.assessmentId===assessmentId && r.dataPointId===dataPointId); }); }''')
rp(F, '''  const i = (state.curResults || []).findIndex(function(r){ return curKey(r.pupilId, r.subjectId, r.dataPointId, r.kind)===key; });
  if(!undoing){''', '''  let i = -1;
  (state.curResults || []).forEach(function(r, j){ if(curKey(r.pupilId, r.subjectId, r.dataPointId, r.kind)===key) i = j; });   /* the last one, as a save sends */
  if(!undoing){''')
rp(F, '''  if(i >= 0){
    if(v===""){ state.curResults.splice(i, 1); }''', '''  if(i >= 0){
    if(v===""){ state.curResults = state.curResults.filter(function(r){ return curKey(r.pupilId, r.subjectId, r.dataPointId, r.kind)!==key; }); }''')

# ---------- chunked settings: a count and a check for the class list and long subject lists ----------
rp(F, '''/* long settings (the logo) are split across rows, because a SharePoint setting holds 255 characters */
function chunkSetting(out, key, value){''', '''/* V42: a short fingerprint, so a reader can tell a whole value from one put together from pieces
   of two different saves (a save stopped part-way) or with pieces left over from a longer one */
function fnv32(s){ s = String(s || ""); let h = 0x811c9dc5; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return ("0000000" + h.toString(16)).slice(-8); }
function chunkCount(v){ return Math.ceil(String(v || "").length / 240); }
/* the first n pieces, if they are all there and match the fingerprint; else null */
function unchunkChecked(set, key, n, h){
  const parts = [];
  for(let i = 0; i < n; i++){ const v = set[key + "_" + String(i).padStart(3, "0")]; if(v == null) return null; parts.push(String(v)); }
  const s = parts.join("");
  return (!h || fnv32(s) === h) ? s : null;
}
/* long settings (the logo) are split across rows, because a SharePoint setting holds 255 characters */
function chunkSetting(out, key, value){''')
rp(F, '''  if(windowsUsed(st) || (st.frameworks || []).length || st.pupils.some(function(p){ return p.pathway; }) || (st.pathwayLogs || []).length) chunkSetting(out.Settings, "roster", JSON.stringify(st.pupils.map(function(p){ return [p.id, p.name || "", p.year == null ? "" : p.year, p.group || "", p.startDate || "", p.pathway || ""]; })));''',
'''  if(windowsUsed(st) || (st.frameworks || []).length || st.pupils.some(function(p){ return p.pathway; }) || (st.pathwayLogs || []).length){
    const roster = JSON.stringify(st.pupils.map(function(p){ return [p.id, p.name || "", p.year == null ? "" : p.year, p.group || "", p.startDate || "", p.pathway || ""]; }));
    chunkSetting(out.Settings, "roster", roster);
    /* V42: how many pieces make the list, and its fingerprint, so Staff entry never reads a half-saved list */
    out.Settings.roster_meta = {Title:"roster_meta", SettingValue:JSON.stringify({n:chunkCount(roster), h:fnv32(roster)})};
  }''')
rp(F, '''  (st.staff||[]).forEach(function(s){ const k = "staff_" + s.id; out.Settings[k] = {Title:k, SettingValue:staffToSetting(s, out.Settings)}; });''',
      '''  /* a member of staff whose stored subject list couldn't be read whole is left as SharePoint has it until someone edits them */
  (st.staff||[]).forEach(function(s){ if(s.damaged) return; const k = "staff_" + s.id; out.Settings[k] = {Title:k, SettingValue:staffToSetting(s, out.Settings)}; });''')
rp(F, '''  const rec = function(sv){ return JSON.stringify({n:s.name||"", i:s.initials||"", s:sv, y:s.years||"", g:s.groups||"", r:s.role==="slt" ? "s" : "t", e:s.email||""}); };
  let v = rec(subs);
  if(v.length > 255){ v = rec("@"); if(outSettings) chunkSetting(outSettings, "stsub_" + s.id, subs); }''', '''  const rec = function(sv, extra){ return JSON.stringify(Object.assign({n:s.name||"", i:s.initials||"", s:sv, y:s.years||"", g:s.groups||"", r:s.role==="slt" ? "s" : "t", e:s.email||""}, extra || {})); };
  let v = rec(subs);
  /* V42: k = how many pieces, h = fingerprint (older copies ignore both) */
  if(v.length > 255){ v = rec("@", {k:chunkCount(subs), h:fnv32(subs)}); if(outSettings) chunkSetting(outSettings, "stsub_" + s.id, subs); }''')
rp(F, '''  const sid = key.replace(/^staff_/,"");
  if(o.s === "@") o.s = set ? unchunkSetting(set, "stsub_" + sid) : "";
  return {id:sid, name:o.n||"", initials:o.i||"", subjects:String(o.s||"").split("|").filter(Boolean).map(function(x){ return /^su_/.test(x) ? x : "su_"+x; }),
          years:o.y||"", groups:o.g||"", role:o.r==="s" ? "slt" : "teacher", email:o.e||""};''', '''  const sid = key.replace(/^staff_/,"");
  let damaged = false;
  if(o.s === "@"){
    if(set && +o.k > 0){
      const whole = unchunkChecked(set, "stsub_" + sid, +o.k, o.h);
      if(whole != null) o.s = whole;
      else { damaged = true; o.s = ENTRY_MODE ? "" : (unchunkChecked(set, "stsub_" + sid, +o.k, "") || unchunkSetting(set, "stsub_" + sid)); }
    } else o.s = set ? unchunkSetting(set, "stsub_" + sid) : "";
  }
  const out = {id:sid, name:o.n||"", initials:o.i||"", subjects:String(o.s||"").split("|").filter(Boolean).map(function(x){ return /^su_/.test(x) ? x : "su_"+x; }),
          years:o.y||"", groups:o.g||"", role:o.r==="s" ? "slt" : "teacher", email:o.e||""};
  if(damaged) out.damaged = true;
  return out;''')
# Staff entry reads the class list with its count and fingerprint
rp(F, '''function entryRosterItems(settingsRows){
  const set = {};
  (settingsRows || []).forEach(function(r){ set[r.Title] = r.SettingValue; });
  let rows = [];
  /* the class list is saved in 240-character pieces; if a piece is left over from an older, longer list
     the whole thing won't read, so try again without the pieces at the end */
  const parts = Object.keys(set).filter(function(k){ return k.indexOf("roster_") === 0 && /_\\d{3}$/.test(k); }).sort();
  entryRosterState = parts.length ? "broken" : "missing";
  for(let n = parts.length; n > 0; n--){
    try { const v = JSON.parse(parts.slice(0, n).map(function(k){ return set[k]; }).join("")); if(Array.isArray(v)){ rows = v; entryRosterState = n === parts.length ? "ok" : "trimmed"; break; } } catch(e){}
  }''', '''function entryRosterItems(settingsRows){
  const set = {};
  spById(settingsRows).forEach(function(r){ set[r.Title] = r.SettingValue; });
  let rows = [];
  let meta = null; try { meta = set.roster_meta ? JSON.parse(set.roster_meta) : null; } catch(e){ meta = null; }
  if(meta && +meta.n > 0){
    /* V42: exactly the pieces the last save wrote, checked against its fingerprint. Pieces from two
       different saves (one stopped part-way) never make a class list: wait for the next save instead */
    const whole = unchunkChecked(set, "roster", +meta.n, meta.h);
    let v = null; try { v = whole != null ? JSON.parse(whole) : null; } catch(e){ v = null; }
    if(Array.isArray(v)){ rows = v; entryRosterState = "ok"; }
    else entryRosterState = "updating";
  } else {
  /* the class list is saved in 240-character pieces; if a piece is left over from an older, longer list
     the whole thing won't read, so try again without the pieces at the end */
  const parts = Object.keys(set).filter(function(k){ return k.indexOf("roster_") === 0 && /_\\d{3}$/.test(k); }).sort();
  entryRosterState = parts.length ? "broken" : "missing";
  for(let n = parts.length; n > 0; n--){
    try { const v = JSON.parse(parts.slice(0, n).map(function(k){ return set[k]; }).join("")); if(Array.isArray(v)){ rows = v; entryRosterState = n === parts.length ? "ok" : "trimmed"; break; } } catch(e){}
  }
  }''')
rp(F, '''  if(!state.pupils.length) return (entryRosterState === "broken" || entryRosterState === "missing")
    ? "The class list couldn\\u2019t be read" + (entryRosterState === "broken" ? " (it looks damaged)" : "") + ". SLT: open the main tracker, change anything small and press Save; that writes it again. Then reopen this page."''',
'''  if(entryMeRec.damaged) return "Your subject list is being updated in SharePoint right now, so your classes can\\u2019t be shown safely. Close this page and open it again in a minute. If this keeps happening, ask SLT to open the main tracker and press Save.";
  if(!state.pupils.length) return entryRosterState === "updating"
    ? "The class list is being updated in SharePoint right now. Close this page and open it again in a minute. If this keeps happening, ask SLT to open the main tracker and press Save."
    : (entryRosterState === "broken" || entryRosterState === "missing")
    ? "The class list couldn\\u2019t be read" + (entryRosterState === "broken" ? " (it looks damaged)" : "") + ". SLT: open the main tracker, change anything small and press Save; that writes it again. Then reopen this page."''')

# ---------- the baseline is what SharePoint really holds, in every list ----------
rp(F, '''      const ids = spIdsFrom(lists);
      let baseline = spForSite(spRecords(migrate(st)));
      if(ENTRY_MODE) baseline = entryScope(baseline);
      Object.keys(baseline).forEach(function(n){
        Object.keys(baseline[n]).forEach(function(k){ if(!ids[n][k]) delete baseline[n][k]; });
      });''', '''      const ids = spIdsFrom(lists);
      let rec = spForSite(spRecords(migrate(st)));
      if(ENTRY_MODE) rec = entryScope(rec);
      const baseline = spTrueBaseline(lists, rec, ids);''')
rp(F, '''function adoptLoaded(r){
  spBaseline = r ? r.baseline : null;
  spIds = r ? r.ids : null;
  spIdsStale = false;
}''', '''function adoptLoaded(r){
  spBaseline = r ? r.baseline : null;
  spIds = r ? r.ids : null;
  spIdsStale = false;
  spBaselineLocal = false;
  /* V42 (after V41.27): when SharePoint holds something other than what this copy shows for its own
     settings (the class list and long subject lists Staff entry reads, a pathway logged in Staff
     entry), send the repair straight away instead of waiting for the next edit */
  if(r && !ENTRY_MODE) setTimeout(function(){
    if(dirty || autoInFlight || !sheetReady || spBaseline !== r.baseline) return;
    const ops = sendPending();
    if(Array.isArray(ops) && ops.length && ops.length <= BIG_SAVE && ops.some(spRepairOp)){ spRepairing = true; markDirty(); }
  }, 1500);
}
let spRepairing = false;
function spRepairOp(o){ return (o.list === "Settings" && /^(roster|stsub_.+|schLogo|schMkNames)_\\d{3}$|^roster_meta$|^staff_/.test(o.key)) || (o.list === "Pupils" && o.changed && "Pathway" in o.changed); }
/* V42: the baseline a save compares against is what SharePoint really holds, field by field, in every
   list (V41.27 did this for Settings). Where loading changed a value on the way in (a pathway from a
   Staff entry log, a class list saved part-way), the difference shows as a change and is sent.
   Names copied onto results for reading in SharePoint, sort orders and long JSON columns are left
   out of this, so opening the tracker never queues a pile of cosmetic writes. */
const SP_SOFT = {Results:["PupilName","AssessmentName","DropName","AcademicYear","ContextJson"], CurriculumResults:["PupilName","SubjectName","AcademicYear","ContextJson"],
  PathwayLog:["PupilName"], QualResults:["PupilName","QualName","AcademicYear"], StatementMarks:["PupilName","FwName","MarksJson","ReasonsJson"],
  Assessments:["SortOrder","ConfigJson"], Subjects:["SortOrder"], Qualifications:["SortOrder","UnitsJson"], Frameworks:["StatementsJson","FwName","LevelOrder"], DataDrops:["AcademicYear"]};
let spTypeCache = {};
function spFieldType(list, f){
  if(f === "Title") return "text";
  let m = spTypeCache[list];
  if(!m){ m = spTypeCache[list] = {}; ((SP_SCHEMA[list] || {}).fields || []).forEach(function(x){ m[x[0]] = x[1]; m[spIn(x[0])] = x[1]; }); }
  return m[f] || "text";
}
function spNormFor(list, f, v){
  const t = spFieldType(list, f);
  if(t === "num") return spNum(v);
  if(t === "bool1") return !(v === false || /^(false|no|0)$/i.test(String(v)));
  if(t === "bool0") return spBool(v);
  if(t === "date") return spDateIn(v);
  return v == null ? "" : String(v);
}
function spTrueBaseline(lists, rec, ids){
  const out = {};
  Object.keys(rec).forEach(function(n){
    out[n] = {};
    const byId = new Map(); (lists[n] || []).forEach(function(it){ byId.set(it.Id, it); });
    const soft = SP_SOFT[n] || [];
    Object.keys(rec[n]).forEach(function(k){
      const id = ids[n] && ids[n][k]; if(id == null) return;
      const r = rec[n][k], it = byId.get(id);
      if(!it){ out[n][k] = r; return; }
      let b = r;
      Object.keys(r).forEach(function(f){
        if(soft.indexOf(f) >= 0 || !(f in it)) return;
        if(spNormFor(n, f, it[f]) !== spNormFor(n, f, r[f])){ if(b === r) b = Object.assign({}, r); b[f] = it[f] == null ? null : it[f]; }
      });
      out[n][k] = b;
    });
  });
  /* pieces of a long setting left over from an older, longer value: removed with the next save */
  if(out.Settings && rec.Settings && lists.Settings && !ENTRY_MODE){
    const fam = function(k){ const m = /^(roster|stsub_.+|schLogo|schMkNames)_(\\d{3})$/.exec(k || ""); return m ? m[1] : null; };
    const have = {};
    Object.keys(rec.Settings).forEach(function(k){ const f = fam(k); if(f) have[f] = true; if(k.indexOf("staff_") === 0) have["stsub_" + k.slice(6)] = true; });
    lists.Settings.forEach(function(it){
      const k = it.Title, f = fam(k);
      if(!f || !have[f] || rec.Settings[k] || out.Settings[k] || ids.Settings[k] == null) return;
      out.Settings[k] = {Title:k, SettingValue:it.SettingValue == null ? "" : String(it.SettingValue)};
    });
  }
  return out;
}''')

# ---------- this browser's copy keeps its own unsent changes, not just the whole tracker ----------
rp(F, '''function localWriteNow(){
  clearTimeout(localWriteTimer); localWriteTimer = null;
  if(ENTRY_MODE) return;              /* staff entry: nothing is kept in the browser */
  if(!localMirror) return;
  const rec = {touched: localMirror.touched, dirty: localMirror.dirty, state: localMirror.state};''', '''/* V42: the changes not yet in SharePoint, each with what it was and what it is now. Kept with this
   browser's copy, so after a closed tab or a lost connection only these are sent, on top of whatever
   SharePoint holds by then. (Before, the whole copy was sent, which could undo colleagues' work.) */
function pendingForLocal(){
  try {
    if(!spBaseline || isLocalSource() || ENTRY_MODE) return null;
    const cur = spForSite(spRecords(state));
    return spDiff(spBaseline, cur).map(function(o){ return {list:o.list, op:o.op, key:o.key, now:o.op === "delete" ? null : o.fields, was:(spBaseline[o.list] || {})[o.key] || null}; });
  } catch(e){ return null; }
}
/* a baseline put back together from this browser's copy and its unsent changes (when SharePoint can't be reached) */
function baselineFromPending(cur, pending){
  const b = {};
  Object.keys(cur).forEach(function(n){ b[n] = Object.assign({}, cur[n]); });
  (pending || []).forEach(function(o){ if(!b[o.list]) b[o.list] = {}; if(o.was) b[o.list][o.key] = o.was; else delete b[o.list][o.key]; });
  return b;
}
/* the lists as SharePoint holds them now, with this browser's unsent changes laid on top, as a tracker */
function rebaseLocal(pending){
  const lists = {};
  SP_LISTS.forEach(function(n){ lists[n] = ((spLastLists && spLastLists[n]) || []).map(function(x){ return Object.assign({}, x); }); });
  let fake = 1e9;
  (pending || []).forEach(function(o){
    const arr = lists[o.list] || (lists[o.list] = []), col = SP_MATCH[o.list];
    const at = []; arr.forEach(function(it, i){ if(it[col] === o.key) at.push(i); });
    if(o.op === "delete"){ for(let i = at.length - 1; i >= 0; i--) arr.splice(at[i], 1); return; }
    if(!o.now) return;
    const it = at.length ? arr[at[at.length - 1]] : null;
    if(!it){ arr.push(Object.assign({Id:fake++}, o.now)); return; }
    Object.keys(o.now).forEach(function(f){
      const m = SP_MERGE[o.list] && SP_MERGE[o.list][f];
      if(m){ it[f] = spMergeValue(m, it[f], o.was ? o.was[f] : null, o.now[f]); return; }
      if(!o.was || !spSame(o.was[f], o.now[f])) it[f] = o.now[f];
    });
  });
  const env = {}; SP_LISTS.forEach(function(n){ env[SP_FEED[n]] = lists[n] || []; });
  const st = spToState(env);
  pathwaysFromStaff(st);
  return migrate(st);
}
function localWriteNow(){
  clearTimeout(localWriteTimer); localWriteTimer = null;
  if(ENTRY_MODE) return;              /* staff entry: nothing is kept in the browser */
  if(!localMirror) return;
  let pend = localMirror.dirty ? pendingForLocal() : [];
  if(pend == null && localMirror.dirty) pend = localMirror.pending || null;     /* not connected yet: keep what was there */
  localMirror.pending = pend;
  const rec = {touched: localMirror.touched, dirty: localMirror.dirty, state: localMirror.state, pending: pend, v:2};''')
rp(F, '''function persistLocal(){
  localTouched = new Date().toISOString();
  localMirror = {touched: localTouched, dirty: dirty, state: state};''', '''function persistLocal(){
  localTouched = new Date().toISOString();
  localMirror = {touched: localTouched, dirty: dirty, state: state, pending: localMirror ? localMirror.pending : null};''')
rp(F, '''        localTouched = rec.touched || null;
        localMirror = {state: migrate(rec.state), dirty: !!rec.dirty, touched: rec.touched || null};
        lockedCopy = null;''', '''        localTouched = rec.touched || null;
        localMirror = {state: migrate(rec.state), dirty: !!rec.dirty, touched: rec.touched || null, pending: Array.isArray(rec.pending) ? rec.pending : null};
        lockedCopy = null;''')
rp(F, '''    if(raw && raw.state){
      localTouched = raw.touched || null;
      localMirror = {state: migrate(raw.state), dirty: !!raw.dirty, touched: raw.touched || null};
    }''', '''    if(raw && raw.state){
      localTouched = raw.touched || null;
      localMirror = {state: migrate(raw.state), dirty: !!raw.dirty, touched: raw.touched || null, pending: Array.isArray(raw.pending) ? raw.pending : null};
    }''')
# boot: show this browser's copy while loading; typing then is tracked as changes
rp(F, '''  if(local && local.state){
    /* show the copy kept in this browser straight away; nothing is saved
       until the latest has arrived from SharePoint */
    state = local.state;
    dirty = !!local.dirty;
    finishBoot();''', '''  if(local && local.state){
    /* show the copy kept in this browser straight away; nothing is saved
       until the latest has arrived from SharePoint */
    state = local.state;
    dirty = !!local.dirty;
    /* V42: anything typed before SharePoint answers is kept as changes (not when an older copy holds
       unsent work it can't tell apart, which is offered below instead) */
    if(!local.dirty || Array.isArray(local.pending)){ try { spBaseline = baselineFromPending(spForSite(spRecords(state)), local.pending); spBaselineLocal = true; } catch(e){} }
    finishBoot();''')
rp(F, '''      const sheetSaved = fromSheet.meta.saved ? Date.parse(fromSheet.meta.saved) : 0;
      const touched = local && local.touched ? Date.parse(local.touched) : 0;
      if(local && local.dirty && local.state && touched > sheetSaved){
        /* Work typed here that never reached SharePoint. Only the differences
           are sent, so it goes straight away rather than waiting for a click. */
        state = local.state;
        dirty = true;''', '''      const sheetSaved = fromSheet.meta.saved ? Date.parse(fromSheet.meta.saved) : 0;
      const touched = local && local.touched ? Date.parse(local.touched) : 0;
      const ownOps = local && local.dirty && Array.isArray(local.pending) ? local.pending : null;
      if(ownOps && !ownOps.length){ dirty = false; }
      else if(ownOps && touched > sheetSaved){
        /* V42: work typed here that never reached SharePoint. Only those changes are laid on top of
           what SharePoint holds now and sent, so a colleague's work since is kept. */
        state = rebaseLocal(ownOps);
        dirty = true;
        banner("info",
          '<div>This browser held '+ownOps.length+' change'+(ownOps.length===1?'':'s')+' from <strong>'+esc(fmtDateTime(local.touched))+
          '</strong> that had not reached SharePoint. Sending '+(ownOps.length===1?'it':'them')+' now, on top of the latest from SharePoint.</div>'+
          '<div class="spacer"></div>'+
          '<button class="btn ghost sm" data-act="use-sheet-version">Use the SharePoint version instead</button>'+
          '<button class="btn ghost sm" data-act="dismiss-banner">Dismiss</button>');
        setTimeout(function(){ if(dirty && autoSaves()) flushAutoSave(); }, 300);
      } else if(ownOps){
        /* our unsent changes are older than somebody else's save: show theirs, offer ours */
        bootLocalOps = ownOps;
        dirty = false;
        banner("warn2",
          '<div>This browser also holds '+ownOps.length+' change'+(ownOps.length===1?'':'s')+' from <strong>'+esc(fmtDateTime(local.touched))+
          '</strong> that never reached SharePoint, but SharePoint has been saved since'+
          (fromSheet.meta.savedBy?' by '+esc(fromSheet.meta.savedBy):'')+
          '. The SharePoint version is on screen.</div>'+
          '<div class="spacer"></div>'+
          '<button class="btn ghost sm" data-act="use-local-version">Send this browser\\u2019s changes too</button>'+
          '<button class="btn ghost sm" data-act="dismiss-banner">Keep the SharePoint version</button>');
      } else if(local && local.dirty && local.state && touched > sheetSaved){
        /* A copy from an older version: it holds the whole tracker, not its changes, so sending it
           could undo colleagues' work since. Show SharePoint's version and offer this one. */
        bootLocal = local.state;
        dirty = false;
        banner("warn2",
          '<div>This browser holds work from <strong>'+esc(fmtDateTime(local.touched))+
          '</strong> that may not have reached SharePoint (saved by an older version of the tracker). The SharePoint version is on screen.</div>'+
          '<div class="spacer"></div>'+
          '<button class="btn ghost sm" data-act="use-local-version">Use this browser\\u2019s copy instead</button>'+
          '<button class="btn ghost sm" data-act="dismiss-banner">Keep the SharePoint version</button>');
      } else if(false){
        state = local.state;
        dirty = true;''')
rp(F, '''      } else if(local && local.dirty && local.state){
        /* our unsent work is older than somebody else's save: show theirs, offer ours */
        bootLocal = local.state;''', '''      } else if(local && local.dirty && local.state){
        /* our unsent work is older than somebody else's save: show theirs, offer ours */
        bootLocal = local.state;
        dirty = false;''')
rp(F, '''    /* could not reach SharePoint: carry on with this browser's copy, and say so */
    sheetReady = false;
    state = (local && local.state) || starterState();
    dirty = !!(local && local.dirty);''', '''    /* could not reach SharePoint: carry on with this browser's copy, and say so */
    sheetReady = false;
    state = (local && local.state) || starterState();
    dirty = !!(local && local.dirty);
    /* V42: keep tracking changes against the copy, so nothing typed now is lost or confused with colleagues' work */
    if(local && local.state && (!local.dirty || Array.isArray(local.pending))){ try { spBaseline = baselineFromPending(spForSite(spRecords(state)), local.pending); spBaselineLocal = true; } catch(e){} }''')
rp(F, '''let bootLocal = null;      /* this browser's unsent copy, kept while the choice is open */''', '''let bootLocal = null;      /* this browser's unsent copy, kept while the choice is open */
let bootLocalOps = null;   /* V42: or just its unsent changes */''')
rp(F, '''  if(act==="dismiss-banner"){ bootLocal = null; document.getElementById("bootBanner").innerHTML = ""; return; }''', '''  if(act==="dismiss-banner"){ bootLocal = null; bootLocalOps = null; document.getElementById("bootBanner").innerHTML = ""; return; }''')
rp(F, '''  if(act==="use-local-version"){
    document.getElementById("bootBanner").innerHTML = "";
    if(bootLocal){ state = bootLocal; bootLocal = null; markDirty(); renderAll(); }
    return;
  }''', '''  if(act==="use-local-version"){
    if(bootLocalOps){ document.getElementById("bootBanner").innerHTML = ""; state = rebaseLocal(bootLocalOps); bootLocalOps = null; markDirty(); renderAll(); return; }
    if(bootLocal){
      if(!confirm("Replace what SharePoint holds with this browser\\u2019s copy? Anything colleagues have changed since this copy was made will be undone.")) return;
      document.getElementById("bootBanner").innerHTML = "";
      state = bootLocal; bootLocal = null; markDirty(); renderAll();
    }
    return;
  }''')
print("p2 ok")
rp(F, '''    local = loadLocal();             /* includes anything typed while SharePoint was loading */''', '''    if(localWriteTimer) localWriteNow();     /* note anything typed in the last moment as changes first */
    local = loadLocal();             /* includes anything typed while SharePoint was loading */''')
print("p2b ok")
