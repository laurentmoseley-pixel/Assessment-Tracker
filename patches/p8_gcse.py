import sys; sys.path.insert(0, "/home/claude/work/patches")
from rp import rp
F = "d_app.js"
B = "b_body.html"

# ---------- version and changelog ----------
rp(F, 'const APP_BUILD = "42.1";', 'const APP_BUILD = "42.2";')
rp(F, '''/* ===== CHANGELOG =====
   V42.1''', '''/* ===== CHANGELOG =====
   V42.2
   - GCSE is entered on the Qualifications page: one "GCSE <subject>" for each GCSE subject (plus all
     subjects at once), with grade now, target and exam result, U-9. It reads and writes the grades
     already saved (CurriculumResults), so everything typed or imported before shows there as it is.
     Enter levels is for levels only. Pupil pages list GCSEs with the other qualifications.
   - Curriculum statements for a pupil who has moved onto GCSE: the GCSE framework is theirs even
     before anything is signed off in it, and until enough is, their next steps start from their
     grade now. A framework whose levels all count as GCSE grades (G1-G9) is a GCSE framework.
   - Export for one data drop: every pupil and subject, the level, GCSE grade or qualification
     status, the previous result and the progress since it.
   V42.1''')

# ---------- GCSE items on the Qualifications page ----------
rp(F, '''function qualInScope(q){ return !ENTRY_MODE || !!(entryScopeIds && entryScopeIds.quals && entryScopeIds.quals[q.id]); }
''', '''function qualInScope(q){ return !ENTRY_MODE || !!(entryScopeIds && entryScopeIds.quals && entryScopeIds.quals[q.id]); }
/* ===== V42.2: GCSE on the Qualifications page =====
   GCSE is entered with the other qualifications: one "GCSE <subject>" for each GCSE subject that has
   pupils on GCSE grades, over the grades already saved for that subject (CurriculumResults: grade now,
   target, exam result). Nothing is copied or moved: what was typed on Enter levels or imported from
   Evidence for Learning or a spreadsheet shows here as it is, and every other page reads it as before.
   Enter levels is for levels (FLS, 1E-9S). */
function gcseEntryName(su){ return /\\bGCSE\\b/i.test(su.name || "") ? su.name : "GCSE " + su.name; }
function gcseEntryItems(dp){
  if(!dp || !state) return [];
  const ay = acYearOf(dp.date) || currentAY(), withData = {};
  (state.curResults || []).forEach(function(r){ if((r.kind === "predicted" || r.kind === "actual" || r.kind === "target") && r.value !== "" && r.value != null) withData[r.subjectId] = true; });
  const out = (state.subjects || []).filter(function(su){
    if(!su.active || !(isGcseSubject(su) || withData[su.id])) return false;
    return state.pupils.some(function(p){ return takesSubject(p, su, ay) && usesGcse(p, ay, su.id); });
  }).map(function(su){ return {id:"gcse:" + su.id, su:su, name:gcseEntryName(su)}; });
  out.sort(function(a, b){ return a.name.localeCompare(b.name); });
  if(out.length > 1) out.push({id:"gcse:*", su:null, subs:out.map(function(x){ return x.su; }), name:"GCSE \\u2013 all subjects at once (grid)"});
  return out;
}
function gcseFilterItems(items, text){
  const words = String(text || "").toLowerCase().split(/\\s+/).filter(Boolean);
  return items.filter(function(g){ const hay = (g.name + " gcse").toLowerCase(); return words.every(function(w){ return hay.indexOf(w) >= 0; }); });
}
const GCSE_BOX = {predicted:"grade now", actual:"exam result", target:"target"};
function renderGcseEntry(gi, dp, pool, host, guide){
  const ae = document.activeElement;
  const keep = ae && ae.classList && ae.classList.contains("lvlin") && host.contains(ae)
    ? {pid:ae.getAttribute("data-pid"), sid:ae.getAttribute("data-sid"), v:ae.value, ctx:ae.getAttribute("data-ctx")} : null;
  const ay = acYearOf(dp.date) || currentAY(), idx = curIndex(), grid = !gi.su;
  const subs = grid ? gi.subs : [gi.su];
  const fits = function(p, s){ return takesSubject(p, s, ay) && usesGcse(p, ay, s.id); };
  const seen = {};
  const pupils = pool.filter(function(p){ if(seen[p.id]) return false; seen[p.id] = true; return subs.some(function(s){ return fits(p, s); }); })
    .sort(function(a, b){ return yearSortKey(a.year) - yearSortKey(b.year) || String(a.name).localeCompare(String(b.name)); });
  const cols = grid ? subs.filter(function(s){ return pupils.some(function(p){ return fits(p, s); }); }) : subs;
  const dps = orderedDataPoints(), pos = dps.findIndex(function(d){ return d.id === dp.id; });
  const prevOf = function(pid, sid, kind){ for(let i = pos - 1; i >= 0; i--){ const x = curGet(idx, pid, sid, dps[i].id, kind); if(x) return x; } return null; };
  guide.hidden = false;
  guide.innerHTML = (ENTRY_MODE ? entryInfoHtml() : '') + '<strong>' + esc(gi.name) + '</strong> at ' + esc(dp.name) + '. ' +
    'Type a grade 9\\u20131 (with a step if you use them: <kbd>4E</kbd> <kbd>4D</kbd> <kbd>4S</kbd>) or <kbd>U</kbd> and press <kbd>Enter</kbd> to go down. ' +
    '<kbd>=</kbd> repeats the previous drop, <kbd>+</kbd>/<kbd>-</kbd> moves it a grade, and you can paste a column from Excel. ' +
    (grid ? 'Each box is the grade now. ' : 'Grade now is compared with the target' + (ENTRY_MODE ? ' (SLT set targets)' : '') + '; add the exam result when it comes. ') +
    'A pupil on a BTEC or another course that stands in for the subject shows its grade instead. Everything saves as you go.';
  if(!pupils.length){
    host.innerHTML = '<div class="empty">Nobody is on GCSE grades' + (grid ? '' : ' in ' + esc(gi.su.name)) + ' at ' + esc(dp.name) + (fieldVal("qeYear") || fieldVal("qeGroup") ? ' in this year or group' : '') +
      '. Pupils move to GCSE grades from Year ' + esc(String(curCfg().gcseFrom)) + ', or earlier from their profile.</div>';
    return;
  }
  const qualBox = function(p, s, qf){
    const own = qualOwnAt(p.id, qf.q.id, dp.id), was = own ? null : qf.rec;
    const g = qualGrades(qf.q), v = own ? own.grade || "" : "";
    const lab = esc(p.name + " " + s.name + ", " + qualTitle(qf.q));
    return (g.length
      ? '<select class="qualgradein" data-qualgrade="' + p.id + '|' + qf.q.id + '" data-dp="' + dp.id + '" aria-label="' + lab + '" title="' + esc(qualTitle(qf.q)) + '"><option value="">' + (was && was.grade ? 'Last: ' + esc(was.grade) : '\\u2014') + '</option>' +
          g.map(function(x){ return '<option' + (x === v ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join("") + '</select>'
      : '<input class="qualgradein" data-qualgrade="' + p.id + '|' + qf.q.id + '" data-dp="' + dp.id + '" value="' + esc(v) + '" placeholder="' + esc(was && was.grade ? was.grade : "grade") + '" aria-label="' + lab + '" style="width:110px">') +
      ' <span class="muted" style="font-size:12px">' + esc(qualShort(qf.q)) + '</span>';
  };
  const box = function(p, s, kind, row, col){
    const dpk = kind === "target" ? "" : dp.id;
    const cur = curGet(idx, p.id, s.id, dpk, kind), prev = kind === "target" ? null : prevOf(p.id, s.id, kind);
    const st = kind === "predicted" ? ceStatus(p, s, dp, kind, idx) : {cls:"", title:""};
    return '<input class="lvlin' + (st.cls ? ' ' + st.cls : '') + '" data-curin="1" data-ctx="' + kind + '|' + dpk + '" data-pid="' + p.id + '" data-sid="' + s.id + '" data-row="' + row + '" data-col="' + col + '"' +
      ' value="' + esc(cur ? cur.value : "") + '" placeholder="' + esc(grid && prev ? prev.value : "") + '" data-prev="' + esc(prev ? prev.value : "") + '"' +
      ' autocomplete="off" spellcheck="false" maxlength="3" title="' + esc(st.title || "") + '" aria-label="' + esc(p.name + " " + s.name + ", GCSE " + GCSE_BOX[kind]) + '">';
  };
  const tools = '<div class="row noprint" style="margin:0 0 8px;gap:8px"><button class="btn ghost sm" data-act="ge-fill-prev">Fill empty grade-now boxes from the previous drop</button>' +
    '<span class="hint" style="margin:0">then adjust with <kbd>+</kbd> / <kbd>-</kbd></span></div>';
  if(grid){
    host.innerHTML = tools + '<table class="cegrid"><thead><tr><th style="position:sticky;left:0;background:var(--panel);z-index:1">Pupil</th><th>Yr</th>' +
      cols.map(function(s){ return '<th class="subj">' + esc(s.name) + '</th>'; }).join("") + '</tr></thead><tbody>' +
      pupils.map(function(p, r){
        return '<tr><td style="position:sticky;left:0;background:var(--panel);white-space:nowrap">' + esc(p.name) + '</td><td>' + esc(yearAt(p, ay)) + '</td>' +
          cols.map(function(s, ci){
            if(!fits(p, s)) return '<td><span class="cell-na" title="' + (takesSubject(p, s, ay) ? 'Still on levels in this subject' : 'Doesn\\u2019t take this subject') + '">\\u2014</span></td>';
            const qf = qualForSubject(p.id, s.id, dp.id);
            return '<td>' + (qf ? qualBox(p, s, qf) : box(p, s, "predicted", r, ci)) + '</td>';
          }).join("") + '</tr>';
      }).join("") + '</tbody></table>';
  } else {
    const su = gi.su, fwh = fwSuggestHead(su, "predicted");
    host.innerHTML = tools + '<table><thead><tr><th style="width:22%">Pupil</th><th>Yr</th><th>Target</th><th>Previous</th><th>Grade now</th><th>Status</th><th>Exam result</th>' + fwh + '</tr></thead><tbody>' +
      pupils.map(function(p, r){
        const qf = qualForSubject(p.id, su.id, dp.id);
        if(qf){
          const qs = ceQualStatus(p, qf, dp);
          return '<tr class="' + qs.rowCls + '" data-cerow="' + p.id + '"><td>' + esc(p.name) + '</td><td>' + esc(yearAt(p, ay)) + '</td><td class="muted">\\u2014</td><td class="muted">\\u2014</td>' +
            '<td class="entrycell">' + qualBox(p, su, qf) + '</td><td data-cest="' + p.id + '">' + qs.html + '</td><td class="muted">\\u2014</td>' + (fwh ? '<td class="muted">\\u2014</td>' : '') + '</tr>';
        }
        const t = curGet(idx, p.id, su.id, "", "target"), prev = prevOf(p.id, su.id, "predicted");
        const st = ceStatus(p, su, dp, "predicted", idx);
        return '<tr class="' + st.rowCls + '" data-cerow="' + p.id + '"><td>' + esc(p.name) + '</td><td>' + esc(yearAt(p, ay)) + '</td>' +
          '<td>' + (ENTRY_MODE ? (t ? esc(t.value) : '<span class="muted">none</span>') : box(p, su, "target", r, 2)) + '</td>' +
          '<td class="muted">' + (prev ? esc(prev.value) : '\\u2014') + '</td>' +
          '<td class="entrycell">' + box(p, su, "predicted", r, 0) + '</td>' +
          '<td data-cest="' + p.id + '">' + st.html + '</td>' +
          '<td>' + box(p, su, "actual", r, 1) + '</td>' + (fwh ? fwSuggestCell(p, su, dp, "predicted") : '') + '</tr>';
      }).join("") + '</tbody></table>';
  }
  if(keep){
    const el = host.querySelector('.lvlin[data-pid="' + keep.pid + '"][data-sid="' + keep.sid + '"][data-ctx="' + keep.ctx + '"]');
    if(el){ if(el.value !== keep.v) el.value = keep.v; el.focus(); }
  }
}
/* jump to GCSE entry for a subject ("*" = all subjects), keeping the drop, year and group */
function gcseGo(sid, dpid, y, g){
  switchTab("qualentry");
  const set = function(id, v){ const el = document.getElementById(id); if(el && v != null && Array.prototype.some.call(el.options || [], function(o){ return o.value === v; })) el.value = v; };
  const fd = document.getElementById("qeFind"), tf = document.getElementById("qeTypeF");
  if(fd) fd.value = "";
  if(tf) tf.value = "";
  qeOpenUnits = null;
  renderQualEntry();
  set("qeDrop", dpid);
  renderQualEntry();
  set("qeQual", "gcse:" + sid); set("qeYear", y || ""); set("qeGroup", g || "");
  renderQualEntry();
  const first = document.querySelector("#qeTable .lvlin");
  if(first) first.focus();
}
''')

