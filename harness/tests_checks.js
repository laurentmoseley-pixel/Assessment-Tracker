"use strict";
const E = require("./env"); const L = E.L; const assert = require("assert");
(async () => {
  let fail = 0;
  try {
    const site = await E.seededSite();
    const sp = site.sp; sp.noUnique = {CurriculumResults:true};
    const orig = sp.lists.CurriculumResults[100]; const c = Object.assign({}, orig); delete c.Id; delete c.ID; c.Title = orig.Title + "z"; c.CurValue = "1E";
    const old = sp.create("CurriculumResults", c);
    const t = await E.openSlt(sp);
    const shown = t.ev(`curGet(curIndex(), ${JSON.stringify(orig.PupilId)}, ${JSON.stringify(orig.SubjectId)}, ${JSON.stringify(orig.DataDropId)}, "level").value`);
    assert.strictEqual(shown, "1E", "the newest copy is shown");
    const sec = JSON.parse(t.ev(`JSON.stringify(qualityChecks().filter(function(s){ return s.id === "spdups"; })[0].items.map(function(i){ return i.cells; }))`));
    assert.strictEqual(sec.length, 1); assert.strictEqual(sec[0][1], "1");
    t.ev(`qualityFix("sp-dups", "all", true)`);
    await L.until(() => !sp.lists.CurriculumResults.some((x) => x.Id === orig.Id), 15000);
    assert.ok(sp.lists.CurriculumResults.some((x) => x.Id === old.Id), "the newest stays");
    assert.strictEqual(t.ev(`qualityChecks().filter(function(s){ return s.id === "spdups"; })[0].items.length`), 0);
    t.close();
    console.log("PASS  Data checks: 'Saved twice in SharePoint' lists and removes older copies");
  } catch(e){ fail++; console.log("FAIL  data checks\n      " + e.message); }
  try {
    const site = await E.seededSite();
    const t = await E.openSlt(site.sp);
    const odd = JSON.parse(t.ev(`JSON.stringify(qualityChecks().filter(function(s){ return s.id === "oddgroup"; })[0].items.map(function(i){ return i.pid; }))`));
    assert.ok(odd.indexOf("pu_1005") >= 0, "the Year 6 pupil in 10A is flagged");
    const dpp = JSON.parse(t.ev(`(function(){ state.pupils.push(Object.assign({}, state.pupils[3], {id:"pu_dupe"})); calcRev++; revision++; return JSON.stringify(qualityChecks().filter(function(s){ return s.id === "duppupil"; })[0].items.length); })()`));
    assert.ok(dpp >= 1, "a pupil listed twice is flagged");
    t.close();
    console.log("PASS  Data checks: odd teaching groups and pupils listed twice are flagged");
  } catch(e){ fail++; console.log("FAIL  odd groups\n      " + e.message); }
  process.exit(fail ? 1 : 0);
})();
