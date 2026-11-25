/* Data-integrity tests: saving and loading against the fake SharePoint.
   Run: TRACKER_DIR=../out/current node tests_save.js [filter] */
"use strict";
const E = require("./env");
const L = E.L;
const assert = require("assert");
const tests = [];
function test(name, fn){ tests.push({name, fn}); }

async function saveNow(t){
  await t.ev("(function(){ window.__saveErr = null; window.__saveDone = false; flushAutoSave().then(function(){ window.__saveDone = true; }, function(e){ window.__saveErr = String(e); window.__saveDone = true; }); })()");
  await L.until(() => t.ev("window.__saveDone === true && !autoInFlight"), 60000);
  return t.ev("window.__saveErr");
}
async function saveUntilClean(t, n){
  for(let i = 0; i < (n || 6); i++){
    t.ev("if(retryTimer){ clearTimeout(retryTimer); retryTimer = null; }");
    await saveNow(t);
    await L.settle(30);
    if(!t.ev("dirty")) return true;
  }
  return !t.ev("dirty");
}
function spItems(sp, list, pred){ return sp.lists[list].filter(pred || (() => true)); }
function keyCount(sp, list, col){ const m = {}; sp.lists[list].forEach((x) => { const k = String(x[col]).toLowerCase(); m[k] = (m[k] || 0) + 1; }); return m; }
function dupKeys(sp, list, col){ const m = keyCount(sp, list, col); return Object.keys(m).filter((k) => m[k] > 1); }
async function reopenDigest(sp){
  const t = await E.openSlt(sp);
  const d = E.stateDigest(t);
  const pend = t.ev("(sendPending()||[]).length");
  t.close();
  return {d, pend};
}

/* ---------------------------------------------------------------- */
test("load: data saved by 41.26 loads with nothing waiting to send", async () => {
  const site = await E.seededSite();
  const t = await E.openSlt(site.sp);
  assert.strictEqual(t.ev("state.pupils.length"), 150);
  assert.strictEqual(t.ev("state.curResults.length"), site.sp.lists.CurriculumResults.length);
  const pend = Array.from(t.ev("(sendPending()||[]).map(function(o){ return o.list + '|' + o.op + '|' + o.key; })"));
  /* V42 adds the class list's count and fingerprint (roster_meta) and the same for long staff subject lists: nothing else */
  assert.deepStrictEqual(pend.filter((k) => !/^Settings\|upsert\|(roster_meta|staff_)/.test(k)), [], "only the class-list check may be waiting: " + JSON.stringify(pend.slice(0, 8)));
  const before = JSON.stringify(site.sp.lists.CurriculumResults);
  await L.until(() => !t.ev("dirty") && !t.ev("autoInFlight") && (t.ev("(sendPending()||[]).length") === 0), 20000);
  assert.strictEqual(JSON.stringify(site.sp.lists.CurriculumResults), before, "no results were touched");
  assert.deepStrictEqual(t.errors, []);
  t.close();
  const t2 = await E.openSlt(site.sp);
  assert.strictEqual(t2.ev("(sendPending()||[]).length"), 0, "a second open has nothing waiting");
  await L.settle(1700);
  assert.ok(!t2.ev("dirty"), "and saves nothing by itself");
  t2.close();
});

test("round trip: edits of every kind save and reload identically", async () => {
  const site = await E.seededSite();
  const t = await E.openSlt(site.sp);
  t.ev(`(function(){
    const p = state.pupils[10], q = state.pupils[11];
    setCurResult(p.id, "su_english", "dp_2026_1", "level", "5D");
    setCurResult(q.id, "su_maths", "dp_2026_1", "level", "3S");
    setCurResult(q.id, "su_maths", "dp_2026_0", "level", "");
    setResult(p.id, "as_mtest", "dp_2026_1", "555");
    setBaseline(q.id, "su_maths", "2E", "2024-09-01");
    fwSet(p.id, "fw_eng", "fw_eng_3_1", 3);
    fwSet(q.id, "fw_ma", "fw_ma_1_2", 2);
    p.name = "Renamed Pupil"; markDirty();
  })()`);
  const want = E.stateDigest(t);
  assert.ok(await saveUntilClean(t), "should save");
  t.close();
  const r = await reopenDigest(site.sp);
  assert.deepStrictEqual(r.d, want);
  assert.strictEqual(r.pend, 0, "nothing waiting after reload");
});