rp(F, '''function fillTypeFilter(sel, list){
  if(!sel) return;
  const seen = {}; list.forEach(function(q){ seen[q.type] = true; });
  fillSelect(sel, Object.keys(QUAL_TYPES).filter(function(k){ return seen[k]; }).map(function(k){ return {v:k, l:QUAL_TYPES[k].label}; }), null, "All types");
}''', '''function fillTypeFilter(sel, list, withGcse){
  if(!sel) return;
  const seen = {}; list.forEach(function(q){ seen[q.type] = true; });
  fillSelect(sel, (withGcse ? [{v:"gcse", l:"GCSE"}] : []).concat(Object.keys(QUAL_TYPES).filter(function(k){ return seen[k]; }).map(function(k){ return {v:k, l:QUAL_TYPES[k].label}; })), null, "All types");
}''')

rp(F, '''  const allQ = activeQuals().filter(qualInScope);
  fillTypeFilter(document.getElementById("qeTypeF"), allQ);
  const list = qualFilter(allQ, fieldVal("qeFind"), fieldVal("qeTypeF")).sort(function(a, b){ return qualTitle(a).localeCompare(qualTitle(b)); });
  fillSelect(qSel, list.map(function(q){ return {v:q.id, l:qualTitle(q)}; }));
  const dps = shownDrops();
  fillSelect(dSel, dps.map(function(d){ return {v:d.id, l:d.name}; }), dSel.value || (dps.length ? (ENTRY_MODE ? dps[dps.length - 1].id : ((latestStartedDrop() || dps[dps.length - 1]).id)) : ""));
  const q = byId(list, qSel.value), dp = byId(dps, dSel.value);
  const yrs = {}, grps = {};''', '''  const allQ = activeQuals().filter(qualInScope);
  const dps = shownDrops();
  fillSelect(dSel, dps.map(function(d){ return {v:d.id, l:d.name}; }), dSel.value || (dps.length ? (ENTRY_MODE ? dps[dps.length - 1].id : ((latestStartedDrop() || dps[dps.length - 1]).id)) : ""));
  const dp = byId(dps, dSel.value);
  /* V42.2: the GCSE subjects first, then the qualifications set up in Settings */
  const gAll = gcseEntryItems(dp);
  fillTypeFilter(document.getElementById("qeTypeF"), allQ, gAll.length > 0);
  const tf = fieldVal("qeTypeF"), find = fieldVal("qeFind");
  const list = (tf === "gcse" ? [] : qualFilter(allQ, find, tf)).sort(function(a, b){ return qualTitle(a).localeCompare(qualTitle(b)); });
  const gList = !tf || tf === "gcse" ? gcseFilterItems(gAll, find) : [];
  fillSelect(qSel, gList.map(function(g){ return {v:g.id, l:g.name}; }).concat(list.map(function(q){ return {v:q.id, l:qualTitle(q)}; })));
  const q = byId(list, qSel.value), gi = byId(gList, qSel.value);
  const addBtn = document.querySelector('#tab-qualentry [data-act="qual-add-pupils"]');
  if(addBtn) addBtn.hidden = !!gi;
  const yrs = {}, grps = {};''')

