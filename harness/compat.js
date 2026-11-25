/* Data saved by V41.26 loads in V42.0 exactly as in V41.26 (the tracker's own data, not just counts),
   and timing of the load-side work. */
"use strict";
const E = require("./env"); const L = E.L; const assert = require("assert");
(async () => {
  const site = await E.seededSite();
  const snap = JSON.stringify(site.sp.lists);
  const t0 = Date.now();
  const a = await E.openSlt(site.sp, {dir:"../out/baseline-41.26"}); const ta = Date.now() - t0;
  const da = E.stateDigest(a);
  const pa = a.ev("(function(){ const t = performance.now(); for(let i=0;i<5;i++) spDiff(spBaseline, spForSite(spRecords(state))); return (performance.now()-t)/5; })()");
  a.close();
  /* V42 may write its one-time repairs on open: compare against the same untouched site */
  const site2 = {sp:new (require("./fakesp").FakeSharePoint)(site.schema)}; site2.sp.lists = JSON.parse(snap); Object.keys(site2.sp.lists).forEach((n) => { site2.sp.nextId[n] = Math.max(0, ...site2.sp.lists[n].map((x) => x.Id)) + 1; });
  const t1 = Date.now();
  const b = await E.openSlt(site2.sp, {dir:"../out/current"}); const tb = Date.now() - t1;
  const db = E.stateDigest(b);
  const pb = b.ev("(function(){ const t = performance.now(); for(let i=0;i<5;i++) spDiff(spBaseline, spForSite(spRecords(state))); return (performance.now()-t)/5; })()");
  const pl = b.ev("(function(){ const t = performance.now(); pendingForLocal(); return performance.now()-t; })()");
  b.close();
  assert.deepStrictEqual(db, da, "same data on screen");
  console.log("PASS  41.26 data loads identically in 42.0 (" + da.curResults.length + " levels, " + da.results.length + " results, " + da.fwMarks.length + " sign-off rows)");
  console.log("TIMING open (jsdom, fake flow): 41.26 " + ta + "ms, 42.0 " + tb + "ms; what-changed check: 41.26 " + pa.toFixed(0) + "ms, 42.0 " + pb.toFixed(0) + "ms; browser-copy changes " + pl.toFixed(0) + "ms");
  process.exit(0);
})().catch((e) => { console.log("FAIL  compat\n      " + e.message.split("\n").slice(0, 12).join("\n      ")); process.exit(1); });