test("duplicate items for one key (no unique column): an edit is saved, and clearing it leaves no ghost", async () => {
  const site = await E.seededSite();
  const sp = site.sp;
  /* a site whose CurKey and Results ResultKey weren't made unique: a retried save once added a second copy */
  sp.noUnique = {CurriculumResults:true, Results:true};
  const orig = sp.lists.CurriculumResults.find((x) => x.DataDropId === "dp_2026_0" && x.Kind === "level");
  const copy = Object.assign({}, orig); delete copy.Id; delete copy.ID; copy.Title = orig.Title + "x";
  sp.create("CurriculumResults", copy);
  const r0 = sp.lists.Results[5]; const rc = Object.assign({}, r0); delete rc.Id; delete rc.ID; rc.Title = r0.Title + "x";
  sp.create("Results", rc);
  let t = await E.openSlt(sp);
  t.ev(`setCurResult(${JSON.stringify(orig.PupilId)}, ${JSON.stringify(orig.SubjectId)}, "dp_2026_0", "level", "9S")`);
  t.ev(`setResult(${JSON.stringify(r0.PupilId)}, ${JSON.stringify(r0.AssessmentId)}, ${JSON.stringify(r0.DataDropId)}, "999")`);
  const shown = t.ev(`curGet(curIndex(), ${JSON.stringify(orig.PupilId)}, ${JSON.stringify(orig.SubjectId)}, "dp_2026_0", "level").value`);
  assert.strictEqual(shown, "9S", "the screen shows what was typed");
  assert.strictEqual(t.ev(`resultFor(${JSON.stringify(r0.PupilId)}, ${JSON.stringify(r0.AssessmentId)}, ${JSON.stringify(r0.DataDropId)}).value`), "999");
  assert.ok(await saveUntilClean(t));
  t.close();
  t = await E.openSlt(sp);
  assert.strictEqual(t.ev(`curGet(curIndex(), ${JSON.stringify(orig.PupilId)}, ${JSON.stringify(orig.SubjectId)}, "dp_2026_0", "level").value`), "9S", "the edit survives a reload");
  assert.strictEqual(t.ev(`resultFor(${JSON.stringify(r0.PupilId)}, ${JSON.stringify(r0.AssessmentId)}, ${JSON.stringify(r0.DataDropId)}).value`), "999", "the result edit survives a reload");
  /* now clear it: no older copy may come back */
  t.ev(`setCurResult(${JSON.stringify(orig.PupilId)}, ${JSON.stringify(orig.SubjectId)}, "dp_2026_0", "level", "")`);
  assert.ok(await saveUntilClean(t));
  t.close();
  t = await E.openSlt(sp);
  assert.strictEqual(t.ev(`curGet(curIndex(), ${JSON.stringify(orig.PupilId)}, ${JSON.stringify(orig.SubjectId)}, "dp_2026_0", "level")`), null, "a cleared level stays cleared");
  t.close();
});

test("changing a result's kind (exam result -> GCSE grade now) keeps it", async () => {
  const site = await E.seededSite();
  const t = await E.openSlt(site.sp);
  const id = t.ev(`(function(){ const p = state.pupils.filter(function(p){ return p.year === 11; })[0];
    setCurResult(p.id, "su_english", "dp_2025_3", "actual", "5");
    return p.id; })()`);
  assert.ok(await saveUntilClean(t));
  const rid = t.ev(`state.curResults.filter(function(r){ return r.pupilId === ${JSON.stringify(id)} && r.kind === "actual"; })[0].id`);
  t.ev(`qualityFix("actual-to-pred", ${JSON.stringify(rid)}, true); markDirty();`);
  assert.ok(await saveUntilClean(t), "the change saves");
  assert.strictEqual(t.ev("Object.keys(spStuck).length"), 0, "nothing set aside");
  t.close();
  const t2 = await E.openSlt(site.sp);
  assert.strictEqual(t2.ev(`(curGet(curIndex(), ${JSON.stringify(id)}, "su_english", "dp_2025_3", "predicted") || {}).value`), "5", "kept as GCSE grade now");
  assert.strictEqual(t2.ev(`curGet(curIndex(), ${JSON.stringify(id)}, "su_english", "dp_2025_3", "actual")`), null);
  t2.close();
});

