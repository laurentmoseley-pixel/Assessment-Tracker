/* V42.2: GCSE on the Qualifications page, Enter levels for levels only, the pupil page, curriculum
   statements for pupils who moved onto GCSE, and the export for one data drop.
   Run: TRACKER_DIR=../out/current node tests_gcse.js [filter] */
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
async function saveUntilClean(t){ for(let i = 0; i < 6; i++){ t.ev("if(retryTimer){ clearTimeout(retryTimer); retryTimer = null; }"); await saveNow(t); await L.settle(30); if(!t.ev("dirty")) return true; } return false; }
const SU = (n) => "su_" + n.toLowerCase().replace(/[^a-z]+/g, "").slice(0, 12);

test("GCSE is on the Qualifications page, over the grades already saved, and saves to the same place", async () => {
  const site = await E.seededSite();
  const t = await E.openSlt(site.sp);
  const r = JSON.parse(t.ev(`(function(){
    switchTab("qualentry");
    gcseGo("${SU("English")}", "dp_2026_0", "", "");
    const opts = Array.prototype.map.call(document.getElementById("qeQual").options, function(o){ return [o.value, o.textContent]; });
    const boxes = Array.prototype.slice.call(document.querySelectorAll('#qeTable .lvlin[data-ctx="predicted|dp_2026_0"]'));
    const idx = curIndex();
    const mismatch = boxes.filter(function(b){ const x = curGet(idx, b.getAttribute("data-pid"), b.getAttribute("data-sid"), "dp_2026_0", "predicted"); return b.value !== (x ? x.value : ""); }).length;
    const filled = boxes.filter(function(b){ return b.value; }).length;
    const ay = acYearOf("2026-10-16"), su = byId(state.subjects, "${SU("English")}");
    const want = state.pupils.filter(function(p){ return takesSubject(p, su, ay) && usesGcse(p, ay, su.id); }).map(function(p){ return p.id; }).sort();
    const shown = Array.prototype.map.call(document.querySelectorAll("#qeTable tr[data-cerow]"), function(tr){ return tr.getAttribute("data-cerow"); }).sort();
    /* type a grade now, a target and an exam result for one pupil at the open drop */
    gcseGo("${SU("English")}", "dp_2026_1", "", "");
    const tr = document.querySelector("#qeTable tr[data-cerow]"), pid = tr.getAttribute("data-cerow");
    const g = tr.querySelector('.lvlin[data-ctx="predicted|dp_2026_1"]'), tg = tr.querySelector('.lvlin[data-ctx="target|"]'), ex = tr.querySelector('.lvlin[data-ctx="actual|dp_2026_1"]');
    tg.value = "6"; commitCurInput(tg);
    g.value = "7"; commitCurInput(g);
    ex.value = "u"; commitCurInput(ex);
    const st = tr.querySelector("[data-cest]").textContent;
    const idx2 = curIndex();
    return JSON.stringify({opts:opts, n:boxes.length, filled:filled, mismatch:mismatch, want:want, shown:shown, pid:pid, st:st,
      pred:(curGet(idx2, pid, "${SU("English")}", "dp_2026_1", "predicted") || {}).value, target:(curGet(idx2, pid, "${SU("English")}", "", "target") || {}).value,
      actual:(curGet(idx2, pid, "${SU("English")}", "dp_2026_1", "actual") || {}).value, addHidden:document.querySelector('#tab-qualentry [data-act="qual-add-pupils"]').hidden});
  })()`));
  assert.ok(r.opts.some((o) => o[0] === "gcse:" + SU("English") && o[1] === "GCSE English"), "GCSE English is offered");
  assert.ok(r.opts.some((o) => o[0] === "gcse:*"), "all subjects at once is offered");
  assert.ok(r.opts.some((o) => o[0] === "q_btecsci"), "the qualifications are still there");
  assert.ok(r.n > 5 && r.filled > 5, "grades already saved show in the boxes (" + r.filled + " of " + r.n + ")");
  assert.strictEqual(r.mismatch, 0, "every box shows the stored grade");
  assert.deepStrictEqual(r.shown, r.want, "the pupils on GCSE grades in English, no more, no fewer");
  assert.strictEqual(r.addHidden, true, "no Add pupils for GCSE");
  assert.strictEqual(r.pred, "7"); assert.strictEqual(r.target, "6"); assert.strictEqual(r.actual, "U");
  assert.ok(/Ahead/.test(r.st), "status against target: " + r.st);
  assert.ok(await saveUntilClean(t), "saved");
  t.close();
  const row = (kind, dp) => site.sp.lists.CurriculumResults.find((x) => x.CurKey === r.pid + "_" + SU("English") + "_" + dp + "_" + kind);
  assert.strictEqual((row("predicted", "dp_2026_1") || {}).CurValue, "7", "grade now in CurriculumResults, same key as before");
  assert.strictEqual((row("target", "all") || {}).CurValue, "6", "target in CurriculumResults");
  assert.strictEqual((row("actual", "dp_2026_1") || {}).CurValue, "U", "exam result in CurriculumResults");
});

