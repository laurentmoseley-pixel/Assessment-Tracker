/* Calculations, worked out by hand and checked against the page's own functions.
   Run: TRACKER_DIR=../out/current node tests_calc.js */
"use strict";
const E = require("./env");
const L = E.L;
const assert = require("assert");
(async () => {
  const sp = new (require("./fakesp").FakeSharePoint)({}, {lists:[]});
  const t = L.open(E.files().slt, new (require("./fakesp").FakeFlow)(sp), {localStorage:{"assessmentTracker.source":"excel", "assessmentTracker.setupDone":"1"}});
  await L.until(() => t.ev("typeof migrate") === "function" && !t.ev("document.body.classList.contains('loading')"));
  let pass = 0, fail = 0;
  const check = (name, got, want) => { try { assert.deepStrictEqual(JSON.parse(JSON.stringify(got)), want); pass++; console.log("PASS  " + name); } catch(e){ fail++; console.log("FAIL  " + name + "\n      got " + JSON.stringify(got) + " want " + JSON.stringify(want)); } };
  /* a small made-up school: one pupil, English, drops a year apart */
  t.w.__m = {meta:{school:"Calc School"}, settings:{dataPoints:[
      {id:"d0", name:"Sep 24", date:"2024-09-01"}, {id:"d1", name:"Nov 24", date:"2024-11-01"}, {id:"d2", name:"Sep 25", date:"2025-09-01"}, {id:"d3", name:"Jul 26", date:"2026-07-10"}],
      cur:{rate:0.8, tolSteps:0.5, wellSteps:3, gcseFrom:10, judgeFrom:"join", minYears:0.4, ks4Judge:"target"}},
    pupils:[{id:"p1", name:"Calc Pupil", year:8, dob:"2012-10-01", startDate:"2024-09-01"}, {id:"p2", name:"Gcse Pupil", year:11, dob:"2010-10-01", startDate:"2022-09-01"}],
    subjects:[{id:"su_e", name:"English", active:true}],
    baselines:[{id:"b1", pupilId:"p1", subjectId:"su_e", value:"3E", date:"2024-09-01", source:"manual"}],
    curResults:[], results:[], assessments:[]};
  t.ev("state = migrate(window.__m); calcRev++;");
  const judge = (v, dp) => t.ev(`(function(){ state.curResults = [{id:"r", pupilId:"p1", subjectId:"su_e", dataPointId:"${dp}", kind:"level", value:"${v}"}]; calcRev++; revision++;
     const r = state.curResults[0]; return levelJudge__raw("p1", "su_e", r, byId(state.settings.dataPoints, "${dp}"), curIndex__raw()).status; })()`);
  check("3E baseline, 3S a year on (expected 3.8): on track", judge("3S", "d2"), "ontrack");
  check("3D a year on: behind", judge("3D", "d2"), "behind");
  check("2D a year on: well behind", judge("2D", "d2"), "well");
  check("4D a year on: ahead", judge("4D", "d2"), "ahead");
  check("two months on: too early", judge("3S", "d1"), "early");
  check("lvlValue 4D", t.ev("Math.round(lvlValue('4D')*1000)/1000"), 4.333);
  check("lvlValue FLS10", t.ev("Math.round(lvlValue('FLS10')*100)/100"), -0.7);
  check("gcseValue U / 4S / 10", t.ev("[gcseValue('U'), gcseValue('4S'), gcseValue('10')]"), [0, 4, null]);
  const pi = (raw, prev, kind) => t.ev(`JSON.stringify(parseCurInput(${JSON.stringify(raw)}, ${JSON.stringify(prev)}, "${kind}"))`);
  check("typing 4 means 4E", JSON.parse(pi("4", "", "level")).value, "4E");
  check("+ on 4S is 5E", JSON.parse(pi("+", "4S", "level")).value, "5E");
  check("- on 4E is 3S", JSON.parse(pi("-", "4E", "level")).value, "3S");
  check("++ on 3E is 3S", JSON.parse(pi("++", "3E", "level")).value, "3S");
  check("+3 on 3E is 4E", JSON.parse(pi("+3", "3E", "level")).value, "4E");
  check("= copies the previous", JSON.parse(pi("=", "5D", "level")).value, "5D");
  check("10 is refused for a level", JSON.parse(pi("10", "", "level")).ok, false);
  check("grade + on 4 is 5", JSON.parse(pi("+", "4", "predicted")).value, "5");
  check("grade - on 1 is U", JSON.parse(pi("-", "1", "predicted")).value, "U");
  /* GCSE: judged against the target (ks4Judge target) */
  const g = (pred) => t.ev(`(function(){ state.curResults = [{id:"t", pupilId:"p2", subjectId:"su_e", dataPointId:"", kind:"target", value:"5"},
     {id:"p", pupilId:"p2", subjectId:"su_e", dataPointId:"d3", kind:"predicted", value:"${pred}"}]; calcRev++; revision++;
     return gcseJudge__raw("p2", "su_e", curIndex__raw()).status; })()`);
  check("predicted 5 against target 5: on track", g("5"), "ontrack");
  check("predicted 6 against 5: ahead", g("6"), "ahead");
  check("predicted 4 against 5: behind", g("4"), "behind");
  check("predicted 3 against 5: well behind", g("3"), "well");
  check("Year 10 onwards uses GCSE grades", t.ev("[usesGcse(byId(state.pupils,'p2'), '2025-26'), usesGcse(byId(state.pupils,'p1'), '2025-26')]"), [true, false]);
  check("an unreadable baseline never counts as well behind", t.ev(`(function(){ state.baselines = []; state.curResults = [{id:"r0", pupilId:"p1", subjectId:"su_e", dataPointId:"d0", kind:"level", value:"zz"}, {id:"r1", pupilId:"p1", subjectId:"su_e", dataPointId:"d2", kind:"level", value:"3S"}]; calcRev++; revision++;
     const r = state.curResults[1]; return levelJudge__raw("p1", "su_e", r, byId(state.settings.dataPoints, "d2"), curIndex__raw()).status; })()`) !== "well", true);
  t.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
