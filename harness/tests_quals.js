/* V42.4: Import units with Merge into, and the file's order.
   Run: TRACKER_DIR=../out/current node tests_quals.js */
"use strict";
const E = require("./env"), L = E.L, assert = require("assert");
const tests = [];
function test(name, fn){ tests.push({name, fn}); }
const saveAll = async (t) => { for(let i = 0; i < 6; i++){ t.ev("if(retryTimer){ clearTimeout(retryTimer); retryTimer = null; } window.__d = false; flushAutoSave().then(function(){ window.__d = true; }, function(){ window.__d = true; });"); await L.until(() => t.ev("window.__d === true && !autoInFlight"), 60000); await L.settle(30); if(!t.ev("dirty")) return true; } return false; };
/* make an .xlsx in the page with SheetJS and run it through Import units */
const importRows = async (t, aoa) => {
  t.ev(`(function(){ openQualUnitsImport(); window.__aoa = ${JSON.stringify(aoa)};
    withXlsx(function(){ const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(window.__aoa), "Units");
      quRead(new File([XLSX.write(wb, {bookType:"xlsx", type:"array"})], "u.xlsx")); }); })()`);
  await L.until(() => t.ev("!!(quImp && document.getElementById('quPreview').textContent)"), 20000);
  const preview = t.ev("document.getElementById('quPreview').textContent");
  t.ev("quCommit();");
  return preview;
};
const HEAD = ["QualId","Qualification","Type","Board","Module","UnitId","Unit (code and wording)","Credits","Pupils ticked","Remove (Yes to delete)","Merge into (UnitId)"];
const SETUP = `(function(){
  const ps = state.pupils.filter(function(p){ return +p.year >= 10; });
  state.quals.push({id:"q_t1", name:"Test Horticulture Award", type:"cg", board:"City & Guilds", level:"L1", subjectId:"", active:true,
    units:[{id:"u_a", name:"Unit 101 Old wording"}, {id:"u_b", name:"Unit 101 New wording"}, {id:"u_c", name:"Unit 102 Plant"}, {id:"u_d", name:"Unit 103 Mulch"}]});
  state.quals.push({id:"q_t2", name:"Test Other", type:"other", board:"", level:"", subjectId:"", active:true, units:[{id:"u_x", name:"Unit 1 Other"}]});
  /* p0 ticked both copies of 101; p1 only the old one; p2 only the new one; p3 a different qualification */
  [[0, ["u_a", "u_b", "u_c"]], [1, ["u_a"]], [2, ["u_b", "u_d"]]].forEach(function(x){ state.qualResults.push({id:uid("qr"), pupilId:ps[x[0]].id, qualId:"q_t1", dataPointId:"dp_2026_1", status:"ontrack", units:x[1], grade:"", updatedAt:"2026-11-20"}); });
  state.qualResults.push({id:uid("qr"), pupilId:ps[3].id, qualId:"q_t2", dataPointId:"dp_2026_1", status:"ontrack", units:["u_x"], grade:"", updatedAt:"2026-11-20"});
  calcRev++; markDirty();
  return JSON.stringify(ps.slice(0, 4).map(function(p){ return p.id; }));
})()`;