test("a batch whose answer is lost (502 after it ran) leaves no duplicates and nothing set aside", async () => {
  const site = await E.seededSite();
  const sp = site.sp;
  let armed = false;
  const flow = E.flowFor(sp, {faults:(run) => { if(armed && run.calls.some((c) => c.method === "POST")){ armed = false; return {when:"after", status:502}; } }});
  sp.noUnique = {PathwayLog:true};      /* PathwayLog has no key column: only Title can stop a copy */
  const t = await E.openSlt(sp, {flow});
  t.ev(`(function(){ const ps = state.pupils.slice(20, 40);
    ps.forEach(function(p, i){ setCurResult(p.id, "su_art", "dp_2026_1", "level", "4D"); });
    state.pathwayLogs.push({id:uid("lg"), pupilId:ps[0].id, ts:"2026-11-24T10:00", from:"", to:"attain", reason:"r", notes:"n", action:"", staff:"T", type:"update"});
    markDirty(); })()`);
  armed = true;
  await saveUntilClean(t);
  assert.strictEqual(t.ev("Object.keys(spStuck).length"), 0, "nothing should be set aside: " + JSON.stringify(t.ev("Object.keys(spStuck)")));
  assert.ok(!t.ev("dirty"), "everything saved");
  t.close();
  assert.deepStrictEqual(dupKeys(sp, "CurriculumResults", "CurKey"), []);
  assert.deepStrictEqual(dupKeys(sp, "PathwayLog", "Title"), [], "no duplicate AAA log entries");
  const r = await reopenDigest(sp);
  assert.strictEqual(r.pend, 0);
});

test("a flow run stopped part-way (2-minute limit) is finished by the retry, with no duplicates", async () => {
  const site = await E.seededSite();
  const sp = site.sp;
  let armed = 0;
  const flow = E.flowFor(sp, {faults:(run) => { if(armed && run.calls.length > 10){ armed--; return {when:"midway", at:7, status:504}; } }});
  const t = await E.openSlt(sp, {flow});
  t.ev(`(function(){ state.pupils.slice(40, 100).forEach(function(p, i){ setCurResult(p.id, "su_music", "dp_2026_1", "level", ["3E","3D","3S"][i % 3]); }); })()`);
  const want = E.stateDigest(t);
  armed = 1;
  await saveUntilClean(t, 10);
  assert.ok(!t.ev("dirty"));
  t.close();
  assert.deepStrictEqual(dupKeys(sp, "CurriculumResults", "CurKey"), []);
  const r = await reopenDigest(sp);
  assert.deepStrictEqual(r.d.curResults.length, want.curResults.length);
  assert.strictEqual(r.pend, 0);
});

test("SLT renaming a pupil does not undo a level Staff entry saved meanwhile", async () => {
  const site = await E.seededSite();
  const sp = site.sp;
  const slt = await E.openSlt(sp);
  const staff = await E.openStaff(sp, "st_104");
  /* a pupil and subject in this teacher's scope that already has a level in the open drop, so SLT holds an older value */
  const pair = staff.ev(`(function(){ const idx = curIndex(); const P = entryScopeIds.pairs;
    for(const pid of Object.keys(P)) for(const sid of Object.keys(P[pid])) if(curGet(idx, pid, sid, "dp_2026_1", "level")) return [pid, sid];
    return null; })()`);
  assert.ok(pair, "test needs an existing level");
  const pid = pair[0], sub = pair[1];
  staff.ev(`setCurResult(${JSON.stringify(pid)}, ${JSON.stringify(sub)}, "dp_2026_1", "level", "7S")`);
  assert.ok(await saveUntilClean(staff), "staff save");
  /* SLT, opened before, renames that pupil: every one of their records gets the new name */
  slt.ev(`(function(){ const p = byId(state.pupils, ${JSON.stringify(pid)}); p.name = "New Name"; markDirty(); })()`);
  assert.ok(await saveUntilClean(slt), "SLT save");
  slt.close(); staff.close();
  const t = await E.openSlt(sp);
  assert.strictEqual(t.ev(`(curGet(curIndex(), ${JSON.stringify(pid)}, ${JSON.stringify(sub)}, "dp_2026_1", "level") || {}).value`), "7S", "the staff member's level is still there");
  assert.strictEqual(t.ev(`byId(state.pupils, ${JSON.stringify(pid)}).name`), "New Name");
  t.close();
});

