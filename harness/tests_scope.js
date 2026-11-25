/* Staff entry scope, the class list and staff subject lists in pieces, and calculations.
   Run: TRACKER_DIR=../out/current node tests_scope.js [filter] */
"use strict";
const E = require("./env");
const L = E.L;
const assert = require("assert");
const tests = [];
function test(name, fn){ tests.push({name, fn}); }
async function saveNow(t){
  await t.ev("(function(){ window.__saveDone = false; flushAutoSave().then(function(){ window.__saveDone = true; }, function(){ window.__saveDone = true; }); })()");
  await L.until(() => t.ev("window.__saveDone === true && !autoInFlight"), 60000);
}
async function saveUntilClean(t){ for(let i = 0; i < 6; i++){ t.ev("if(retryTimer){ clearTimeout(retryTimer); retryTimer = null; }"); await saveNow(t); await L.settle(30); if(!t.ev("dirty")) return true; } return !t.ev("dirty"); }
function setting(sp, k){ const it = sp.lists.Settings.find((x) => x.Title === k); return it ? it.SettingValue : undefined; }

/* expected scope, worked out here from the made-up school, independently of the app */
function expectedScope(model, staffId){
  const s = model.staff.find((x) => x.id === staffId);
  const split = (v) => String(v || "").split(/[,;]+/).map((x) => x.trim()).filter(Boolean);
  const ys = split(s.years).map((y) => y.replace(/[^0-9]/g, "")), gs = split(s.groups).map((g) => g.toLowerCase());
  const base = (p) => (!ys.length && !gs.length) || ys.indexOf(String(p.year)) >= 0 || gs.indexOf(String(p.group || "").toLowerCase()) >= 0;
  const pairs = {};
  model.pupils.forEach((p) => { if(base(p)) s.subjects.forEach((sid) => { (pairs[p.id] = pairs[p.id] || {})[sid] = true; }); });
  Object.keys(model.hidden).forEach((k) => { if(k.indexOf("sx:" + staffId + "|") === 0){ const parts = k.slice(3).split("|"); (pairs[parts[1]] = pairs[parts[1]] || {})[parts[2]] = true; } });
  return pairs;
}

test("Staff entry: each teacher sees exactly their pupils and subjects", async () => {
  const site = await E.seededSite();
  for(const sid of ["st_101", "st_104", "st_105", "st_108", "st_113"]){
    const t = await E.openStaff(site.sp, sid);
    const got = JSON.parse(t.ev("JSON.stringify(entryScopeIds.pairs)"));
    const want = expectedScope(site.model, sid);
    const norm = (o) => Object.keys(o).sort().map((k) => k + ":" + Object.keys(o[k]).sort().join(","));
    assert.deepStrictEqual(norm(got), norm(want), sid + ": pairs");
    assert.strictEqual(t.ev("state.pupils.length"), Object.keys(want).length, sid + ": pupils shown");
    assert.strictEqual(t.ev("new Set(state.pupils.map(function(p){ return p.id; })).size"), t.ev("state.pupils.length"), sid + ": no pupil twice");
    t.close();
  }
});

test("Staff entry: a change outside the teacher's scope is refused at the box and never written", async () => {
  const site = await E.seededSite();
  const t = await E.openStaff(site.sp, "st_104");
  const before = JSON.stringify(site.sp.lists.CurriculumResults.length);
  /* a pupil in scope, in a subject they aren't paired for; a pupil not in scope at all; a closed drop */
  const out = t.ev(`(function(){
    const P = entryScopeIds.pairs, pid = Object.keys(P)[0];
    const other = state.subjects.filter(function(s){ return !P[pid][s.id]; })[0].id;
    const r1 = setCurResult(pid, other, "dp_2026_1", "level", "4D");
    const r2 = setCurResult("pu_9999", Object.keys(P[pid])[0], "dp_2026_1", "level", "4D");
    const r3 = setCurResult(pid, Object.keys(P[pid])[0], "dp_2026_0", "level", "4D");
    return [r1, r2, r3];
  })()`);
  assert.deepStrictEqual(Array.from(out), [false, false, false]);
  /* even a record pushed straight into the data is filtered out of what is sent */
  t.ev(`state.curResults.push({id:"cr_x", pupilId:"pu_1149", subjectId:"su_maths", dataPointId:"dp_2026_1", kind:"level", value:"9S"}); markDirty();`);
  await saveUntilClean(t);
  assert.ok(!site.sp.lists.CurriculumResults.some((x) => x.Title === "cr_x"), "out-of-scope record not written");
  assert.ok(!site.sp.lists.Settings.some((x) => /^roster|^staff_/.test(x.Title) && x.Modified), "Settings untouched");
  t.close();
});