test("Enter levels is for levels only and points GCSE pupils to Qualifications", async () => {
  const site = await E.seededSite();
  const t = await E.openSlt(site.sp);
  const r = JSON.parse(t.ev(`(function(){
    switchTab("curentry");
    document.getElementById("ceMode").value = "list";
    renderCurEntry();
    const kinds = Array.prototype.map.call(document.getElementById("ceKind").options, function(o){ return o.value; });
    const kindHidden = document.getElementById("ceKind").closest("label").hidden;
    document.getElementById("ceSubject").value = "${SU("Maths")}"; document.getElementById("ceDrop").value = "dp_2026_1"; document.getElementById("ceYear").value = "11";
    renderCurEntry();
    const empty = document.querySelector("#ceTable .empty");
    const msg = empty ? empty.textContent : "";
    const go = document.querySelector("#ceTable [data-gcse-go]");
    go.click();
    const out = {kinds:kinds, kindHidden:kindHidden, msg:msg, tab:activeTab, q:document.getElementById("qeQual").value, y:document.getElementById("qeYear").value, d:document.getElementById("qeDrop").value,
      gcseRows:document.querySelectorAll("#qeTable tr[data-cerow]").length};
    /* a mixed list (all years): levels for KS3, with a line pointing to GCSE for the rest */
    switchTab("curentry"); document.getElementById("ceYear").value = ""; renderCurEntry();
    out.levelBoxes = document.querySelectorAll('#ceTable .lvlin[data-ctx="level|dp_2026_1"]').length;
    out.otherBoxes = document.querySelectorAll('#ceTable .lvlin:not([data-ctx^="level|"])').length;
    out.hint = (document.querySelector("#ceTable p.hint") || {}).textContent || "";
    document.getElementById("ceAllYears").checked = true; document.getElementById("ceYear").value = "11"; renderCurEntry();
    out.allYears = document.querySelectorAll('#ceTable .lvlin[data-ctx="level|dp_2026_1"]').length;
    return JSON.stringify(out);
  })()`));
  assert.deepStrictEqual(r.kinds, ["level"], "levels only");
  assert.strictEqual(r.kindHidden, true, "no Entering menu");
  assert.ok(/on GCSE grades/.test(r.msg), r.msg);
  assert.strictEqual(r.tab, "qualentry"); assert.strictEqual(r.q, "gcse:" + SU("Maths")); assert.strictEqual(r.y, "11"); assert.strictEqual(r.d, "dp_2026_1");
  assert.ok(r.gcseRows > 0, "lands on the Year 11 Maths GCSE list");
  assert.ok(r.levelBoxes > 10 && r.otherBoxes === 0, "only level boxes");
  assert.ok(/on GCSE grades/.test(r.hint), "points to GCSE for the rest: " + r.hint);
  assert.ok(r.allYears > 0, "Include GCSE years for levels still works");
  t.close();
});