test("two people signing off different statements for the same pupil keep both", async () => {
  const site = await E.seededSite();
  const sp = site.sp;
  const a = await E.openSlt(sp, {who:"Teacher A"});
  const b = await E.openSlt(sp, {who:"Teacher B"});
  const pid = a.ev("state.fwMarks[0].pupilId");
  a.ev(`fwSet(${JSON.stringify(pid)}, "fw_eng", "fw_eng_4_1", 3)`);
  b.ev(`fwSet(${JSON.stringify(pid)}, "fw_eng", "fw_eng_4_2", 2)`);
  assert.ok(await saveUntilClean(a));
  assert.ok(await saveUntilClean(b));
  a.close(); b.close();
  const t = await E.openSlt(sp);
  assert.strictEqual(t.ev(`(fwGet(${JSON.stringify(pid)}, "fw_eng", "fw_eng_4_1") || {}).s`), 3, "A's sign-off kept");
  assert.strictEqual(t.ev(`(fwGet(${JSON.stringify(pid)}, "fw_eng", "fw_eng_4_2") || {}).s`), 2, "B's sign-off kept");
  t.close();
});

test("clearing the last sign-off on a row keeps a colleague's tick added meanwhile", async () => {
  const site = await E.seededSite();
  const sp = site.sp;
  const a = await E.openSlt(sp, {who:"Teacher A"});
  const pid = a.ev("state.pupils[120].id");
  a.ev(`fwSet(${JSON.stringify(pid)}, "fw_ma", "fw_ma_2_1", 3)`);
  assert.ok(await saveUntilClean(a));
  const b = await E.openSlt(sp, {who:"Teacher B"});
  b.ev(`fwSet(${JSON.stringify(pid)}, "fw_ma", "fw_ma_2_5", 2)`);
  assert.ok(await saveUntilClean(b));
  a.ev(`fwSet(${JSON.stringify(pid)}, "fw_ma", "fw_ma_2_1", null)`);      /* A takes off their only tick */
  assert.ok(await saveUntilClean(a));
  a.close(); b.close();
  const t = await E.openSlt(sp);
  assert.strictEqual(t.ev(`(fwGet(${JSON.stringify(pid)}, "fw_ma", "fw_ma_2_5") || {}).s`), 2, "B's tick kept");
  assert.strictEqual(t.ev(`fwGet(${JSON.stringify(pid)}, "fw_ma", "fw_ma_2_1")`), null, "A's tick gone");
  t.close();
  /* and on its own, clearing the last tick removes the row */
  const c = await E.openSlt(sp);
  c.ev(`fwSet(${JSON.stringify(pid)}, "fw_ma", "fw_ma_2_5", null)`);
  assert.ok(await saveUntilClean(c)); c.close();
  assert.ok(!sp.lists.StatementMarks.some((x) => x.MarkKey === pid + "~fw_ma"), "an empty row is removed");
});

test("two people starting sign-offs for a new pupil at once: the second isn't refused", async () => {
  const site = await E.seededSite();
  const sp = site.sp;
  const a = await E.openSlt(sp, {who:"Teacher A"});
  const b = await E.openSlt(sp, {who:"Teacher B"});
  const pid = a.ev("state.pupils[140].id");
  a.ev(`fwSet(${JSON.stringify(pid)}, "fw_ma", "fw_ma_1_1", 3)`);
  b.ev(`fwSet(${JSON.stringify(pid)}, "fw_ma", "fw_ma_1_3", 1)`);
  assert.ok(await saveUntilClean(a));
  await saveUntilClean(b);
  assert.strictEqual(b.ev("Object.keys(spStuck).length"), 0, "B's sign-off is not set aside");
  a.close(); b.close();
  const t = await E.openSlt(sp);
  assert.strictEqual(t.ev(`(fwGet(${JSON.stringify(pid)}, "fw_ma", "fw_ma_1_1") || {}).s`), 3);
  assert.strictEqual(t.ev(`(fwGet(${JSON.stringify(pid)}, "fw_ma", "fw_ma_1_3") || {}).s`), 1);
  t.close();
});

