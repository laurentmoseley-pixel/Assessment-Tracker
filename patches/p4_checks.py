import sys; sys.path.insert(0, "/home/claude/work/patches")
from rp import rp
F = "d_app.js"
rp(F, '''  qualityCache = {st:state, key:qkey, out:out};
  return out;
}''', '''  /* ===== V42 checks: each would have caught a problem found in the V42 audit ===== */
  /* 12. two items in SharePoint for one key (a list whose key column isn't unique): the tracker uses the newest */
  const spd = {id:"spdups", title:"Saved twice in SharePoint",
    why:"Two items in one SharePoint list for the same pupil, subject (or assessment) and drop. The tracker shows and saves the newest; the older copies are left over from a save that was repeated. Removing them stops an old value coming back if the newest is ever deleted.",
    head:["List","Extra copies"], items:[]};
  const dupBy = {};
  Object.keys(spDupIds || {}).forEach(function(l){ Object.keys(spDupIds[l] || {}).forEach(function(k){ dupBy[l] = (dupBy[l] || 0) + spDupIds[l][k].length; }); });
  const dupN = Object.keys(dupBy).reduce(function(n, l){ return n + dupBy[l]; }, 0);
  if(dupN && !ign("spdups")) spd.items.push({key:"spdups", cells:[esc(Object.keys(dupBy).map(function(l){ return SEND_LIST_NAMES[l] || l; }).join(", ")), String(dupN)], fix:[["sp-dups", "all", "Remove the older copies"]]});
  out.push(spd);
  /* 13. staff whose subject list (saved in pieces) couldn't be read whole: left as SharePoint has it */
  const sdm = {id:"staffpieces", title:"Staff subject lists that couldn’t be read whole",
    why:"A long subject list is saved in several pieces. These were read while a save was part-way through, so the list shown may be incomplete. Nothing is written for them until someone checks them in Settings & data → Staff; Staff entry shows those teachers a “try again in a minute” message instead of the wrong classes.",
    head:["Member of staff"], items:[]};
  (state.staff || []).forEach(function(s){ if(s.damaged && !ign("staffpieces:" + s.id)) sdm.items.push({key:"staffpieces:" + s.id, cells:[esc(s.name || s.initials || s.id)], fix:[["staff-open", s.id, "Check in Staff"]]}); });
  out.push(sdm);
  /* 14. changes SharePoint refused, set aside so the rest could save */
  const sa = {id:"setaside", title:"Changes waiting because SharePoint refused them",
    why:"Everything else saved. These stay in this browser and are tried again every few minutes. If they keep failing, open TrackerAPI’s run history to see why.",
    head:["Waiting"], items:[]};
  const nStuck = Object.keys(spStuck || {}).length;
  if(nStuck) sa.items.push({key:"setaside", cells:[nStuck + " change" + (nStuck === 1 ? "" : "s")], fix:[["open-send", "", "See them"]]});
  out.push(sa);

  qualityCache = {st:state, key:qkey, out:out};
  return out;
}''')
rp(F, '''  const qkey = [revision, Object.keys(state.hidden||{}).length, state.results.length, (state.curResults||[]).length, (state.baselines||[]).length, state.pupils.length, state.settings.dataPoints.length].join("|");''',
      '''  const qkey = [revision, Object.keys(state.hidden||{}).length, state.results.length, (state.curResults||[]).length, (state.baselines||[]).length, state.pupils.length, state.settings.dataPoints.length, spDupCount(), Object.keys(spStuck || {}).length].join("|");''')
rp(F, '''  } else if(kind==="hide-sub"){
    setHidden("ps:" + arg, true);''', '''  } else if(kind==="sp-dups"){
    /* V42: remove the older copies of keys saved twice (the tracker already uses the newest) */
    const calls = [];
    Object.keys(spDupIds).forEach(function(l){ Object.keys(spDupIds[l] || {}).forEach(function(k){ spDupIds[l][k].forEach(function(id){ calls.push({list:l, key:k, id:id, call:{method:"DELETE", uri:spList(l) + "/items(" + id + ")"}}); }); }); });
    if(!calls.length) return;
    if(!hasSheet() || !sheetReady){ alert("Connect to SharePoint first."); return; }
    if(!quiet && !confirm("Remove " + calls.length + " older cop" + (calls.length === 1 ? "y" : "ies") + " from SharePoint? The tracker already shows and saves the newest of each. Removed items go to the SharePoint recycle bin.")) return;
    let i = 0;
    const next = function(){
      const part = calls.slice(i, i + SAVE_CHUNK); i += SAVE_CHUNK;
      if(!part.length) return Promise.resolve();
      return flowRun(part.map(function(x){ return x.call; })).then(function(){
        part.forEach(function(x){ const a = spDupIds[x.list] && spDupIds[x.list][x.key]; if(a){ const j = a.indexOf(x.id); if(j >= 0) a.splice(j, 1); if(!a.length) delete spDupIds[x.list][x.key]; } });
      }).then(next);
    };
    next().then(function(){ toast("Older copies removed.", "ok"); }, function(err){ spIdsStale = true; toast("Some couldn’t be removed (" + ((err && err.message) || "error") + "). Try again later.", "bad"); })
      .then(function(){ revision++; renderAll(); });
    return;
  } else if(kind==="staff-open"){
    switchTab("settings"); setTimeout(function(){ const el = document.getElementById("staffList"); if(el && el.scrollIntoView) el.scrollIntoView({block:"start"}); }, 50); return;
  } else if(kind==="open-send"){
    openSendPanel(); return;
  } else if(kind==="hide-sub"){
    setHidden("ps:" + arg, true);''')
# a staff member who is edited is no longer "couldn't be read": what is shown is what will be saved
rp(F, '''    if(t.hasAttribute("data-stsub")){
      const s = byId(staffList(), t.getAttribute("data-stsub")); if(!s) return;''', '''    if(t.hasAttribute("data-stsub")){
      const s = byId(staffList(), t.getAttribute("data-stsub")); if(!s) return;
      delete s.damaged;''')
print("p4 ok")