test("Staff entry: GCSE for their own pupils and subjects only, no targets, and My classes lands there", async () => {
  const site = await E.seededSite();
  const t = await E.openStaff(site.sp, "st_107");          /* Geography, 10A and 10B */
  const r = JSON.parse(t.ev(`(function(){
    switchTab("qualentry"); renderQualEntry();
    const opts = Array.prototype.map.call(document.getElementById("qeQual").options, function(o){ return o.value; });
    staffGo({s:"${SU("Geography")}", d:"dp_2026_1", y:"", g:"10A", k:"predicted"});
    const rows = Array.prototype.map.call(document.querySelectorAll("#qeTable tr[data-cerow]"), function(tr){ return tr.getAttribute("data-cerow"); });
    const outOfScope = rows.filter(function(pid){ return !(entryScopeIds.pairs[pid] && entryScopeIds.pairs[pid]["${SU("Geography")}"]); }).length;
    const targets = document.querySelectorAll('#qeTable .lvlin[data-ctx="target|"]').length;
    const box = document.querySelector('#qeTable .lvlin[data-ctx="predicted|dp_2026_1"]');
    const pid = box.getAttribute("data-pid");
    box.value = "5"; commitCurInput(box);
    /* a box for someone else's subject can't be saved */
    const refused = setCurResult(pid, "${SU("English")}", "dp_2026_1", "predicted", "9");
    return JSON.stringify({opts:opts, tab:activeTab, q:document.getElementById("qeQual").value, g:document.getElementById("qeGroup").value, rows:rows.length, outOfScope:outOfScope, targets:targets, pid:pid, refused:refused});
  })()`));
  assert.ok(r.opts.indexOf("gcse:" + SU("Geography")) >= 0, "GCSE Geography offered");
  assert.ok(r.opts.indexOf("gcse:" + SU("English")) < 0, "not someone else's subject");
  assert.strictEqual(r.tab, "qualentry"); assert.strictEqual(r.q, "gcse:" + SU("Geography")); assert.strictEqual(r.g, "10A");
  assert.ok(r.rows > 0 && r.outOfScope === 0, "own pupils only (" + r.rows + ")");
  assert.strictEqual(r.targets, 0, "targets are SLT's");
  assert.strictEqual(r.refused, false, "outside scope refused");
  assert.ok(await saveUntilClean(t));
  t.close();
  assert.ok(site.sp.lists.CurriculumResults.some((x) => x.CurKey === r.pid + "_" + SU("Geography") + "_dp_2026_1_predicted" && x.CurValue === "5"), "saved to SharePoint");
  assert.ok(!site.sp.lists.CurriculumResults.some((x) => x.CurKey === r.pid + "_" + SU("English") + "_dp_2026_1_predicted" && x.CurValue === "9"), "nothing outside scope");
});

test("a pupil on BTEC Science shows its grade box on the GCSE Science page, and it saves to the BTEC", async () => {
  const site = await E.seededSite();
  const t = await E.openSlt(site.sp);
  const r = JSON.parse(t.ev(`(function(){
    gcseGo("${SU("Science")}", "dp_2026_1", "", "");
    const sel = document.querySelector('#qeTable [data-qualgrade$="|q_btecsci"]');
    if(!sel) return JSON.stringify({none:true});
    const pid = sel.getAttribute("data-qualgrade").split("|")[0];
    const lvl = document.querySelectorAll('#qeTable .lvlin[data-pid="' + pid + '"]').length;
    sel.value = "Level 2 Merit"; sel.dispatchEvent(new Event("change", {bubbles:true}));
    const own = qualOwnAt(pid, "q_btecsci", "dp_2026_1");
    return JSON.stringify({pid:pid, lvl:lvl, grade:own ? own.grade : null, still:!!document.querySelector('#qeTable [data-qualgrade="' + pid + '|q_btecsci"]')});
  })()`));
  assert.ok(!r.none, "a BTEC pupil is listed");
  assert.strictEqual(r.lvl, 0, "no GCSE boxes for them");
  assert.strictEqual(r.grade, "Level 2 Merit", "saved to the BTEC");
  assert.ok(r.still, "page redrawn in place");
  t.close();
});

test("the pupil page lists GCSEs with the other qualifications", async () => {
  const site = await E.seededSite();
  const t = await E.openSlt(site.sp);
  const r = JSON.parse(t.ev(`(function(){
    const ay = currentAY(), idx = curIndex();
    const ks4 = state.pupils.filter(function(p){ return +p.year === 11 && !qualForSubject(p.id, "${SU("English")}", "dp_2026_1"); })[0];
    const ks3 = state.pupils.filter(function(p){ return +p.year === 8; })[0];
    const h4 = profileQualsHtml(ks4), h3 = profileQualsHtml(ks3);
    const g = gcseJudge(ks4.id, "${SU("English")}", idx);
    return JSON.stringify({h4:h4, h3:h3, pred:g.pred ? g.pred.value : null, target:g.target ? g.target.value : null});
  })()`));
  assert.ok(/GCSE English/.test(r.h4) && /GCSE Maths/.test(r.h4), "English and Maths listed");
  assert.ok(r.h4.indexOf("target " + r.target) >= 0, "target shown");
  assert.ok(r.h4.indexOf("Now <strong>" + r.pred + "</strong>") >= 0, "grade now shown");
  assert.ok(!/GCSE /.test(r.h3), "nothing for a Year 8 pupil");
  assert.ok(!/GCSE PE|GCSE PSHE/.test(r.h4), "only subjects with GCSE grades saved");
  t.close();
});