test("work left unsent in a closed tab is sent later without undoing a colleague's changes", async () => {
  const site = await E.seededSite();
  const sp = site.sp;
  const FDB = require("fake-indexeddb");
  const idb = new FDB.IDBFactory();
  let down = false;
  const flow = E.flowFor(sp, {faults:(run) => down ? {when:"network"} : undefined});
  const a = await E.openSlt(sp, {flow, idb});
  const pid = a.ev("state.pupils[60].id");
  down = true;
  a.ev(`setCurResult(${JSON.stringify(pid)}, "su_history", "dp_2026_1", "level", "6S")`);
  await saveNow(a);
  await L.settle(900);                     /* the browser copy is written */
  const ls = a.lsDump();
  a.close();
  down = false;
  /* meanwhile Staff entry adds and changes levels (it never touches the "last saved" stamp) */
  const s = await E.openStaff(sp, "st_104");
  const spid = s.ev("Object.keys(entryScopeIds.pairs)[0]"), ssub = s.ev(`Object.keys(entryScopeIds.pairs[Object.keys(entryScopeIds.pairs)[0]])[0]`);
  s.ev(`setCurResult(${JSON.stringify(spid)}, ${JSON.stringify(ssub)}, "dp_2026_1", "level", "8E")`);
  assert.ok(await saveUntilClean(s));
  s.close();
  const before = sp.lists.CurriculumResults.length;
  const b = await E.openSlt(sp, {idb, localStorage:ls});
  await L.until(() => !b.ev("dirty") && !b.ev("autoInFlight"), 30000).catch(() => {});
  await saveUntilClean(b);
  b.close();
  const t = await E.openSlt(sp);
  assert.strictEqual(t.ev(`(curGet(curIndex(), ${JSON.stringify(pid)}, "su_history", "dp_2026_1", "level") || {}).value`), "6S", "the unsent change arrived");
  assert.strictEqual(t.ev(`(curGet(curIndex(), ${JSON.stringify(spid)}, ${JSON.stringify(ssub)}, "dp_2026_1", "level") || {}).value`), "8E", "the colleague's level is still there");
  assert.ok(sp.lists.CurriculumResults.length >= before, "nothing was deleted");
  t.close();
});

test("a passing 502 while opening does not drop the curriculum lists (legacy mode)", async () => {
  const site = await E.seededSite();
  let n = 0;
  const flow = E.flowFor(site.sp, {faults:(run) => { n++; if(n === 2 || n === 3) return {when:"before", status:502}; }});
  const t = await E.openSlt(site.sp, {flow});
  assert.ok(!t.ev("spLegacy"), "not in legacy mode");
  assert.ok(t.ev("state.curResults.length") > 1000, "curriculum data loaded");
  t.close();
});

test("a big save waits to be checked; nothing goes until then", async () => {
  const site = await E.seededSite();
  const t = await E.openSlt(site.sp);
  const before = site.sp.flow;
  t.ev(`state.pupils.forEach(function(p){ setCurResult(p.id, "su_re", "dp_2026_1", "level", "2E"); setCurResult(p.id, "su_re", "dp_2026_0", "level", "2E"); setCurResult(p.id, "su_re", "dp_2025_5", "level", "2E"); })`);
  const posts0 = site.sp.lists.CurriculumResults.length;
  await saveNow(t);
  assert.strictEqual(site.sp.lists.CurriculumResults.length, posts0, "nothing sent before confirming");
  assert.ok(t.ev("bigSavePanelShown || !!document.getElementById('sendDlg')"));
  t.ev("bigSaveOK = true");
  assert.ok(await saveUntilClean(t));
  assert.strictEqual(site.sp.lists.CurriculumResults.length, posts0 + 450);
  t.close();
});