rp(F, '''  if(!list.length && allQ.length){ host.innerHTML = '<div class="empty">No qualification matches your search.</div>'; guide.hidden = true; return; }
  if(!list.length){
    host.innerHTML = '<div class="empty">' + (ENTRY_MODE ? "None of your subjects has a qualification set up yet." : 'No qualifications set up yet. Add them under Set up → Settings & data → Qualifications.') + '</div>';
    guide.hidden = true; return;
  }
  if(!q || !dp){ host.innerHTML = '<div class="empty">Choose a qualification and a data drop.</div>'; guide.hidden = true; return; }
  const pool = state.pupils.filter(function(p){
    return (!ySel.value || String(p.year) === ySel.value) && (!gSel.value || p.group === gSel.value);
  });''', '''  if(!list.length && !gList.length && (allQ.length || gAll.length)){ host.innerHTML = '<div class="empty">No qualification matches your search.</div>'; guide.hidden = true; return; }
  if(!list.length && !gList.length){
    host.innerHTML = '<div class="empty">' + (ENTRY_MODE ? "None of your pupils is on GCSE grades or a qualification" + (dp ? " at " + esc(dp.name) : "") + "." : 'Nobody is on GCSE grades' + (dp ? ' at ' + esc(dp.name) : '') + ' and no qualifications are set up yet. Add qualifications under Set up → Settings & data → Qualifications.') + '</div>';
    guide.hidden = true; return;
  }
  if((!q && !gi) || !dp){ host.innerHTML = '<div class="empty">Choose a qualification and a data drop.</div>'; guide.hidden = true; return; }
  const pool = state.pupils.filter(function(p){
    return (!ySel.value || String(p.year) === ySel.value) && (!gSel.value || p.group === gSel.value);
  });
  if(gi){ qeShown = []; renderGcseEntry(gi, dp, pool, host, guide); return; }''')