test("curriculum statements for a pupil moved onto GCSE: GCSE framework, grade now, next steps from the next grade", async () => {
  const site = await E.seededSite();
  const t = await E.openSlt(site.sp);
  const r = JSON.parse(t.ev(`(function(){
    const ma = "${SU("Maths")}", idx = curIndex();
    /* a GCSE ladder that doesn't say GCSE in its name: its levels count as grades 3-6 */
    const gfw = {id:"fw_gma", name:"Maths ladder (higher)", subjectId:ma, kind:"levels", version:"1", active:true,
      levels:[3, 4, 5, 6].map(function(n){ return {id:"G" + n, name:"Grade " + n, map:"G" + n, equiv:"", statements:[0, 1, 2, 3].map(function(k){ return {id:"g" + n + "_" + k, strand:"", ref:"", text:"Grade " + n + " step " + k, key:true, ht:"", retired:false}; })}; })};
    state.frameworks.push(gfw);
    /* the Key Stage 3 framework suggests levels too */
    state.frameworks.filter(function(f){ return f.id === "fw_ma"; })[0].levels.forEach(function(l, i){ l.map = String(i + 1); });
    calcRev++; revision++;
    /* a Year 10-11 pupil with Key Stage 3 Maths sign-offs and a grade now */
    const p = state.pupils.filter(function(x){ const rw = fwRow(x.id, "fw_ma"); return usesGcse(x, currentAY(), ma) && rw && Object.keys(rw.marks).length && gcseJudge(x.id, ma, idx).pred && !qualForSubject(x.id, ma, "dp_2026_1"); })[0];
    const ks3 = state.pupils.filter(function(x){ const rw = fwRow(x.id, "fw_ma"); return !usesGcse(x, currentAY(), ma) && rw && Object.keys(rw.marks).length; })[0];
    const grade = gcseValue(gcseJudge(p.id, ma, idx).pred.value);
    const x = fwNextSteps(p.id, gfw, 3);
    const out = {stage:fwStage(gfw), forSub:(fwForSubject(ma, p.id) || {}).id, grade:grade, startGrade:x.start ? x.start.grade : null, level:x.L ? x.L.map : null,
      steps:x.steps.map(function(s){ return s.text; }), html:profileFwHtml(p), ks3For:(fwForSubject(ma, ks3.id) || {}).id, ks3Start:!!fwNextSteps(ks3.id, state.frameworks.filter(function(f){ return f.id === "fw_ma"; })[0], 3).start};
    /* no GCSE framework in the subject: the grade, with the curriculum one under it */
    state.frameworks = state.frameworks.filter(function(f){ return f.id !== "fw_gma"; }); calcRev++; revision++;
    out.htmlNoG = profileFwHtml(p);
    out.predEng = (gcseJudge(p.id, "${SU("English")}", idx).pred || {}).value || null;
    return JSON.stringify(out);
  })()`));
  assert.strictEqual(r.stage, "gcse", "a G1-G9 ladder is a GCSE framework");
  assert.strictEqual(r.forSub, "fw_gma", "a moved pupil is on the GCSE framework before any sign-off in it");
  assert.strictEqual(r.startGrade, r.grade, "starts from grade now");
  const want = "G" + Math.min(6, Math.max(3, r.grade + 1));
  assert.strictEqual(r.level, r.grade >= 6 ? "G6" : want, "next steps from the next grade up");
  assert.strictEqual(r.steps.length, 3);
  assert.ok(r.html.indexOf("<strong>Grade " + (r.grade === 0 ? "U" : r.grade) + "</strong>") >= 0, "pupil page shows the grade");
  assert.ok(r.html.indexOf(r.steps[0]) >= 0, "pupil page shows the next steps");
  assert.ok(/before GCSE/i.test(r.html), "Key Stage 3 framework folded under it");
  assert.strictEqual(r.ks3For, "fw_ma", "a Key Stage 3 pupil keeps the curriculum framework");
  assert.strictEqual(r.ks3Start, false);
  assert.ok(/No GCSE statements are set up for this subject/.test(r.htmlNoG) && /now/.test(r.htmlNoG), "no GCSE framework: the grade, then the curriculum steps");
  t.close();
});

