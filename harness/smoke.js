const E = require("./env");
(async () => {
  const t0 = Date.now();
  const site = await E.seededSite({dir: process.argv[2]});
  console.log("seeded", JSON.stringify(site.sp.counts()), (Date.now()-t0)+"ms");
  const t = await E.openSlt(site.sp, {dir: process.argv[2]});
  console.log("loaded SLT", (Date.now()-t0)+"ms", "runs", t.flow.runs, "pupils", t.ev("state.pupils.length"), "cur", t.ev("state.curResults.length"), "dirty", t.ev("dirty"));
  console.log("banner:", t.ev("document.getElementById('bootBanner').textContent").slice(0,200));
  console.log("pending:", t.ev("(sendPending()||[]).length"), JSON.stringify(t.ev("(sendPending()||[]).slice(0,5).map(o=>o.list+'|'+o.op+'|'+o.key)")));
  console.log("errors:", t.errors.slice(0,5));
  t.close();
  const s = await E.openStaff(site.sp, "st_104", {dir: process.argv[2]});
  console.log("staff loaded; pupils", s.ev("state.pupils.length"), "scope drops", JSON.stringify(s.ev("Object.keys(entryScopeIds.drops)")), "roster", s.ev("entryRosterState"));
  console.log("staff errors:", s.errors.slice(0,5));
  s.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