# ---------- Enter levels: levels only ----------
rp(F, '''    kSel.innerHTML = Object.keys(CUR_KINDS).filter(function(k){ return !ENTRY_MODE || k !== "target"; }).map(''',
      '''    /* V42.2: levels only here; GCSE grades are entered on the Qualifications page */
    kSel.innerHTML = Object.keys(CUR_KINDS).filter(function(k){ return k === "level"; }).map(''')
rp(F, '''  pupils.sort(function(a,b){ return yearSortKey(a.year)-yearSortKey(b.year) || String(a.name).localeCompare(String(b.name)); });
  if(!pupils.length){
    host.innerHTML = '<div class="empty">'+(kind==="level" && !document.getElementById("ceAllYears").checked && state.pupils.some(function(p){ return usesGcse(p, ay); })
      ? 'No pupils here. Years '+c.gcseFrom+'+ use GCSE grades: pick a GCSE type above, or tick <em>Include GCSE years</em>.' : 'No pupils match.')+'</div>';
    return;
  }''', '''  pupils.sort(function(a,b){ return yearSortKey(a.year)-yearSortKey(b.year) || String(a.name).localeCompare(String(b.name)); });
  /* V42.2: pupils on GCSE grades here are entered under Qualifications; say so, with a way there */
  const seenG = {};
  const gcseHere = kind==="level" && !allYrs ? state.pupils.filter(function(p){
    if(seenG[p.id]) return false; seenG[p.id] = true;
    return (!ySel.value || String(p.year)===ySel.value) && (!gSel.value || p.group===gSel.value) && (grid ? subs : [su]).some(function(s){ return mayEnter(p, s) && takesSubject(p, s, ay) && usesGcse(p, ay, s.id); });
  }).length : 0;
  const gcseGoBtn = '<button class="linkbtn" data-gcse-go="'+(grid ? '*' : su.id)+'">enter their GCSE grades under Qualifications</button>';
  if(!pupils.length){
    host.innerHTML = '<div class="empty">'+(gcseHere
      ? 'No pupils on levels here. '+gcseHere+' pupil'+(gcseHere===1?' is':'s are')+' on GCSE grades: '+gcseGoBtn+', or tick <em>Include GCSE years for levels</em>.' : 'No pupils match.')+'</div>';
    return;
  }''')
rp(F, '''  const tools = '<div class="row noprint" style="margin:0 0 8px;gap:8px"><button class="btn ghost sm" data-act="ce-fill-prev">Fill empty boxes from the previous drop</button>'+
    '<span class="hint" style="margin:0">then adjust with <kbd>+</kbd> / <kbd>-</kbd></span></div>';''',
'''  const tools = '<div class="row noprint" style="margin:0 0 8px;gap:8px"><button class="btn ghost sm" data-act="ce-fill-prev">Fill empty boxes from the previous drop</button>'+
    '<span class="hint" style="margin:0">then adjust with <kbd>+</kbd> / <kbd>-</kbd></span><span class="spacer"></span>'+
    '<button class="btn ghost sm noentry" data-dropexport="'+esc(dp.id)+'">Export '+esc(dp.name)+' (every subject)</button></div>'+
    (gcseHere ? '<p class="hint noprint" style="margin:0 0 8px">'+gcseHere+' pupil'+(gcseHere===1?'':'s')+' here '+(gcseHere===1?'is':'are')+' on GCSE grades: '+gcseGoBtn+'.</p>' : '');''')

# staff "My classes" card for a GCSE class goes to GCSE entry
rp(F, '''function staffGo(spec){
  switchTab("curentry");''', '''function staffGo(spec){
  if(spec.k && spec.k !== "level"){ gcseGo(spec.s, spec.d, spec.y, spec.g); return; }      /* V42.2 */
  switchTab("curentry");''')
rp(F, 'const STAFF_TABS = ["staff","curentry","cur","core","pupil"];', 'const STAFF_TABS = ["staff","curentry","qualentry","cur","core","pupil"];')
rp(F, '["curentry","Levels & GCSE grades"]', '["curentry","Levels"]')

# ---------- shared entry boxes work on either page ----------
rp(F, '''  const dpId = ctx.length > 1 && (ctx[1] || kind === "target") ? (ctx[1] || document.getElementById("ceDrop").value) : document.getElementById("ceDrop").value;''',
      '''  const scope = (el.closest && el.closest("#ceTable, #qeTable")) || document, inQe = scope.id === "qeTable";      /* V42.2: GCSE boxes sit on the Qualifications page */
  const dropSel = document.getElementById(inQe ? "qeDrop" : "ceDrop");
  const dpId = ctx.length > 1 && (ctx[1] || kind === "target") ? (ctx[1] || dropSel.value) : dropSel.value;''')