test("Staff entry writes nothing to Settings, Pupils or any list outside its five", async () => {
  const site = await E.seededSite();
  const snap = JSON.stringify(["Settings","Pupils","Subjects","Assessments","DataDrops","Baselines","Qualifications","Frameworks"].map((n) => site.sp.lists[n]));
  const t = await E.openStaff(site.sp, "st_101");
  t.ev(`(function(){ const P = entryScopeIds.pairs; Object.keys(P).slice(0, 10).forEach(function(pid){ setCurResult(pid, Object.keys(P[pid])[0], "dp_2026_1", "level", "3D"); }); })()`);
  assert.ok(await saveUntilClean(t));
  t.close();
  assert.strictEqual(JSON.stringify(["Settings","Pupils","Subjects","Assessments","DataDrops","Baselines","Qualifications","Frameworks"].map((n) => site.sp.lists[n])), snap);
});

test("class list: SLT writes its count and fingerprint; Staff entry reads only a whole list", async () => {
  const site = await E.seededSite();
  const sp = site.sp;
  const slt = await E.openSlt(sp);
  await L.until(() => setting(sp, "roster_meta") != null && !slt.ev("dirty"), 20000);
  slt.close();
  const meta = JSON.parse(setting(sp, "roster_meta"));
  assert.ok(meta.n > 5 && /^[0-9a-f]{8}$/.test(meta.h));
  /* a save stopped part-way: piece 2 is from an older list */
  const p2 = sp.lists.Settings.find((x) => x.Title === "roster_002");
  const keep = p2.SettingValue;
  p2.SettingValue = keep.replace(/[a-z]/, "#");
  let t = await E.openStaff(sp, "st_104");
  /* the fallback reads names and groups from the Pupils list (this site lets staff read it) */
  assert.strictEqual(t.ev("entryRosterState"), "pupils");
  assert.ok(t.ev("state.pupils.length") > 0);
  t.close();
  /* where staff can't read Pupils, the page says the list is being updated, and shows nobody */
  const flow = E.flowFor(sp, {allow:(key, c) => !(key === E.STAFF_PASS && /getbytitle\('Pupils'\)/.test(c.uri))});
  t = await E.openStaff(sp, "st_104", {flow});
  assert.strictEqual(t.ev("state.pupils.length"), 0);
  assert.ok(/being updated/.test(t.ev("entryBlocked()")));
  t.close();
  p2.SettingValue = keep;
  /* leftover pieces from an older, longer list are ignored, then removed by the next SLT open */
  sp.create("Settings", {Title:"roster_" + String(meta.n).padStart(3, "0"), SettingValue:'["old","x"]]'});
  t = await E.openStaff(sp, "st_104");
  assert.strictEqual(t.ev("entryRosterState"), "ok");
  t.close();
  const s2 = await E.openSlt(sp);
  await L.until(() => setting(sp, "roster_" + String(meta.n).padStart(3, "0")) === undefined, 20000);
  s2.close();
});