test("Merge into moves every pupil's tick to the unit kept, once, and removes the duplicate; it lasts after reopening", async () => {
  const site = await E.seededSite();
  let t = await E.openSlt(site.sp);
  const P = JSON.parse(t.ev(SETUP));
  assert.ok(await saveAll(t));
  const preview = await importRows(t, [HEAD,
    ["q_t1", "Test Horticulture Award", "City & Guilds", "City & Guilds", "Units", "u_b", "Unit 101 Prepare the ground", 3, "", "", ""],
    ["q_t1", "Test Horticulture Award", "City & Guilds", "City & Guilds", "", "u_a", "Unit 101 Old wording", "", "", "", "u_b"],
    ["q_t1", "Test Horticulture Award", "City & Guilds", "City & Guilds", "", "u_c", "Unit 102 Plant", "", "", "", "u_x"]]);   /* a unit of another qualification: refused */
  assert.ok(/1 duplicate unit merged, moving 2 pupils/.test(preview), preview);
  assert.ok(/1 rows skipped/.test(preview), "merge into another qualification's unit is refused: " + preview);
  assert.ok(await saveAll(t));
  t.close();
  t = await E.openSlt(site.sp);
  const r = JSON.parse(t.ev(`(function(){ const q = byId(quals(), "q_t1"), q2 = byId(quals(), "q_t2"); const recs = {};
    state.qualResults.forEach(function(x){ if(x.qualId === "q_t1" || x.qualId === "q_t2") recs[x.pupilId + "|" + x.qualId] = x.units.slice().sort(); });
    return JSON.stringify({units:q.units.map(function(u){ return u.id + ":" + u.name + ":" + (u.credits || ""); }), other:q2.units.map(function(u){ return u.id; }), recs:recs}); })()`));
  assert.deepStrictEqual(r.units.map((u) => u.split(":")[0]).sort(), ["u_b", "u_c", "u_d"], "the duplicate went");
  assert.ok(r.units.indexOf("u_b:Unit 101 Prepare the ground:3") >= 0, "the kept unit has the new wording and credits");
  assert.deepStrictEqual(r.recs[P[0] + "|q_t1"], ["u_b", "u_c"], "ticked both: one tick left");
  assert.deepStrictEqual(r.recs[P[1] + "|q_t1"], ["u_b"], "ticked the old one: moved to the kept one");
  assert.deepStrictEqual(r.recs[P[2] + "|q_t1"], ["u_b", "u_d"], "ticked the kept one: unchanged");
  assert.deepStrictEqual(r.recs[P[3] + "|q_t2"], ["u_x"], "another qualification untouched");
  assert.deepStrictEqual(r.other, ["u_x"]);
  t.close();
});

test("Import units puts the units in the file's order, unchanged rows included", async () => {
  const site = await E.seededSite();
  const t = await E.openSlt(site.sp);
  t.ev(SETUP);
  await importRows(t, [HEAD,
    ["q_t1", "Test Horticulture Award", "City & Guilds", "City & Guilds", "", "u_d", "Unit 103 Mulch", "", "", "", ""],                 /* unchanged */
    ["q_t1", "Test Horticulture Award", "City & Guilds", "City & Guilds", "", "", "Unit 100 New first unit", 2, "", "", ""],          /* added */
    ["q_t1", "Test Horticulture Award", "City & Guilds", "City & Guilds", "", "u_c", "Unit 102 Plant container grown subjects", 3, "", "", ""]]);
  const names = JSON.parse(t.ev(`JSON.stringify(byId(quals(), "q_t1").units.map(function(u){ return u.name; }))`));
  assert.deepStrictEqual(names.slice(0, 3), ["Unit 103 Mulch", "Unit 100 New first unit", "Unit 102 Plant container grown subjects"], "file order");
  assert.deepStrictEqual(names.slice(3).sort(), ["Unit 101 New wording", "Unit 101 Old wording"], "units not in the file keep theirs, after");
  t.close();
});

test("Export units has the Merge into column", async () => {
  const site = await E.seededSite();
  const t = await E.openSlt(site.sp);
  t.ev(SETUP);
  const head = t.ev(`(function(){ let got = null; const keep = downloadBlob; downloadBlob = function(n, b){ got = b; }; try { qualUnitsExport(); } finally { downloadBlob = keep; }
    window.__blob = got; return "ok"; })()`);
  await L.until(() => t.ev("!!window.__blob"), 20000);
  t.ev(`(function(){ const rd = new FileReader(); rd.onload = function(){ const wb = XLSX.read(new Uint8Array(rd.result), {type:"array"}); window.__cols = JSON.stringify(XLSX.utils.sheet_to_json(wb.Sheets.Units, {header:1})[0]); }; rd.readAsArrayBuffer(window.__blob); })()`);
  await L.until(() => t.ev("!!window.__cols"), 20000);
  const cols = t.ev("window.__cols");
  assert.ok(JSON.parse(cols).indexOf("Merge into (UnitId)") >= 0, cols);
  t.close();
});

(async () => {
  let pass = 0, fail = 0;
  for(const tc of tests){
    const t0 = Date.now();
    try { await tc.fn(); pass++; console.log("PASS  " + tc.name + "  (" + (Date.now() - t0) + "ms)"); }
    catch(e){ fail++; console.log("FAIL  " + tc.name + "\n      " + String(e && e.message || e).split("\n").slice(0, 10).join("\n      ")); }
  }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