rp(F, '''  if(p && su && dp){
    const st = ceStatus(p, su, dp, kind, idx);
    el.className = "lvlin" + (st.cls ? " "+st.cls : "");
    el.title = st.title || "";
    const cs = document.querySelector('[data-cest="'+pid+'"]'); if(cs) cs.innerHTML = st.html;
    const ce = document.querySelector('[data-ceexp="'+pid+'"]'); if(ce) ce.innerHTML = st.expected ? esc(st.expected) : '<span class="muted">—</span>';
    const tr = document.querySelector('[data-cerow="'+pid+'"]'); if(tr) tr.className = st.rowCls;
  }
  fwRefreshSuggest(pid);''', '''  if(p && su && dp){
    /* on the GCSE page the row's status is the grade now's, whichever box changed */
    const st = ceStatus(p, su, dp, inQe ? "predicted" : kind, idx);
    const mine = !inQe || kind === "predicted" ? st : {cls:"", title:""};
    el.className = "lvlin" + (mine.cls ? " "+mine.cls : "");
    el.title = mine.title || "";
    if(inQe && kind !== "predicted"){ const pb = scope.querySelector('.lvlin[data-pid="'+pid+'"][data-sid="'+sid+'"][data-ctx^="predicted|"]'); if(pb){ pb.className = "lvlin" + (st.cls ? " "+st.cls : ""); pb.title = st.title || ""; } }
    const cs = scope.querySelector('[data-cest="'+pid+'"]'); if(cs) cs.innerHTML = st.html;
    const ce = scope.querySelector('[data-ceexp="'+pid+'"]'); if(ce) ce.innerHTML = st.expected ? esc(st.expected) : '<span class="muted">—</span>';
    const tr = scope.querySelector('[data-cerow="'+pid+'"]'); if(tr) tr.className = st.rowCls;
  }
  fwRefreshSuggest(pid, el);''')
rp(F, '''  const nx = document.querySelector('#ceTable .lvlin[data-row="'+r+'"][data-col="'+c+'"]');''',
      '''  const nx = ((el.closest && el.closest("#ceTable, #qeTable")) || document.getElementById("ceTable")).querySelector('.lvlin[data-row="'+r+'"][data-col="'+c+'"]');''')
rp(F, '''  let bad = 0, done = 0;
  rows.forEach(function(cols, i){
    cols.forEach(function(v, j){
      const t = document.querySelector('#ceTable .lvlin[data-row="'+(r0+i)+'"][data-col="'+(c0+j)+'"]');''', '''  let bad = 0, done = 0;
  const scope = (el.closest && el.closest("#ceTable, #qeTable")) || document.getElementById("ceTable");
  rows.forEach(function(cols, i){
    cols.forEach(function(v, j){
      const t = scope.querySelector('.lvlin[data-row="'+(r0+i)+'"][data-col="'+(c0+j)+'"]');''')
rp(F, '''function ceFillFromPrevious(){
  const boxes = Array.prototype.filter.call(document.querySelectorAll("#ceTable .lvlin"), function(el){ return !el.value && el.getAttribute("data-prev"); });''',
      '''function ceFillFromPrevious(hostId, kind){
  const boxes = Array.prototype.filter.call(document.querySelectorAll("#" + (hostId || "ceTable") + " .lvlin"), function(el){
    return !el.value && el.getAttribute("data-prev") && (!kind || String(el.getAttribute("data-ctx") || "").indexOf(kind + "|") === 0); });''')
rp(F, '''  if(act==="ce-fill-prev"){ ceFillFromPrevious(); return; }''', '''  if(act==="ce-fill-prev"){ ceFillFromPrevious(); return; }
  if(act==="ge-fill-prev"){ ceFillFromPrevious("qeTable", "predicted"); return; }
  if(act==="export-drop-csv"){ exportDropCsv(fieldVal("exDrop")); return; }''')
rp(F, '''function fwRefreshSuggest(pid){
  const cell = document.querySelector('[data-fwsug="' + pid + '"]');
  if(!cell) return;
  const su = byId(state.subjects, document.getElementById("ceSubject").value), dp = byId(state.settings.dataPoints, document.getElementById("ceDrop").value);
  const kind = document.getElementById("ceKind").value || "level", p = byId(state.pupils, pid);''', '''function fwRefreshSuggest(pid, el){
  /* V42.2: the suggestion beside the box that changed, on Enter levels or the GCSE page */
  const scope = (el && el.closest && el.closest("#ceTable, #qeTable")) || document.getElementById("ceTable") || document, inQe = scope.id === "qeTable";
  const cell = scope.querySelector('[data-fwsug="' + pid + '"]');
  if(!cell) return;
  const su = byId(state.subjects, el && el.getAttribute ? el.getAttribute("data-sid") : document.getElementById("ceSubject").value), dp = byId(state.settings.dataPoints, document.getElementById(inQe ? "qeDrop" : "ceDrop").value);
  const kind = inQe ? "predicted" : (document.getElementById("ceKind").value || "level"), p = byId(state.pupils, pid);''')
rp(F, '''    const el = document.querySelector('#ceTable .lvlin[data-pid="' + x[0] + '"][data-sid="' + x[1] + '"]');
    if(el){ el.value = x[2]; commitCurInput(el); fwRefreshSuggest(x[0]); el.focus(); }''', '''    const sc = u.closest("#ceTable, #qeTable") || document.getElementById("ceTable");
    const el = sc.querySelector('.lvlin[data-pid="' + x[0] + '"][data-sid="' + x[1] + '"]' + (sc.id === "qeTable" ? '[data-ctx^="predicted|"]' : ''));
    if(el){ el.value = x[2]; commitCurInput(el); fwRefreshSuggest(x[0], el); el.focus(); }''')
rp(F, '''      setQualResult(pq[0], pq[1], dpId, {grade:v, status:status});
      renderCurEntry(); return;''', '''      setQualResult(pq[0], pq[1], dpId, {grade:v, status:status});
      if(t.closest && t.closest("#qeTable")) renderQualEntry(); else renderCurEntry();
      return;''')