test("old class lists (no count) still read, including with leftover pieces", async () => {
  const site = await E.seededSite();
  const sp = site.sp;
  assert.strictEqual(setting(sp, "roster_meta"), undefined, "41.26 data has no count");
  sp.create("Settings", {Title:"roster_" + String(sp.lists.Settings.filter((x) => /^roster_\d{3}$/.test(x.Title)).length).padStart(3, "0"), SettingValue:"[\"left\",\"over\"]]"});
  const t = await E.openStaff(sp, "st_104");
  assert.strictEqual(t.ev("entryRosterState"), "trimmed");
  assert.ok(t.ev("state.pupils.length") > 0);
  t.close();
});

test("long staff subject lists: a shortened list never picks up old subjects", async () => {
  const site = await E.seededSite();
  const sp = site.sp;
  const slt = await E.openSlt(sp);
  /* give st_101 a long list, then a shorter (still long) one */
  slt.ev(`(function(){
    for(let i = 0; i < 40; i++) state.subjects.push({id:"su_extrasubject" + i, name:"Extra subject " + i, active:true, years:"", order:20 + i});
    const s = byId(state.staff, "st_101"); s.subjects = state.subjects.map(function(x){ return x.id; }); markDirty(); })()`);
  assert.ok(await saveUntilClean(slt));
  const nPieces = sp.lists.Settings.filter((x) => /^stsub_st_101_\d{3}$/.test(x.Title)).length;
  assert.ok(nPieces >= 3, "a list in several pieces (" + nPieces + ")");
  slt.ev(`(function(){ const s = byId(state.staff, "st_101"); s.subjects = state.subjects.slice(0, 30).map(function(x){ return x.id; }); markDirty(); })()`);
  assert.ok(await saveUntilClean(slt));
  slt.close();
  const after = sp.lists.Settings.filter((x) => /^stsub_st_101_\d{3}$/.test(x.Title)).length;
  assert.ok(after <= nPieces, "no extra pieces");
  /* a piece left over from the longer list (a save that stopped before removing it) */
  sp.create("Settings", {Title:"stsub_st_101_" + String(after).padStart(3, "0"), SettingValue:"|extrasubject35|extrasubject36|extrasubject37"});
  const t = await E.openStaff(sp, "st_101");
  assert.strictEqual(t.ev("entryMeRec.subjects.length"), 30, "exactly the thirty subjects");
  t.close();
  const s3 = await E.openSlt(sp);
  assert.strictEqual(s3.ev("byId(state.staff, 'st_101').subjects.length"), 30, "SLT sees thirty too");
  await L.until(() => setting(sp, "stsub_st_101_" + String(after).padStart(3, "0")) === undefined, 20000);
  s3.close();
  /* pieces from two saves (mixed): Staff entry refuses rather than guess */
  if(after > 1){
    const p1 = sp.lists.Settings.find((x) => x.Title === "stsub_st_101_001");
    p1.SettingValue = "su_maths|" + p1.SettingValue;
    const t2 = await E.openStaff(sp, "st_101");
    assert.ok(t2.ev("!!entryMeRec.damaged"));
    assert.ok(/subject list is being updated/.test(t2.ev("entryBlocked()")));
    t2.close();
  }
});

test("BTEC pupils in a mixed GCSE/BTEC class: one status everywhere, judged by grade", async () => {
  const site = await E.seededSite();
  const t = await E.openSlt(site.sp);
  const res = JSON.parse(t.ev(`(function(){
    const out = [];
    const su = byId(state.subjects, "su_science"), dp = latestStartedDrop(), idx = curIndex();
    state.pupils.filter(function(p){ return p.year >= 10 && p.year <= 11; }).forEach(function(p){
      const qf = qualForSubject(p.id, "su_science", dp.id);
      const S = subjStatus(p, su, idx);
      const row = subjectRows(su, null, idx).filter(function(r){ return r.p === p; })[0];
      out.push({p:p.id, q:!!qf, st:S.st, row:row ? row.status : null, qual:!!S.qual, conc:curConcerns(p, idx).filter(function(c){ return c.su.id === "su_science"; }).map(function(c){ return c.status; })});
    });
    return JSON.stringify(out);
  })()`));
  const btec = res.filter((r) => r.q), gcse = res.filter((r) => !r.q);
  assert.ok(btec.length >= 3 && gcse.length >= 3, "a mixed class");
  btec.forEach((r) => { assert.strictEqual(r.st, r.row, "status matches the Curriculum page for " + r.p); assert.ok(r.qual); });
  gcse.forEach((r) => assert.ok(!r.qual));
  /* a concern on a BTEC pupil only when their grade went down or they are at risk */
  btec.forEach((r) => { if(r.conc.length) assert.ok(["well","behind"].indexOf(r.st) >= 0); });
  t.close();
});