test("a colleague's save is picked up after ours (stamp peek)", async () => {
  const site = await E.seededSite();
  const sp = site.sp;
  const a = await E.openSlt(sp, {who:"A"});
  const b = await E.openSlt(sp, {who:"B"});
  const p1 = a.ev("state.pupils[1].id"), p2 = a.ev("state.pupils[2].id");
  b.ev(`setCurResult(${JSON.stringify(p2)}, "su_rs", "dp_2026_1", "level", "1S")`);
  b.ev(`setCurResult(${JSON.stringify(p2)}, "su_re", "dp_2026_1", "level", "1S")`);
  assert.ok(await saveUntilClean(b));
  a.ev(`setCurResult(${JSON.stringify(p1)}, "su_re", "dp_2026_1", "level", "2S")`);
  assert.ok(await saveUntilClean(a));
  await L.until(() => a.ev(`!!curGet(curIndex(), ${JSON.stringify(p2)}, "su_re", "dp_2026_1", "level")`), 15000);
  a.close(); b.close();
});

test("lists over 5,000 items with gaps in the numbering read completely", async () => {
  const site = await E.seededSite();
  const sp = site.sp;
  /* remove a block of items in the middle, so item numbers have gaps */
  sp.lists.CurriculumResults.splice(3000, 2500); sp.reindex("CurriculumResults");
  const n = sp.lists.CurriculumResults.length;
  const t = await E.openSlt(sp);
  assert.strictEqual(t.ev("state.curResults.length"), n);
  t.close();
});

test("list memory: a group remembered as missing is read once it exists (no 30-day wait)", async () => {
  const site = await E.seededSite();
  const remembered = JSON.stringify({at:Date.now() - 3600e3, miss:{"Qualifications":true, "Curriculum framework":false}, pwl:true, legacy:false});
  const t = await E.openSlt(site.sp, {localStorage:{"assessmentTracker.listsKnown":remembered}});
  assert.ok(t.ev("state.quals.length") >= 3, "qualifications loaded");
  assert.ok(t.ev("state.qualResults.length") > 10, "qualification results loaded");
  t.close();
});

test("list memory: a quick open (one flow run) gives the same data as a careful one", async () => {
  const site = await E.seededSite();
  const t1 = await E.openSlt(site.sp);
  const d1 = E.stateDigest(t1); const ls = t1.lsDump(); t1.close();
  const flow = E.flowFor(site.sp);
  const t2 = await E.openSlt(site.sp, {flow, localStorage:{"assessmentTracker.listsKnown":ls["assessmentTracker.listsKnown"]}});
  assert.deepStrictEqual(E.stateDigest(t2), d1);
  assert.ok(flow.runs <= 3, "quick open in " + flow.runs + " flow runs");
  t2.close();
});

test("opening never empties a stored value it can't read (an unknown pathway)", async () => {
  const site = await E.seededSite();
  const it = site.sp.lists.Pupils[7]; it.Pathway = "Pathway from an old import";
  const t = await E.openSlt(site.sp);
  await L.settle(2000);
  const pend = Array.from(t.ev("(sendPending()||[]).filter(function(o){ return o.list === 'Pupils'; }).map(function(o){ return o.key; })"));
  assert.deepStrictEqual(pend, [], "nothing queued for Pupils");
  t.close();
  assert.strictEqual(site.sp.lists.Pupils[7].Pathway, "Pathway from an old import");
});

/* ---------------------------------------------------------------- */
(async () => {
  const filter = process.argv[2] ? new RegExp(process.argv[2], "i") : null;
  let pass = 0, fail = 0; const failed = [];
  for(const tc of tests){
    if(filter && !filter.test(tc.name)) continue;
    const t0 = Date.now();
    try { await tc.fn(); pass++; console.log("PASS  " + tc.name + "  (" + (Date.now() - t0) + "ms)"); }
    catch(e){ fail++; failed.push(tc.name); console.log("FAIL  " + tc.name + "\n      " + String(e && e.message || e).split("\n").slice(0, 14).join("\n      ")); }
  }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