rp(F, '''    const epg = e.target.closest("[data-ep-go]");''', '''    const ggo = e.target.closest("[data-gcse-go]");
    if(ggo){ gcseGo(ggo.getAttribute("data-gcse-go"), fieldVal("ceDrop"), fieldVal("ceYear"), fieldVal("ceGroup")); return; }
    const dxe = e.target.closest("[data-dropexport]");
    if(dxe){ exportDropCsv(dxe.getAttribute("data-dropexport")); return; }
    const epg = e.target.closest("[data-ep-go]");''')

# ---------- pupil page: GCSE with the other qualifications ----------
rp(F, '''function profileQualsHtml(p){
  const mineAll = quals().filter(function(q){ return qualRecs(p.id, q.id).length; });
  if(!mineAll.length) return "";''', '''/* V42.2: GCSE alongside the other qualifications on the pupil page: grade now at each drop, the
   target, the exam result, and the status the tracker gives it */
function profileGcseRows(p){
  const ay = currentAY(), idx = curIndex(), dps = orderedDataPoints(), ld = latestStartedDrop() || dps[dps.length - 1];
  return (state.subjects || []).filter(function(su){ return su.active !== false; }).map(function(su){
    if(isHidden("ps:" + p.id + "|" + su.id)) return "";
    const on = takesSubject(p, su, ay) && usesGcse(p, ay, su.id), g = gcseJudge(p.id, su.id, idx);
    if(!on && !g.pred && !g.actual) return "";
    if(!g.pred && !g.actual && !g.target && ld && qualForSubject(p.id, su.id, ld.id)) return "";       /* on a BTEC instead: that row says it */
    const steps = dps.map(function(d){ const r = curGet(idx, p.id, su.id, d.id, "predicted"); return r ? '<span class="qstep"><span class="muted small">' + esc(d.name) + '</span><strong>' + esc(r.value) + '</strong></span>' : ''; }).filter(Boolean).slice(-4);
    const S = g.status && g.status !== "none" && CUR_STATUS[g.status] ? ' ' + curTag(g.status) : '';
    return '<tr><td><strong>' + esc(gcseEntryName(su)) + '</strong><div class="muted small">GCSE' + (g.target ? ' \\u00b7 target ' + esc(g.target.value) : '') + '</div></td>' +
      '<td>' + (steps.length ? steps.join('<span class="qarrow" aria-hidden="true">\\u203a</span>') : '<span class="muted">No grades yet</span>') + '</td><td>\\u2014</td>' +
      '<td>' + (g.actual ? 'Exam result <strong>' + esc(g.actual.value) + '</strong>' : (g.pred ? 'Now <strong>' + esc(g.pred.value) + '</strong>' + S : '\\u2014')) + '</td><td>\\u2014</td></tr>';
  }).filter(Boolean);
}
function profileQualsHtml(p){
  const mineAll = quals().filter(function(q){ return qualRecs(p.id, q.id).length; });
  const gRows = profileGcseRows(p);
  if(!mineAll.length && !gRows.length) return "";''')
rp(F, '''  if(!mine.length) return '<h3 style="margin-top:22px">Qualifications</h3>' + uasHtml;''', '''  if(!mine.length && !gRows.length) return '<h3 style="margin-top:22px">Qualifications</h3>' + uasHtml;''')
rp(F, '''<th>Qualification</th><th>Journey</th><th>Units</th><th>Grade</th><th>Exam / due</th></tr></thead><tbody>' +
    mine.map(function(q){''', '''<th>Qualification</th><th>Journey</th><th>Units</th><th>Grade</th><th>Exam / due</th></tr></thead><tbody>' + gRows.join("") +
    mine.map(function(q){''')

# ---------- curriculum statements for pupils who moved onto GCSE ----------
rp(F, '''  return f.kind === "exam" || /\\bGCSE\\b/i.test(f.name) ? "gcse" : "cur";
}''', '''  if(f.kind === "exam" || /\\bGCSE\\b/i.test(f.name)) return "gcse";
  /* V42.2: a ladder whose levels all count as GCSE grades (G1-G9) is a GCSE framework, whatever its name */
  const maps = (f.levels || []).map(function(l){ return l.map; }).filter(Boolean);
  return maps.length && maps.every(function(m){ return /^G\\d$/.test(m); }) ? "gcse" : "cur";
}''')
rp(F, '''    const pref = list.filter(function(f){ const r = fwRow(pid, f.id); return fwStage(f) === want && r && Object.keys(r.marks).length; });
    if(pref.length) list = pref;''', '''    let pref = list.filter(function(f){ const r = fwRow(pid, f.id); return fwStage(f) === want && r && Object.keys(r.marks).length; });
    /* V42.2: a pupil moved onto GCSE is on the subject's GCSE framework even before anything in it is signed off */
    if(!pref.length && want === "gcse") pref = list.filter(function(f){ return fwStage(f) === "gcse"; });
    if(pref.length) list = pref;''')