test("qualification grade status: down = well behind, same = on track, up = ahead; no grade = status", async () => {
  const site = await E.seededSite();
  const t = await E.openSlt(site.sp);
  const out = JSON.parse(t.ev(`(function(){
    const p = state.pupils.filter(function(p){ return p.year === 10; })[0], su = byId(state.subjects, "su_science");
    state.qualResults = state.qualResults.filter(function(r){ return r.pupilId !== p.id; });
    const d = orderedDataPoints(), a = d[d.length - 3].id, b = d[d.length - 2].id, c = d[d.length - 1].id;
    const set = function(dp, st, g){ setQualResult(p.id, "q_btecsci", dp, {status:st, grade:g}); };
    const S = function(dp){ return subjStatus(p, su, null, byId(state.settings.dataPoints, dp)).st; };
    const r = {};
    set(a, "atrisk", ""); r.atriskNoGrade = S(a);
    set(a, "ontrack", ""); r.ontrackNoGrade = S(a);
    set(a, "ontrack", "Level 1 Merit"); r.oneGrade = S(a);
    set(b, "ontrack", "Level 1 Pass"); r.down = S(b);
    set(c, "ontrack", "Level 2 Pass"); r.up = S(c);
    set(c, "ontrack", "Level 1 Pass"); r.same = S(c);
    set(c, "atrisk", "Level 1 Pass"); r.sameAtRisk = S(c);
    set(c, "withdrawn", "Level 1 Pass"); r.withdrawnUsesLevels = !subjStatus(p, su, null, byId(state.settings.dataPoints, c)).qual;
    return JSON.stringify(r);
  })()`));
  assert.deepStrictEqual(out, {atriskNoGrade:"behind", ontrackNoGrade:"ontrack", oneGrade:"ontrack", down:"well", up:"ahead", same:"ontrack", sameAtRisk:"behind", withdrawnUsesLevels:true});
  t.close();
});

test("Data checks: no 'no result this year' for a subject a BTEC stands in for", async () => {
  const site = await E.seededSite();
  const t = await E.openSlt(site.sp);
  const bad = t.ev(`(function(){
    const st = qualityChecks().filter(function(s){ return s.id === "stale"; })[0];
    return st.items.filter(function(it){ const pid = it.pid, sid = it.key.split("|")[1]; return !!qualForSubject(pid, sid, latestStartedDrop().id); }).length;
  })()`);
  assert.strictEqual(bad, 0);
  t.close();
});

test("Enter levels: a box saves to the drop it was drawn for, even if the menu changed", async () => {
  const site = await E.seededSite();
  const t = await E.openSlt(site.sp);
  const r = t.ev(`(function(){
    switchTab("curentry");
    const d = document.getElementById("ceDrop"); d.value = "dp_2026_1"; renderCurEntry();
    const el = document.querySelector('#ceTable .lvlin');
    const pid = el.getAttribute("data-pid"), sid = el.getAttribute("data-sid");
    d.value = "dp_2026_0";             /* the menu moves on before the box is left */
    el.value = "9S"; commitCurInput(el);
    return [(curGet(curIndex(), pid, sid, "dp_2026_1", "level") || {}).value, (curGet(curIndex(), pid, sid, "dp_2026_0", "level") || {}).value === "9S"];
  })()`);
  assert.strictEqual(r[0], "9S"); assert.strictEqual(r[1], false);
  t.close();
});