test("export for one data drop: level, GCSE grade or qualification status, previous, progress", async () => {
  const site = await E.seededSite();
  const t = await E.openSlt(site.sp);
  const r = JSON.parse(t.ev(`(function(){
    let got = null;
    const keep = downloadBlob;
    downloadBlob = function(n, c){ got = {n:n, c:c}; };
    try { exportDropCsv("dp_2026_1"); } finally { downloadBlob = keep; }
    const ay = acYearOf("2026-12-11");
    let expect = 0;
    state.pupils.forEach(function(p){ (state.subjects || []).forEach(function(su){ if(su.active && takesSubject(p, su, ay) && !isHidden("ps:" + p.id + "|" + su.id)) expect++; }); });
    switchTab("curentry"); document.getElementById("ceMode").value = "list"; renderCurEntry();
    return JSON.stringify({n:got.n, c:got.c, expect:expect, entry:document.querySelector('[data-dropexport]') ? document.querySelector('[data-dropexport]').className : ""});
  })()`));
  assert.ok(/^levels_Autumn_2026\.csv$/.test(r.n), r.n);
  const parse = (line) => { const out = []; let cur = "", q = false; for(let i = 0; i < line.length; i++){ const ch = line[i]; if(q){ if(ch === '"' && line[i + 1] === '"'){ cur += '"'; i++; } else if(ch === '"') q = false; else cur += ch; } else if(ch === '"') q = true; else if(ch === ","){ out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out; };
  const lines = r.c.split("\n").map(parse);
  const head = lines[0];
  assert.deepStrictEqual(head, ["Pupil","UPN","Year","Group","Subject","Type","Autumn 2026","Previous","Previous drop","Progress since previous","Status"]);
  const rows = lines.slice(1).map((a) => Object.fromEntries(head.map((h, i) => [h, a[i]])));
  assert.strictEqual(rows.length, r.expect, "one row per pupil and subject they take");
  /* levels: progress worked out here from the made-up school, independently */
  const m = site.model, step = (v) => { const f = /^FLS(\d+)$/.exec(v); if(f) return +f[1] - 11; const x = /^([1-9])([EDS])$/.exec(v); return (+x[1] - 1) * 3 + "EDS".indexOf(x[2]); };
  const byName = {}, twice = {}; m.pupils.forEach((p) => { if(byName[p.name]) twice[p.name] = true; byName[p.name] = p; });
  const subByName = {}; m.subjects.forEach((s) => { subByName[s.name] = s.id; });
  const order = ["dp_2024_0","dp_2024_1","dp_2024_2","dp_2024_3","dp_2024_4","dp_2024_5","dp_2025_0","dp_2025_1","dp_2025_2","dp_2025_3","dp_2025_4","dp_2025_5","dp_2026_0"];
  let checked = 0;
  rows.filter((x) => x.Type === "Level" && x["Autumn 2026"] && !twice[x.Pupil]).forEach((x) => {
    const p = byName[x.Pupil], sid = subByName[x.Subject];
    const recs = m.curResults.filter((c) => c.pupilId === p.id && c.subjectId === sid && c.kind === "level");
    const now = recs.find((c) => c.dataPointId === "dp_2026_1");
    let prev = null; for(let i = order.length - 1; i >= 0 && !prev; i--) prev = recs.find((c) => c.dataPointId === order[i]) || null;
    assert.strictEqual(x["Autumn 2026"], now.value, "level");
    assert.strictEqual(x.Previous, prev ? prev.value : "", "previous");
    const d = prev ? step(now.value) - step(prev.value) : null;
    const want = d == null ? "" : d === 0 ? "No change" : (d > 0 ? "Up " : "Down ") + Math.abs(d) + " step" + (Math.abs(d) === 1 ? "" : "s");
    assert.strictEqual(x["Progress since previous"], want, x.Pupil + " " + x.Subject);
    checked++;
  });
  assert.ok(checked > 100, "levels checked: " + checked);
  assert.ok(rows.some((x) => x.Type === "GCSE" && /^[1-9U]$/.test(x["Autumn 2026"]) && /^(Up \d+ grades?|Down \d+ grades?|No change)$/.test(x["Progress since previous"])), "GCSE rows with grade progress");
  const btec = rows.filter((x) => /BTEC Applied Science/.test(x.Type));
  assert.ok(btec.length > 0 && btec.every((x) => /^(Started|On track|At risk|Entered|Achieved|Not achieved|Not started)/.test(x["Autumn 2026"]) && x.Status), "BTEC rows say where they are");
  assert.ok(rows.some((x) => x.Status === "Not entered" && !x["Autumn 2026"] && !x["Progress since previous"]), "missing ones say so");
  assert.ok(rows.every((x) => x.Previous || !x["Progress since previous"] || /BTEC|Catering|Sport/.test(x.Type)), "no progress without a previous result");
  assert.ok(/noentry/.test(r.entry), "the Enter levels button is SLT only");
  t.close();
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