rp(F, '''function fwNextSteps(pid, fw, n){
  const sg = fwSuggest(pid, fw, null);
  let L = sg && !sg.none ? sg.level : null;
  if(L && sg.band === "S"){ const i = fw.levels.indexOf(L); const nx = fw.levels.slice(i + 1).filter(function(x){ return x.map && fwLive(x).length; })[0]; if(nx) L = nx; }
  if(!L){''', '''/* V42.2: where a pupil on GCSE grades starts in a GCSE framework before enough of it is signed off to
   suggest a grade: their grade now (or exam result), else the grade their last level points to; the
   next steps are the next grade up. With nothing to go on, the first grade on the ladder. */
function fwGcseStart(pid, fw){
  if(!fw || !fw.subjectId || fwStage(fw) !== "gcse") return null;
  const p = fwPupil(pid);
  if(!p || !fwOnGcse(p, fw.subjectId)) return null;
  const idx = curIndex(), g = gcseJudge(pid, fw.subjectId, idx);
  let grade = null, from = "";
  if(g.pred && gcseValue(g.pred.value) != null){ grade = gcseValue(g.pred.value); from = "now"; }
  else if(g.actual && gcseValue(g.actual.value) != null){ grade = gcseValue(g.actual.value); from = "exam"; }
  else {
    const su = byId(state.subjects || [], fw.subjectId), m = su && byId(state.pupils || [], pid) ? subjectMetrics(p, su, idx) : null;
    if(m && m.gcse != null && gcseValue(m.gcse) != null){ grade = gcseValue(m.gcse); from = "level"; }
  }
  const num = function(l){ return +String(l.map).slice(1); };
  const lv = (fw.levels || []).filter(function(l){ return /^G\\d$/.test(l.map || "") && fwLive(l).length; }).sort(function(a, b){ return num(a) - num(b); });
  if(!lv.length) return null;
  const L = (grade == null ? lv[0] : lv.filter(function(l){ return num(l) > grade; })[0]) || lv[lv.length - 1];
  return {grade:grade, from:from, L:L};
}
function fwNextSteps(pid, fw, n){
  const sg = fwSuggest(pid, fw, null);
  let L = sg && !sg.none ? sg.level : null;
  if(L && sg.band === "S"){ const i = fw.levels.indexOf(L); const nx = fw.levels.slice(i + 1).filter(function(x){ return x.map && fwLive(x).length; })[0]; if(nx) L = nx; }
  let start = null;
  if(!L && fwSuggests(fw)){ start = fwGcseStart(pid, fw); if(start) L = start.L; }
  if(!L){''')
rp(F, '''  return {sg:sg, L:L, steps:keys.filter(function(s){ const m = fwGet(pid, fw.id, s.id); return !m || m.s < 3; }).slice(0, n || 3),
          recheck:keys.filter(function(s){ return fwStale(fwGet(pid, fw.id, s.id)); }).slice(0, 3)};''', '''  return {sg:sg, L:L, start:start, steps:keys.filter(function(s){ const m = fwGet(pid, fw.id, s.id); return !m || m.s < 3; }).slice(0, n || 3),
          recheck:keys.filter(function(s){ return fwStale(fwGet(pid, fw.id, s.id)); }).slice(0, 3)};''')
rp(F, '''function fwSuggestCellHtml(x){
  return x.sg ?''', '''function fwSuggestCellHtml(x){
  if(x.start && (!x.sg || x.sg.none)){
    const gs = x.start, from = {now:"Grade now", exam:"Exam result", level:"From their last level"}[gs.from] || "";
    return (gs.grade != null ? '<strong>Grade ' + esc(gs.grade === 0 ? "U" : String(gs.grade)) + '</strong>' : '<strong>Starting GCSE</strong>') +
      '<div class="muted small">' + (from ? esc(from) + '. ' : '') + 'Not enough GCSE statements signed off yet to suggest a grade.</div>';
  }
  return x.sg ?''')
rp(F, '''  const normal = function(f){
    const x = fwNextSteps(p.id, f, 3);''', '''  /* V42.2: on GCSE in a subject with no GCSE framework: the grade, with the curriculum one under it */
  const movedNoGcse = function(f){
    const x = fwNextSteps(p.id, f, 3), gj = gcseJudge(p.id, f.subjectId, curIndex());
    const now = gj.actual ? 'Exam result <strong>' + esc(gj.actual.value) + '</strong>' : (gj.pred ? 'Grade <strong>' + esc(gj.pred.value) + '</strong> now' : 'On GCSE grades');
    return '<tr><td>' + esc(f.name) + '</td><td>' + now + '<div class="muted small">' + (x.sg && !x.sg.none ? 'Statements reached ' + esc(x.sg.value) + ' before GCSE' : 'Before GCSE') + '</div></td>' +
      '<td>' + (x.steps.length ? '<div class="muted small">No GCSE statements are set up for this subject; the next ones in ' + esc(f.name) + ':</div><ul class="fwul">' + x.steps.map(function(s){ return '<li>' + esc(s.text) + '</li>'; }).join("") + '</ul>' : '<span class="muted">\\u2014</span>') + '</td></tr>';
  };
  const normal = function(f){
    const x = fwNextSteps(p.id, f, 3);''')
rp(F, '''    if(!g){ done[f.id] = true; rows.push(normal(f)); return; }''', '''    if(!g){ done[f.id] = true; rows.push(sid && fwStage(f) === "cur" && fwOnGcse(p, sid) ? movedNoGcse(f) : normal(f)); return; }''')
rp(F, '''    else rows.push('<tr><td>' + esc(g.name) + '</td><td><span class="muted small">No GCSE statements signed off yet</span></td>''', '''    else if(fwNextSteps(p.id, g, 3).steps.length) rows.push(normal(g));
    else rows.push('<tr><td>' + esc(g.name) + '</td><td><span class="muted small">No GCSE statements signed off yet</span></td>''')

