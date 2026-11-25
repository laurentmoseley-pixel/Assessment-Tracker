import sys; sys.path.insert(0, "/home/claude/work/patches")
from rp import rp
F = "d_app.js"

# ---------- spDiff: changes field by field ----------
rp(F, '''/* the changes that bring the lists from base to cur */
function spDiff(base, cur){
  const ops = [];
  const lists = spActiveLists();
  lists.forEach(function(list){
    const b = (base && base[list]) || {}, c = cur[list];
    Object.keys(c).forEach(function(k){
      if(!b[k] || JSON.stringify(b[k]) !== JSON.stringify(c[k])) ops.push({list:list, op:"upsert", key:k, fields:c[k]});
    });
  });''', '''/* the changes that bring the lists from base to cur. V42: an item that is already there carries
   only the fields that changed (op.changed), and only those are sent, so a colleague's change to
   another field of the same item (a level, while SLT renames the pupil) is never written over. */
function spSame(a, b){ return a === b || JSON.stringify(a) === JSON.stringify(b); }
function spDiff(base, cur){
  const ops = [];
  const lists = spActiveLists();
  lists.forEach(function(list){
    const b = (base && base[list]) || {}, c = cur[list] || {};
    Object.keys(c).forEach(function(k){
      const was = b[k], now = c[k];
      if(!was){ ops.push({list:list, op:"upsert", key:k, fields:now}); return; }
      let changed = null;
      Object.keys(now).forEach(function(f){ if(!spSame(was[f], now[f])) (changed = changed || {})[f] = now[f]; });
      if(changed) ops.push({list:list, op:"upsert", key:k, fields:now, changed:changed});
    });
  });''')

# ---------- flowRun: reads are retried; answers carrying an error are noticed ----------
rp(F, '''function flowRun(calls, tries){
  if(IN_PA) return paRun(calls);''', '''/* V42: a request made only of reads is tried again (twice, after a pause) when the flow is busy or the
   connection drops, since reading twice is harmless. Writes are never repeated here: the save
   works out what really reached SharePoint first (spWrite). */
function flowRun(calls, tries){
  const readOnly = calls.length && calls.every(function(c){ return c.method === "GET"; });
  if(!readOnly) return flowRun1(calls, tries);
  const go = function(n){
    return flowRun1(calls, tries).catch(function(err){
      const m = (err && err.message) || "";
      if(n >= 2 || /passphrase|not been added|flow link/.test(m) || !/replied (429|5\\d\\d)|no connection|longer than 2 minutes/.test(m)) throw err;
      return new Promise(function(r){ setTimeout(r, n ? 4000 : 1500); }).then(function(){ return go(n + 1); });
    });
  };
  return go(0);
}
function flowRun1(calls, tries){
  if(IN_PA) return paRun(calls);''')
rp(F, '''        if(!labelled) return j;
        const out = new Array(calls.length);
        j.forEach(function(x){ out[x.i] = x.b; });
        return out;''', '''        if(!labelled){ if(j.length !== calls.length) throw new Error("the flow sent back " + j.length + " answers for " + calls.length + " requests: check its Response step"); return j; }
        const out = new Array(calls.length);
        j.forEach(function(x){ out[x.i] = x.b; });
        for(let q = 0; q < calls.length; q++) if(!(q in out)) throw new Error("the flow sent back no answer for request " + (q + 1) + " of " + calls.length);
        return out;''')
rp(F, '''      if(r.status === 401 || r.status === 403){
        forgetPass();
        if(tries >= 4) throw new Error("the passphrase was not accepted");
        return askPass(true).then(function(){ return flowRun(calls, tries + 1); });
      }''', '''      if(r.status === 401 || r.status === 403){
        forgetPass();
        if(tries >= 4) throw new Error("the passphrase was not accepted");
        return askPass(true).then(function(){ return flowRun1(calls, tries + 1); });
      }''')
