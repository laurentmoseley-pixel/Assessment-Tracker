/* Random edits by SLT and a teacher, saved through a flow that fails at random: before running,
   after running (answer lost), part-way (2-minute limit) and dropped connections; one tab is closed
   mid-way and reopened. At the end nothing is lost, nothing is duplicated, nothing is set aside, and a
   fresh open shows exactly what each person last had on screen.
   Run: TRACKER_DIR=../out/current node tests_fuzz.js [seed] [rounds] */
"use strict";
const E = require("./env");
const L = E.L;
const assert = require("assert");
const FDB = require("fake-indexeddb");

function rng(seed){ let s = seed >>> 0; return function(){ s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
async function saveTry(t){
  t.ev("if(retryTimer){ clearTimeout(retryTimer); retryTimer = null; } retryCount = 0; bigSaveOK = true;");
  await t.ev("(function(){ window.__sd = false; flushAutoSave().then(function(){ window.__sd = true; }, function(){ window.__sd = true; }); })()");
  await L.until(() => t.ev("window.__sd === true && !autoInFlight"), 90000);
}
async function saveUntilClean(t){ for(let i = 0; i < 10; i++){ await saveTry(t); await L.settle(20); if(!t.ev("dirty")) return true; } return false; }
function dupKeys(sp, list, col){ const m = {}; sp.lists[list].forEach((x) => { const k = String(x[col]).toLowerCase(); m[k] = (m[k] || 0) + 1; }); return Object.keys(m).filter((k) => m[k] > 1); }

async function run(seed, rounds){
  const r = rng(seed);
  const site = await E.seededSite();
  const sp = site.sp;
  let faultsOn = false;            /* on once both copies have opened */
  const faults = (run) => {
    if(!faultsOn) return;
    const x = r();
    if(x < 0.12) return {when:"before", status:502};
    if(x < 0.22) return {when:"after", status:502};
    if(x < 0.30 && run.calls.length > 1) return {when:"midway", at:Math.floor(r() * run.calls.length), status:504};
    if(x < 0.34) return {when:"network"};
  };
  const idb = new FDB.IDBFactory();
  let a = await E.openSlt(sp, {flowOpts:{faults}, idb});
  const b = await E.openStaff(sp, "st_104", {flowOpts:{faults}});
  const bPairs = JSON.parse(b.ev("JSON.stringify(entryScopeIds.pairs)"));
  faultsOn = true;
  const bPids = Object.keys(bPairs);
  const aPids = a.ev("state.pupils.map(function(p){ return p.id; })").filter((p) => !bPairs[p]);
  const subs = ["su_english","su_maths","su_art","su_history","su_music","su_re"];
  const lv = ["2E","2D","2S","3E","3D","3S","4E","4D",""];
  let closes = 0;
  for(let i = 0; i < rounds; i++){
    /* SLT: a handful of changes of different kinds */
    const n = 1 + Math.floor(r() * 6);
    for(let k = 0; k < n; k++){
      const pid = aPids[Math.floor(r() * aPids.length)], x = r();
      if(x < 0.45) a.ev(`setCurResult(${JSON.stringify(pid)}, ${JSON.stringify(subs[Math.floor(r() * subs.length)])}, "dp_2026_1", "level", ${JSON.stringify(lv[Math.floor(r() * lv.length)])})`);
      else if(x < 0.6) a.ev(`setResult(${JSON.stringify(pid)}, "as_mtest", "dp_2026_1", ${JSON.stringify(r() < 0.2 ? "" : String(300 + Math.floor(r() * 300)))})`);
      else if(x < 0.75) a.ev(`fwSet(${JSON.stringify(pid)}, "fw_eng", "fw_eng_3_" + ${Math.floor(r() * 12)}, ${r() < 0.2 ? "null" : 1 + Math.floor(r() * 3)})`);
      else if(x < 0.85) a.ev(`(function(){ const p = byId(state.pupils, ${JSON.stringify(pid)}); if(!p) throw new Error("pupil ${pid} missing; pupils " + state.pupils.length + " leavers " + (state.leavers||[]).length + " sheetReady " + sheetReady + " inLeavers " + !!byId(state.leavers||[], ${JSON.stringify(pid)}) + " name list " + state.pupils.filter(function(q){ return q.id === ${JSON.stringify(pid)}; }).length + " raw " + JSON.stringify((spLastLists && spLastLists.Pupils || []).filter(function(q){ return q.Title === ${JSON.stringify(pid)}; }))); p.name = p.name.replace(/ \\(\\d+\\)$/, "") + " (" + ${i} + ")"; markDirty(); })()`);
      else if(x < 0.93) a.ev(`(function(){ state.pathwayLogs.push({id:uid("lg"), pupilId:${JSON.stringify(pid)}, ts:new Date().toISOString().slice(0,16), from:"", to:"attain", reason:"review", notes:"fuzz ${i}", action:"", staff:"A", type:"review"}); markDirty(); })()`);
      else a.ev(`(function(){ const r0 = state.curResults.filter(function(r){ return r.pupilId === ${JSON.stringify(pid)} && r.kind === "level" && r.dataPointId === "dp_2025_5"; })[0]; if(r0){ const was = r0.value; setCurResult(r0.pupilId, r0.subjectId, "dp_2025_5", "level", ""); setCurResult(r0.pupilId, r0.subjectId, "dp_2025_4", "level", was); } })()`);
    }
    /* the teacher: levels in their own classes */
    const m = Math.floor(r() * 4);
    for(let k = 0; k < m; k++){
      const pid = bPids[Math.floor(r() * bPids.length)], sid = Object.keys(bPairs[pid])[0];
      b.ev(`setCurResult(${JSON.stringify(pid)}, ${JSON.stringify(sid)}, "dp_2026_1", "level", ${JSON.stringify(lv[Math.floor(r() * (lv.length - 1))])})`);
    }
    await saveTry(a);
    await saveTry(b);
    if(r() < 0.12){
      /* the SLT tab is closed part-way and opened again later */
      await L.settle(700);
      const ls = a.lsDump(); a.close(); closes++;
      a = await E.openSlt(sp, {flowOpts:{faults}, idb, localStorage:ls});
      /* if SharePoint couldn't be reached, the person clicks Try again */
      for(let q = 0; q < 8 && !a.ev("sheetReady"); q++){ a.ev("startLoad()"); await L.until(() => a.ev("sheetReady") || /Could not load/.test(a.ev("document.getElementById('bootBanner').textContent")), 60000).catch(() => {}); }
      await L.settle(400);
      if(process.env.FUZZDBG) console.log("reopen round", i, "ready", a.ev("sheetReady"), "pupils", a.ev("state.pupils.length"), "dirty", a.ev("dirty"), "banner", a.ev("document.getElementById('bootBanner').textContent").slice(0, 160));
    }
  }
  faultsOn = false;
  /* as a person would: "Try these again" on anything set aside while the flow was failing */
  a.ev("spStuck = {}"); b.ev("spStuck = {}");
  const okA = await saveUntilClean(a), okB = await saveUntilClean(b);
  const dbg = function(a){
    console.log("DEBUG sheetReady", a.ev("sheetReady"), "local", a.ev("spBaselineLocal"), "big", a.ev("bigSavePanelShown"), "conflict", a.ev("saveConflict"));
    console.log("DEBUG pending", JSON.stringify(a.ev("(sendPending()||[]).slice(0,6).map(function(o){ return o.list+'|'+o.op+'|'+o.key+'|'+JSON.stringify(o.changed||{}).slice(0,120); })")));
    console.log("DEBUG stuck", JSON.stringify(a.ev("Object.keys(spStuck).slice(0,5).map(function(k){ return k + ' :: ' + spStuck[k].why + ' :: ' + JSON.stringify(spStuck[k].op.changed || spStuck[k].op.fields).slice(0,160); })")));
    console.log("DEBUG sp errors", JSON.stringify((a.flow.errs || []).slice(-8)));
    console.log("DEBUG log", JSON.stringify(a.ev("sendLog.slice(-6).map(function(x){ return (x.ok?'ok ':'FAIL ') + x.n + ' ' + (x.msg||''); })")));
  };
  if(!okA) dbg(a);
  if(!okB) dbg(b);
  assert.ok(okA, "SLT copy saved everything: " + a.ev("(sendPending()||[]).length") + " waiting; set aside " + a.ev("Object.keys(spStuck).length"));
  assert.ok(okB, "Staff entry saved everything");
  assert.strictEqual(a.ev("Object.keys(spStuck).length"), 0, "nothing set aside");
  /* what each person last had on screen, for their own part */
  const da = E.stateDigest(a);
  const bCur = JSON.parse(b.ev(`JSON.stringify(state.curResults.filter(function(r){ return r.dataPointId === "dp_2026_1" && r.kind === "level"; }).map(function(r){ return [r.pupilId, r.subjectId, r.value]; }).sort())`));
  a.close(); b.close();
  ["CurriculumResults:CurKey","Results:ResultKey","StatementMarks:MarkKey","PathwayLog:Title","Pupils:Title","Settings:Title"].forEach((x) => {
    const [l, c] = x.split(":"); assert.deepStrictEqual(dupKeys(sp, l, c), [], "duplicates in " + l);
  });
  const t = await E.openSlt(sp);
  const fresh = E.stateDigest(t);
  /* SLT's view: everything outside the teacher's pupils matches; the teacher's own levels match theirs */
  const notB = (arr) => arr.filter((x) => !bPairs[x.pupilId] && !bPairs[x.id]);
  assert.deepStrictEqual(notB(fresh.curResults), notB(da.curResults), "levels match SLT's screen");
  assert.deepStrictEqual(notB(fresh.results), notB(da.results), "results match SLT's screen");
  /* a framework row with nothing left on it isn't stored (the same as having none) */
  const fwOf = (d) => d.fwMarks.filter((x) => !bPairs[x.pupilId] && x.marks !== "[]");
  assert.deepStrictEqual(fwOf(fresh), fwOf(da), "sign-offs match");
  assert.deepStrictEqual(fresh.pathwayLogs, da.pathwayLogs, "AAA log matches");
  assert.deepStrictEqual(fresh.pupils.map((p) => p.name), da.pupils.map((p) => p.name), "names match");
  const fB = JSON.parse(t.ev(`JSON.stringify(state.curResults.filter(function(r){ return r.dataPointId === "dp_2026_1" && r.kind === "level" && ${JSON.stringify(Object.keys(bPairs))}.indexOf(r.pupilId) >= 0; }).map(function(r){ return [r.pupilId, r.subjectId, r.value]; }).sort())`));
  const bOwn = bCur.filter((x) => bPairs[x[0]] && bPairs[x[0]][x[1]]);
  const fOwn = fB.filter((x) => bPairs[x[0]] && bPairs[x[0]][x[1]]);
  assert.deepStrictEqual(fOwn, bOwn, "the teacher's levels match their screen");
  t.close();
  return {closes, runs:sp ? 0 : 0};
}
(async () => {
  const seeds = process.argv[2] ? process.argv[2].split(",").map(Number) : [1, 2, 3];
  const rounds = +(process.argv[3] || 25);
  let fail = 0;
  for(const s of seeds){
    const t0 = Date.now();
    try { const r = await run(s, rounds); console.log("PASS  fuzz seed " + s + " (" + rounds + " rounds, " + r.closes + " tab closes) " + (Date.now() - t0) + "ms"); }
    catch(e){ fail++; console.log("FAIL  fuzz seed " + s + "\n      " + String(e && e.message || e).split("\n").slice(0, 16).join("\n      ")); }
  }
  process.exit(fail ? 1 : 0);
})();