# ---------- export for one data drop ----------
rp(F, '''function exportBaselinesCsv(){''', '''/* V42.2: everything for one data drop, one row per pupil and subject they take: the level (or GCSE
   grade, or where they are on a qualification that stands in for the subject), the previous result
   and the progress since it */
function exportDropCsv(dpId){
  const dp = byId(state.settings.dataPoints, dpId);
  if(!dp){ toast("Choose a data drop first.", ""); return; }
  const ay = acYearOf(dp.date) || currentAY(), idx = curIndex(), dps = orderedDataPoints(), pos = dps.findIndex(function(d){ return d.id === dp.id; });
  const subs = (state.subjects || []).filter(function(s){ return s.active; });
  const prevOf = function(pid, sid, kind){ for(let i = pos - 1; i >= 0; i--){ const x = curGet(idx, pid, sid, dps[i].id, kind); if(x) return {r:x, dp:dps[i]}; } return null; };
  const moved = function(n, unit){ return n === 0 ? "No change" : (n > 0 ? "Up " : "Down ") + Math.abs(n) + " " + unit + (Math.abs(n) === 1 ? "" : "s"); };
  const lines = [["Pupil","UPN","Year","Group","Subject","Type",dp.name,"Previous","Previous drop","Progress since previous","Status"].map(csvCell).join(",")];
  const seen = {};
  const pupils = state.pupils.filter(function(p){ if(seen[p.id]) return false; seen[p.id] = true; return true; })
    .sort(function(a, b){ return yearSortKey(yearAt(a, ay)) - yearSortKey(yearAt(b, ay)) || String(a.name).localeCompare(String(b.name)); });
  let n = 0;
  pupils.forEach(function(p){ subs.forEach(function(su){
    if(!takesSubject(p, su, ay) || isHidden("ps:" + p.id + "|" + su.id)) return;
    const base = [p.name, p.upn || "", yearAt(p, ay), p.group || "", su.name];
    const qf = qualForSubject(p.id, su.id, dp.id);
    if(qf){
      const rec = qf.rec, S = QUAL_STATUS_BY[rec.status], pdp = pos > 0 ? dps[pos - 1] : null;
      const prev = pdp ? qualAt(p.id, qf.q.id, pdp.id) : null, PS = prev ? QUAL_STATUS_BY[prev.status] : null;
      lines.push(base.concat([qualTitle(qf.q), (S ? S.label : "") + (rec.grade ? " (" + rec.grade + ")" : ""), PS ? PS.label + (prev.grade ? " (" + prev.grade + ")" : "") : "",
        PS ? pdp.name : "", PS && S ? (PS === S ? "No change" : PS.label + " to " + S.label) : "", S ? S.label : ""]).map(csvCell).join(","));
      n++; return;
    }
    const gcse = usesGcse(p, ay, su.id), kind = gcse ? "predicted" : "level";
    let type = gcse ? "GCSE" : "Level", r = curGet(idx, p.id, su.id, dp.id, kind);
    if(!r && gcse){ const a = curGet(idx, p.id, su.id, dp.id, "actual"); if(a){ r = a; type = "GCSE exam result"; } }
    const pv = prevOf(p.id, su.id, kind);
    const ia = r ? fwStepIndex(r.value, kind) : null, ib = pv ? fwStepIndex(pv.r.value, kind) : null;
    let status = "";
    if(!r) status = "Not entered";
    else if(gcse){ if(type === "GCSE"){ const gj = gcseJudge(p.id, su.id, idx, dp.date); status = gj.status && gj.status !== "none" && CUR_STATUS[gj.status] ? CUR_STATUS[gj.status].label : ""; } }
    else { const j = levelJudge(p.id, su.id, r, dp, idx); status = j && CUR_STATUS[j.status] && j.status !== "none" ? CUR_STATUS[j.status].label : ""; }
    lines.push(base.concat([type, r ? r.value : "", pv ? pv.r.value : "", pv ? pv.dp.name : "", ia != null && ib != null ? moved(ia - ib, gcse ? "grade" : "step") : "", status]).map(csvCell).join(","));
    n++;
  }); });
  downloadBlob("levels_" + String(dp.name || "drop").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "") + ".csv", lines.join("\\n"), "text/csv;charset=utf-8");
  toast(n + " rows for " + dp.name + " downloaded.", "ok");
}
function exportBaselinesCsv(){''')
rp(F, '''function renderIo(){
  const host = document.getElementById("ioBody");
  if(!host) return;''', '''function renderIo(){
  const host = document.getElementById("ioBody");
  const xd = document.getElementById("exDrop");
  if(xd && state){ const ld = latestStartedDrop(); fillSelect(xd, orderedDataPoints().map(function(d){ return {v:d.id, l:d.name}; }), xd.value || (ld ? ld.id : null)); }
  if(!host) return;''')

# ---------- help ----------
rp(F, '''  ["Entering data", "What’s the quickest way to enter levels?", "Enter data → Levels & GCSE grades. ''', '''  ["Entering data", "Where do I enter GCSE grades?", "Enter data → Qualifications. Choose GCSE and the subject (or GCSE – all subjects at once) and the data drop, then type the grade now, U to 9; SLT also set the target, and the exam result goes in when it comes. The grades already saved, including imports from Evidence for Learning, are there as they were. Enter levels is for levels (FLS1–FLS10, 1E–9S)."],
  ["Entering data", "What’s the quickest way to enter levels?", "Enter data → Levels. ''')
rp(F, '''teacher’s Levels & GCSE grades and Sign off grids''', '''teacher’s Levels, GCSE and Sign off grids''')
rp(F, '''Levels &amp; GCSE grades and Sign off grids for this subject''', '''Levels, GCSE and Sign off grids for this subject''')

# ---------- page markup ----------
rp(B, '''<label class="fld">Entering<select id="ceKind"></select></label>''', '''<label class="fld" hidden>Entering<select id="ceKind"></select></label>''')
rp(B, '''<h1>Qualifications</h1><p>BTEC, ASDAN, Functional Skills, Entry Level and others: status, units and grades at each data drop. Entries save as you go.</p>''',
      '''<h1>Qualifications</h1><p>GCSE grades, BTEC, ASDAN, Functional Skills, Entry Level and others: grades, status and units at each data drop. Entries save as you go.</p>''')
rp(B, '''      <p class="hint">CSV files open in Excel. The backup holds everything and can be loaded back in Settings &amp; data.</p>
      <div class="row" style="gap:8px">''', '''      <p class="hint">CSV files open in Excel. The backup holds everything and can be loaded back in Settings &amp; data.</p>
      <div class="row" style="gap:8px;align-items:flex-end;margin-bottom:12px">
        <label class="fld">One data drop<select id="exDrop"></select></label>
        <button class="btn" data-act="export-drop-csv"><svg class="ic sm"><use href="#i-down"/></svg>Levels, GCSE grades and qualifications for this drop</button>
      </div>
      <div class="row" style="gap:8px">''')
print("p8 ok")