rp(F, '''    if(passDeclined) return Promise.reject(new Error("the passphrase was not entered, so nothing was read or saved"));
    return askPass(false).then(function(){ return flowRun(calls, tries); });''', '''    if(passDeclined) return Promise.reject(new Error("the passphrase was not entered, so nothing was read or saved"));
    return askPass(false).then(function(){ return flowRun1(calls, tries); });''')

# ---------- ids: the newest item wins, and extra copies of a key are remembered ----------
rp(F, '''function spIdsFrom(lists){
  const ids = {};
  SP_LISTS.forEach(function(n){
    ids[n] = {};
    (lists[n] || []).forEach(function(it){ const k = it[SP_MATCH[n]]; if(k) ids[n][k] = it.Id; });
  });
  /* also by Title: a save that timed out may have added an item without the tracker
     hearing its number; adding it again would be refused as a duplicate */
  SP_LISTS.forEach(function(n){
    if(!lists[n]) return;
    spTitleIds[n] = {};
    lists[n].forEach(function(it){ if(it.Title) spTitleIds[n][it.Title] = it.Id; });
  });
  return ids;
}''', '''/* items in item-number order: when two items share a key, the newest is the one the tracker shows and saves to */
function spById(items){ return (items || []).slice().sort(function(a, b){ return (+a.Id || 0) - (+b.Id || 0); }); }
function spIdsFrom(lists){
  const ids = {};
  SP_LISTS.forEach(function(n){
    ids[n] = {};
    if(!lists[n]) return;
    const dup = {};
    spById(lists[n]).forEach(function(it){
      const k = it[SP_MATCH[n]]; if(!k) return;
      if(ids[n][k] != null && ids[n][k] !== it.Id) (dup[k] = dup[k] || []).push(ids[n][k]);
      ids[n][k] = it.Id;
    });
    /* V42: extra copies of one key (a list whose key column was never made unique). Removing the
       key removes every copy, so an older copy can't come back on the next load. */
    spDupIds[n] = dup;
  });
  /* also by Title: a save that timed out may have added an item without the tracker
     hearing its number; adding it again would be refused as a duplicate */
  SP_LISTS.forEach(function(n){
    if(!lists[n]) return;
    spTitleIds[n] = {};
    spById(lists[n]).forEach(function(it){ if(it.Title) spTitleIds[n][it.Title] = it.Id; });
  });
  return ids;
}
let spDupIds = {};
let spBaselineLocal = false;    /* the baseline was rebuilt from this browser's copy while SharePoint couldn't be reached */
function spDupCount(){ let n = 0; Object.keys(spDupIds).forEach(function(l){ Object.keys(spDupIds[l] || {}).forEach(function(k){ n += spDupIds[l][k].length; }); }); return n; }''')