test("Staff entry AAA update: saved to the log, and SLT's next open puts the pathway on the Pupils list", async () => {
  const site = await E.seededSite();
  const sp = site.sp;
  const t = await E.openStaff(sp, "st_110");
  const pid = t.ev("state.pupils.filter(function(p){ return p.year >= 10 && p.year <= 11; })[0] ? state.pupils.filter(function(p){ return p.year >= 10 && p.year <= 11; })[0].id : state.pupils[0].id");
  const was = sp.lists.Pupils.find((x) => x.Title === pid).Pathway;
  const to = was === "attend" ? "attain" : "attend";
  t.ev(`(function(){ state.pathwayLogs.push({id:uid("lg"), pupilId:${JSON.stringify(pid)}, ts:"2026-11-24T10:00", from:${JSON.stringify(was || "")}, to:${JSON.stringify(to)}, reason:"review", notes:"made-up note", action:"", staff:"T", type:"staff-change"}); markDirty(); })()`);
  assert.ok(await saveUntilClean(t));
  t.close();
  assert.ok(sp.lists.PathwayLog.some((x) => x.PupilId === pid && x.ToPathway === to), "log saved");
  assert.strictEqual(sp.lists.Pupils.find((x) => x.Title === pid).Pathway, was, "Staff entry never writes the Pupils list");
  const s2 = await E.openSlt(sp);
  assert.strictEqual(s2.ev(`byId(state.pupils, ${JSON.stringify(pid)}).pathway`), to, "SLT sees the new pathway");
  await L.until(() => sp.lists.Pupils.find((x) => x.Title === pid).Pathway === to, 20000);
  s2.close();
});

test("two qualifications for one subject: the one in progress is judged and gets the grade box", async () => {
  const site = await E.seededSite();
  const t = await E.openSlt(site.sp);
  const r = JSON.parse(t.ev(`(function(){
    const su = state.subjects.filter(function(s){ return s.name === "Food Technology"; })[0];
    state.quals.push({id:"q_hc1", name:"BTEC Home Cooking Skills", type:"btec", board:"Pearson", level:"L1", subjectId:su.id, units:[], active:true});
    state.quals.push({id:"q_hc2", name:"BTEC Home Cooking Skills", type:"btec", board:"Pearson", level:"L2", subjectId:su.id, units:[], active:true});
    const ps = state.pupils.filter(function(p){ return p.year >= 10 && p.year <= 11; }).slice(0, 6);
    ps.forEach(function(p){ state.qualResults = state.qualResults.filter(function(x){ return x.pupilId !== p.id; }); });
    const out = {};
    const pick = function(p){ const f = qualForSubject(p.id, su.id, "dp_2026_1"); return f ? f.q.id : null; };
    /* a: Level 1 achieved last July, Level 2 now at risk */
    setQualResult(ps[0].id, "q_hc1", "dp_2025_5", {status:"achieved", grade:"Merit"});
    setQualResult(ps[0].id, "q_hc2", "dp_2026_0", {status:"ontrack", grade:"Pass"});
    setQualResult(ps[0].id, "q_hc2", "dp_2026_1", {status:"atrisk", grade:"Pass"});
    out.a = pick(ps[0]); out.aStatus = subjStatus(ps[0], su).st;
    /* b: both being worked on, both updated this drop: the higher level */
    setQualResult(ps[1].id, "q_hc1", "dp_2026_1", {status:"ontrack"}); setQualResult(ps[1].id, "q_hc2", "dp_2026_1", {status:"ontrack"});
    out.b = pick(ps[1]);
    /* c: on Level 1, enrolled on Level 2 but not started */
    setQualResult(ps[2].id, "q_hc1", "dp_2026_0", {status:"ontrack"}); setQualResult(ps[2].id, "q_hc2", "dp_2026_1", {status:"notstarted"});
    out.c = pick(ps[2]);
    /* d: only Level 1 */
    setQualResult(ps[3].id, "q_hc1", "dp_2026_1", {status:"ontrack"});
    out.d = pick(ps[3]);
    /* e: both finished: the most recent */
    setQualResult(ps[4].id, "q_hc2", "dp_2025_2", {status:"achieved", grade:"Pass"}); setQualResult(ps[4].id, "q_hc1", "dp_2025_5", {status:"notach"});
    out.e = pick(ps[4]);
    /* f: Level 1 still marked on track from last year, Level 2 updated since */
    setQualResult(ps[5].id, "q_hc1", "dp_2025_4", {status:"ontrack"}); setQualResult(ps[5].id, "q_hc2", "dp_2026_0", {status:"started"});
    out.f = pick(ps[5]);
    /* the grade box belongs to Level 2 for pupil a: on Enter levels before GCSE years, on the
       subject's GCSE page (Qualifications) from them (V42.2) */
    let box;
    if(usesGcse(ps[0], currentAY(), su.id)){
      gcseGo(su.id, "dp_2026_1", "", "");
      box = document.querySelector('#qeTable [data-qualgrade^="' + ps[0].id + '|"]');
    } else {
      switchTab("curentry");
      document.getElementById("ceSubject").value = su.id; document.getElementById("ceDrop").value = "dp_2026_1";
      renderCurEntry();
      box = document.querySelector('#ceTable [data-qualgrade^="' + ps[0].id + '|"]');
    }
    out.box = box ? box.getAttribute("data-qualgrade").split("|")[1] : null;
    return JSON.stringify(out);
  })()`));
  assert.strictEqual(r.a, "q_hc2", "finished Level 1, now on Level 2");
  assert.strictEqual(r.aStatus, "behind", "judged by Level 2 (at risk)");
  assert.strictEqual(r.b, "q_hc2", "both live, same drop: higher level");
  assert.strictEqual(r.c, "q_hc1", "Level 2 not started yet");
  assert.strictEqual(r.d, "q_hc1", "only one qualification");
  assert.strictEqual(r.e, "q_hc1", "both finished: the most recent");
  assert.strictEqual(r.f, "q_hc2", "the one updated most recently");
  assert.strictEqual(r.box, "q_hc2", "the grade box is Level 2's");
  t.close();
});

