"use strict";
const E = require("./env"); const L = E.L; const {FakeSharePoint, FakeFlow} = require("./fakesp");
(async () => {
  const sp = new FakeSharePoint({}, {lists:[]});
  const t = L.open(E.files().slt, new FakeFlow(sp), {localStorage:{"assessmentTracker.source":"excel", "assessmentTracker.setupDone":"1"}});
  await L.until(() => typeof t.ev("state") === "object" && t.ev("state") && !t.ev("document.body.classList.contains('loading')"), 30000);
  t.w.__m = require("./fixture").make({pupils:40});
  t.ev("state = migrate(window.__m); markDirty(); renderAll();");
  for(const tab of ["dashboard","curentry","fwentry","qualentry","quality","cur","pupil","data"]) t.ev("switchTab('" + tab + "')");
  await L.settle(1200);
  console.log("local Excel mode: pupils", t.ev("state.pupils.length"), "errors", JSON.stringify(t.errors), "flow runs", sp ? 0 : 0);
  t.close(); process.exit(t.errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