# ---------- spWrite: rebuilt ----------
a = '''/* Writes the changes from spBaseline to `cur`, in batches. progress(done, total) is optional. */'''
b = '''        function(err){ spIdsStale = true; throw err; });
  });
}'''
import re
p = "/home/claude/work/src/parts/" + F
s = open(p, encoding="utf-8").read()
i = s.index(a); j = s.index(b, i) + len(b)
new = r'''/* Writes the changes from spBaseline to `cur`, in batches. progress(done, total) is optional.
   V42 makes every save safe to repeat and safe to run beside a colleague's:
   - only changed fields are sent to an item that exists (spDiff);
   - an item whose key changed (a result moved to another drop or kind) is updated in place,
     never removed first and then looked for again;
   - sign-offs (one item per pupil and framework) and qualification units are merged with what
     SharePoint holds just before sending, so two people's ticks never undo each other;
   - when a batch fails, the tracker first asks SharePoint which of its requests got through
     (a lost answer, the 2-minute limit), then sends the rest one at a time. An addition SharePoint
     refuses because the key is already there (a colleague added it) becomes an update;
   - extra copies of a key are removed with it. */
const SP_MERGE = {StatementMarks:{MarksJson:"obj", ReasonsJson:"obj"}, QualResults:{UnitsDone:"set"}};
function spJsonObj(v){ if(v && typeof v === "object") return v; try { const o = JSON.parse(v || "{}"); return o && typeof o === "object" && !Array.isArray(o) ? o : {}; } catch(e){ return {}; } }
/* what to write so that our change (was -> now) lands on top of what SharePoint holds (fresh) */
function spMergeValue(kind, fresh, was, now){
  if(kind === "obj"){
    const F0 = spJsonObj(fresh), W = spJsonObj(was), N = spJsonObj(now), out = Object.assign({}, F0), ks = {};
    Object.keys(W).concat(Object.keys(N)).forEach(function(k){ ks[k] = 1; });
    Object.keys(ks).forEach(function(k){ if(spSame(W[k], N[k])) return; if(N[k] === undefined) delete out[k]; else out[k] = N[k]; });
    return JSON.stringify(out);
  }
  if(kind === "set"){
    const sp = function(v){ return String(v || "").split(",").map(function(x){ return x.trim(); }).filter(Boolean); };
    const F0 = sp(fresh), W = sp(was), N = sp(now);
    const add = N.filter(function(x){ return W.indexOf(x) < 0; }), rem = W.filter(function(x){ return N.indexOf(x) < 0; });
    return F0.filter(function(x){ return rem.indexOf(x) < 0; }).concat(add.filter(function(x){ return F0.indexOf(x) < 0; })).join(",");
  }
  return now;
}
function spEqFilter(col, v){ return col + " eq '" + encodeURIComponent(String(v).replace(/'/g, "''")) + "'"; }
function spIdFilter(ids){ return ids.map(function(id){ return "(Id eq " + (+id) + ")"; }).join(" or "); }
/* is this answer SharePoint's error rather than an item? (a flow set to carry on after a failed request) */
function spAnsErr(a){ return !!(a && typeof a === "object" && (a["odata.error"] || a.error || (a.status && +a.status >= 400 && !a.Id))); }
const BIG_SAVE = 300;           /* a save bigger than this waits for a person to confirm it */
let bigSaveOK = false, bigSavePanelShown = false;
let spStuck = {};              /* "List|key" -> why: changes SharePoint refused, set aside so the rest can save */
let sendFilter = null;          /* when set, only these changes ("List|key") are sent: a test or one chosen group */
let spForeignMerged = false;    /* a save merged in a colleague's sign-offs: bring them onto the screen */
function spWrite(cur, stamp, progress, peek){
  if(peek && !spBaseline) return Promise.reject(new Error("the tracker hasn’t read SharePoint yet, so it can’t tell what has changed; nothing was sent"));
  if(spBaselineLocal) return Promise.reject(new Error("the tracker hasn’t connected to SharePoint since it opened, so nothing can be sent yet"));
  let ops = spDiff(spBaseline, cur);
  if(sendFilter) ops = ops.filter(function(o){ return sendFilter.has(o.list + "|" + o.key); });
  const stuckBefore = ops.length;
  ops = ops.filter(function(o){ return !spStuck[o.list + "|" + o.key]; });
  const heldBack = stuckBefore - ops.length;
  if(peek && ops.length > BIG_SAVE && !bigSaveOK){ const e = new Error(ops.length + " changes are waiting, which is more than usual, so they wait for you to check them"); e.bigSave = true; e.n = ops.length; return Promise.reject(e); }
  const st = stamp ? [["savedAt", stamp.saved], ["savedBy", stamp.savedBy], ["appBuild", APP_BUILD]] : [];
  const pre = spIdsStale || !spIds ? spRefreshIds() : Promise.resolve();
  let peeked = null, peekDone = !peek;
  const PEEK = {method:"GET", uri:spList("Settings") + "/items?$select=Id,Title,SettingValue&$filter=(Title eq 'savedAt') or (Title eq 'savedBy') or (Title eq 'appBuild')"};
  const readPeek = function(a){
    peeked = {saved:null, savedBy:""};
    ((a && a.value) || []).forEach(function(it){
      if(it.Title==="savedAt") peeked.saved = it.SettingValue || null;
      if(it.Title==="savedBy") peeked.savedBy = it.SettingValue || "";
      if(it.Title==="appBuild") noteBuild(it.SettingValue);
      spIds.Settings[it.Title] = it.Id;
    });
  };
  return pre.then(function(){
    /* an item whose key changed but whose Title (its id) didn't: update it in place */
    const delById = {};
    ops.forEach(function(o){ if(o.op === "delete"){ const id = spIds[o.list] && spIds[o.list][o.key]; if(id) delById[o.list + "#" + id] = o; } });
    ops.forEach(function(o){
      if(o.op !== "upsert" || (spIds[o.list] && spIds[o.list][o.key]) || !o.fields || !o.fields.Title || SP_MATCH[o.list] === "Title") return;
      const tid = spTitleIds[o.list] && spTitleIds[o.list][o.fields.Title];
      const d = tid && delById[o.list + "#" + tid];
      if(d && !d.absorbed){ d.absorbed = true; o.rekey = {from:d.key, id:tid}; }
    });
    ops = ops.filter(function(o){ return !o.absorbed; });
    /* removals first, so an old item can't block a changed one that now shares its unique values */
    ops = ops.filter(function(o){ return o.op === "delete"; }).concat(ops.filter(function(o){ return o.op !== "delete"; }));
    return spMergeFetch(ops, peek ? PEEK : null).then(function(peekAns){
      if(peekAns !== undefined){ readPeek(peekAns); peekDone = true; }
    });
  }).then(function(){
    const total = ops.length;
    let done = 0;
    if(progress) progress(0, total);
    const isKeyed = function(list){ return SP_MATCH[list] !== "Title"; };
    /* the requests for one change: usually one; a removal also removes any extra copies */
    const callsFor = function(o){
      const out = [];
      let id = spIds[o.list][o.key];
      if(o.op === "delete"){
        if(id) out.push({call:{method:"DELETE", uri:spList(o.list) + "/items(" + id + ")"}, role:"main", id:id});
        ((spDupIds[o.list] || {})[o.key] || []).forEach(function(x){ out.push({call:{method:"DELETE", uri:spList(o.list) + "/items(" + x + ")"}, role:"dup", id:x}); });
        return out;
      }
      let whole = false;
      if(!id && o.rekey){ id = o.rekey.id; whole = true; }
      if(!id && o.fields && o.fields.Title && spTitleIds[o.list] && spTitleIds[o.list][o.fields.Title]){
        /* already in SharePoint under this Title (an earlier save got through): update that item,
           unless it is still another key's item, which this must not take over */
        const tid = spTitleIds[o.list][o.fields.Title];
        const owner = Object.keys(spIds[o.list]).filter(function(k){ return spIds[o.list][k] === tid; })[0];
        if(!owner || !cur[o.list] || !cur[o.list][owner] || owner === o.key){ id = tid; whole = true; }
        else if(isKeyed(o.list)){ const f2 = Object.assign({}, o.fields); f2.Title = o.fields.Title + "_" + Math.random().toString(36).slice(2, 6); return [{call:{method:"POST", uri:spList(o.list) + "/items", body:f2}, role:"main"}]; }
      }
      if(id){
        let body = Object.assign({}, (whole || !o.changed) ? o.fields : o.changed, o.mergeBody || {});
        /* updating an item found by its key: leave its Title as SharePoint has it, because another
           item may already hold this Title and SharePoint refuses duplicate Titles */
        if(isKeyed(o.list)) delete body.Title;
        if(!Object.keys(body).length) return out;
        out.push({call:{method:"PATCH", uri:spList(o.list) + "/items(" + id + ")", body:body}, role:"main", id:id});
        return out;
      }
      const body = Object.assign({}, o.fields, o.mergeBody || {});
      out.push({call:{method:"POST", uri:spList(o.list) + "/items", body:body}, role:"main"});
      return out;
    };
    const stampOps = function(){
      return st.map(function(s){ return {list:"Settings", op:"upsert", key:s[0], fields:{Title:s[0], SettingValue:spText(s[1])}, stamp:true}; });
    };
    const applyOne = function(m, a){
      if(m.op === "peek"){ readPeek(a); return; }
      const o = m.o;
      if(m.role === "dup"){ const l = (spDupIds[o.list] || {})[o.key]; if(l){ const i = l.indexOf(m.id); if(i >= 0) l.splice(i, 1); if(!l.length) delete spDupIds[o.list][o.key]; } return; }
      if(o.op === "delete"){ delete spIds[o.list][o.key]; return; }
      if(o.rekey){ delete spIds[o.list][o.rekey.from]; spIds[o.list][o.key] = o.rekey.id; }
      if(a && a.Id){ spIds[o.list][o.key] = a.Id;    /* a new item: remember its number */
        const t = a.Title || (o.fields && o.fields.Title); if(t){ if(!spTitleIds[o.list]) spTitleIds[o.list] = {}; spTitleIds[o.list][t] = a.Id; } }
      else if(m.id) spIds[o.list][o.key] = m.id;
    };
    /* ask SharePoint where these changes stand: additions already made (and their numbers), removals done */
    const probe = function(ms){
      const gets = [], who = [];
      ms.forEach(function(m){
        if(m.op === "peek" || !m.call) return;
        if(m.call.method === "POST"){
          gets.push({method:"GET", uri:spList(m.o.list) + "/items?$select=" + (SP_MATCH[m.o.list] === "Title" ? "Id,Title" : "Id,Title," + SP_MATCH[m.o.list]) + "&$filter=" + spEqFilter(SP_MATCH[m.o.list], m.o.key) + "&$top=20"});
          who.push(m);
        } else if(m.call.method === "DELETE"){
          gets.push({method:"GET", uri:spList(m.o.list) + "/items?$select=Id&$filter=Id eq " + (+m.id) + "&$top=1"});
          who.push(m);
        }
      });
      if(!gets.length) return Promise.resolve();
      return flowRun(gets).then(function(ans){
        who.forEach(function(m, j){
          const found = spById((ans[j] && ans[j].value) || []);
          if(m.call.method === "POST" && found.length){
            const it = found[found.length - 1];
            spIds[m.o.list][m.o.key] = it.Id;
            if(found.length > 1){ spDupIds[m.o.list] = spDupIds[m.o.list] || {}; spDupIds[m.o.list][m.o.key] = found.slice(0, -1).map(function(x){ return x.Id; }); }
            m.landed = true;          /* there now: send it again as an update */
          }
          if(m.call.method === "DELETE" && !found.length) m.gone = true;
        });
      });
    };
    /* rebuild a request after probing: an addition that is already there becomes an update (merged where needed) */
    const rebuild = function(m){
      if(m.gone) return Promise.resolve(null);
      if(!m.landed) return Promise.resolve(m.call);
      const o = m.o;
      const mk = function(){ const c = callsFor(o).filter(function(x){ return x.role === "main"; })[0]; if(c){ m.id = c.id; } return c ? c.call : null; };
      if(!SP_MERGE[o.list]) return Promise.resolve(mk());
      return spMergeFetch([o], null, true).then(mk);
    };
    const step = function(){
      const slice = ops.slice(done, done + SAVE_CHUNK);
      const last = done + slice.length >= total;
      const ms = [];
      if(!peekDone){ ms.push({op:"peek", call:PEEK}); peekDone = true; }
      slice.forEach(function(o){ callsFor(o).forEach(function(c){ ms.push({o:o, call:c.call, role:c.role, id:c.id}); }); });
      if(last) stampOps().forEach(function(o){ callsFor(o).forEach(function(c){ ms.push({o:o, call:c.call, role:c.role, id:c.id}); }); });
      const t0 = Date.now();
      /* this batch is in SharePoint: count it as sent, so a retry after a later failure carries on from here */
      const toBaseline = function(){
        if(!spBaseline) spBaseline = {};
        slice.forEach(function(o){
          if(spStuck[o.list + "|" + o.key] || o.failed) return;
          if(!spBaseline[o.list]) spBaseline[o.list] = {};
          if(o.op==="delete") delete spBaseline[o.list][o.key]; else spBaseline[o.list][o.key] = o.fields;
          if(o.rekey) delete spBaseline[o.list][o.rekey.from];
        });
      };
      const setAside = function(m, why){
        const o = m.o; if(!o || o.stamp) return;
        o.failed = true;
        spStuck[o.list + "|" + o.key] = {why:why, op:o, at:new Date()};
        sendLogAdd({ok:false, n:1, ms:0, msg:"set aside: " + ((SEND_LIST_NAMES[o.list] || o.list) + " · " + (o.fields ? sendDescribe(o) : o.key)), done:done, total:total});
      };
      /* SharePoint refused something in the batch: find out what got through, then send the rest
         one at a time, so the good ones save and a refused one is set aside instead of blocking the rest */
      const oneByOne = function(list){
        let k = 0;
        const next = function(){
          if(k >= list.length) return Promise.resolve();
          const m = list[k++];
          if(m.op === "peek" || !m.call) return next();
          return rebuild(m).then(function(call){
            if(!call){ if(m.gone) applyOne(m, null); return; }
            const t1 = Date.now();
            return flowRun([call]).then(function(a){
              if(spAnsErr(a[0])) throw new Error("the flow replied 500 (" + JSON.stringify(a[0]).slice(0, 200) + ")");
              sendLogAdd({ok:true, n:1, ms:Date.now() - t1, done:done, total:total});
              applyOne(m, a[0]);
            }, function(err){
              const msg = (err && err.message) || "";
              if(!/replied 5\d\d/.test(msg) || /longer than 2 minutes|504/.test(msg)) throw err;
              /* refused: was it an addition someone else (or a lost answer) already made? */
              if(call.method === "POST" && !m.retried){ m.retried = true; k--; return probe([m]); }
              if(call.method === "DELETE" && !m.retried){ m.retried = true; k--; return probe([m]); }
              setAside(m, "SharePoint refused this one (" + (call.method || "") + "): open TrackerAPI’s run history and click its SP step to see why");
            });
          }).then(next);
        };
        return next();
      };
      if(!ms.length){ done += slice.length; toBaseline(); if(progress) progress(done, total); return last ? Promise.resolve() : step(); }
      return flowRun(ms.map(function(m){ return m.call; })).then(function(ans){
        const bad = [];
        ms.forEach(function(m, i){ if(spAnsErr(ans[i])) bad.push(m); else applyOne(m, ans[i]); });
        sendLogAdd({ok:!bad.length, n:ms.length, ms:Date.now() - t0, done:done + slice.length, total:total, msg:bad.length ? bad.length + " refused" : ""});
        if(bad.length) return probe(bad).then(function(){ return oneByOne(bad); });
      }, function(err){
        sendLogAdd({ok:false, n:ms.length, ms:Date.now() - t0, msg:(err && err.message) || "unknown error", done:done, total:total});
        const m = (err && err.message) || "";
        if(!/replied 5\d\d/.test(m) || /longer than 2 minutes|504/.test(m)) throw err;
        if(ms.length < 2 && !(ms[0] && ms[0].call && (ms[0].call.method === "POST" || ms[0].call.method === "DELETE"))) throw err;
        return probe(ms).then(function(){ return oneByOne(ms); });
      }).then(function(){
        toBaseline();
        done += slice.length;
        if(progress) progress(done, total);
        if(!last) return step();
      });
    };
    return step().then(function(){
      const stuckN = Object.keys(spStuck).length;
      if(stuckN){
        bigSaveOK = false; if(total) spWroteSince = true;
        const e = new Error(stuckN + " change" + (stuckN === 1 ? "" : "s") + " refused by SharePoint and set aside; everything else saved"); e.stuck = true; e.n = stuckN; throw e;
      }
      if(heldBack){ const e2 = new Error("set-aside changes are waiting"); e2.stuck = true; e2.n = heldBack; throw e2; }
      if(!sendFilter) spBaseline = cur; bigSaveOK = false; bigSavePanelShown = false; if(total) spWroteSince = true;
      if(spForeignMerged){ spForeignMerged = false; setTimeout(function(){ spQuietReload(""); }, 600); }
      return {ok:true, count:total, peeked:peeked}; },
                        function(err){ spIdsStale = true; throw err; });
  });
}
/* For sign-offs and qualification units: read what SharePoint holds for the items about to be
   updated, and work out the merged value to send (o.mergeBody). `extra` (the peek) can ride along.
   Resolves with the answer to `extra`, if given. */
function spMergeFetch(ops, extra, force){
  const want = ops.filter(function(o){
    if(o.op !== "upsert" || !SP_MERGE[o.list] || !(spIds[o.list] && spIds[o.list][o.key])) return false;
    if(force) return true;
    return !!o.changed && Object.keys(SP_MERGE[o.list]).some(function(f){ return f in o.changed; });
  });
  if(!want.length && !extra) return Promise.resolve(undefined);
  const groups = {};
  want.forEach(function(o){ (groups[o.list] = groups[o.list] || []).push(o); });
  const calls = [], plan = [];
  if(extra){ calls.push(extra); plan.push(null); }
  Object.keys(groups).forEach(function(list){
    const g = groups[list], cols = Object.keys(SP_MERGE[list]);
    for(let i = 0; i < g.length; i += 20){
      const part = g.slice(i, i + 20);
      calls.push({method:"GET", uri:spList(list) + "/items?$select=Id," + cols.join(",") + "&$filter=" + spIdFilter(part.map(function(o){ return spIds[list][o.key]; })) + "&$top=20"});
      plan.push({list:list, ops:part});
    }
  });
  return flowRun(calls).then(function(ans){
    let extraAns;
    plan.forEach(function(p, i){
      if(!p){ extraAns = ans[i]; return; }
      const byId = {}; ((ans[i] && ans[i].value) || []).forEach(function(it){ byId[it.Id] = it; });
      p.ops.forEach(function(o){
        const it = byId[spIds[p.list][o.key]];
        if(!it) return;               /* gone: the update will be refused and handled then */
        const was = spBaseline && spBaseline[p.list] ? spBaseline[p.list][o.key] : null;
        const mb = {};
        Object.keys(SP_MERGE[p.list]).forEach(function(f){
          const v = spMergeValue(SP_MERGE[p.list][f], it[f], was ? was[f] : null, o.fields[f]);
          mb[f] = v;
          if(SP_MERGE[p.list][f] === "obj" ? !spSame(spJsonObj(v), spJsonObj(o.fields[f])) : String(v) !== String(o.fields[f] || "")) spForeignMerged = true;
        });
        o.mergeBody = mb;
      });
    });
    return extraAns;
  });
}'''
s = s[:i] + new + s[j:]
open(p, "w", encoding="utf-8").write(s)

# the old spWrite's constants were inside the replaced block; make sure the old duplicates are gone
s = open(p, encoding="utf-8").read()
assert s.count("const BIG_SAVE = 300;") == 1, s.count("const BIG_SAVE = 300;")

# ---------- legacy mode only when a list really is missing ----------
rp(F, '''      return spReadLists(SP_LISTS.filter(core), spSelect).then(extra, function(err){
        spLegacy = true;
        return spReadLists(SP_V28_LISTS, spSelect).catch(function(){ spLegacy = false; throw err; });
      });''', '''      return spReadLists(SP_LISTS.filter(core), spSelect).then(extra, function(err){
        /* V42: only a list that isn't there means an old (V28) site; a busy flow or a dropped
           connection is an error to report, not a reason to open without the curriculum lists */
        if(!/does not exist|404|cannot be found|not found/i.test((err && err.message) || "")) throw err;
        spLegacy = true;
        return spReadLists(SP_V28_LISTS, spSelect).catch(function(){ spLegacy = false; throw err; });
      });''')
print("p1 ok")