test("the level box takes FLS1 to FLS10", async () => {
  const site = await E.seededSite();
  const t = await E.openStaff(site.sp, "st_104");
  const r = JSON.parse(t.ev(`(function(){
    switchTab("curentry"); renderCurEntry();
    const els = document.querySelectorAll("#ceTable .lvlin");
    const out = {max:els[0].getAttribute("maxlength"), vals:[]};
    ["FLS3", "fls10", "F7"].forEach(function(v, i){ els[i].value = v; commitCurInput(els[i]);
      out.vals.push((curGet(curIndex(), els[i].getAttribute("data-pid"), els[i].getAttribute("data-sid"), "dp_2026_1", "level") || {}).value); });
    return JSON.stringify(out);
  })()`));
  assert.ok(+r.max >= 5, "box allows five characters");
  assert.deepStrictEqual(r.vals, ["FLS3", "FLS10", "FLS7"]);
  await saveUntilClean(t);
  t.close();
  assert.ok(site.sp.lists.CurriculumResults.some((x) => x.CurValue === "FLS10" && x.DataDropId === "dp_2026_1"), "FLS10 reached SharePoint");
});

(async () => {
  const filter = process.argv[2] ? new RegExp(process.argv[2], "i") : null;
  let pass = 0, fail = 0;
  for(const tc of tests){
    if(filter && !filter.test(tc.name)) continue;
    const t0 = Date.now();
    try { await tc.fn(); pass++; console.log("PASS  " + tc.name + "  (" + (Date.now() - t0) + "ms)"); }
    catch(e){ fail++; console.log("FAIL  " + tc.name + "\n      " + String(e && e.message || e).split("\n").slice(0, 12).join("\n      ")); }
  }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
