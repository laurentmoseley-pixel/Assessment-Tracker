"use strict";
process.env.TZ = "Europe/London";
const fs = require("fs"), path = require("path"), http = require("http");
const {chromium} = require("playwright-core");
const E = require("./env");
const dir = path.resolve(process.argv[2] || "../out/current"), outDir = path.resolve(process.argv[3] || "../out/shots");
fs.mkdirSync(outDir, {recursive:true});
function serve(root){ return new Promise((res) => { const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split("?")[0])); if(!fs.existsSync(f)){ r.writeHead(404); r.end(); return; } r.writeHead(200, {"content-type":"text/html; charset=utf-8"}); fs.createReadStream(f).pipe(r); }).listen(0, "127.0.0.1", () => res(srv)); }); }
(async () => {
  const site = await E.seededSite();
  const srv = await serve(dir); const base = "http://127.0.0.1:" + srv.address().port + "/";
  const browser = await chromium.launch({executablePath:"/usr/bin/google-chrome", args:["--no-sandbox"]});
  const go = async (file, ls, vp, steps, name, theme) => {
    const ctx = await browser.newContext({viewport:vp});
    const flow = E.flowFor(site.sp);
    await ctx.route("**/*", async (route) => { const u = route.request().url(); if(u.startsWith("http://127.0.0.1")) return route.continue(); if(/powerplatform/.test(u)){ const r = await flow.fetch(u, {body:route.request().postData()}); return route.fulfill({status:r.status, contentType:"application/json", body:await r.text()}); } return route.abort(); });
    await ctx.addInitScript((ls) => { if(!sessionStorage.getItem("s")){ Object.keys(ls).forEach((k) => localStorage.setItem(k, ls[k])); sessionStorage.setItem("s", "1"); } }, ls);
    const pg = await ctx.newPage(); const errs = []; pg.on("console", (m) => { if(m.type() === "error") errs.push(m.text()); }); pg.on("pageerror", (e) => errs.push(e.message));
    pg.on("dialog", (d) => d.accept());
    await pg.goto(base + file);
    await pg.waitForFunction(() => window.eval("typeof sheetReady !== 'undefined' && sheetReady === true && !document.body.classList.contains('loading')"), null, {timeout:60000});
    if(theme) await pg.evaluate((t) => window.eval("setTheme(" + JSON.stringify(t) + ")"), theme);
    await pg.waitForTimeout(600);
    for(const s of steps){ await s(pg); await pg.waitForTimeout(400); }
    await pg.screenshot({path:path.join(outDir, name + ".png")});
    console.log(name, "errors:", errs.length, errs.slice(0, 2).join(" | "));
    await ctx.close();
  };
  const SLT = {"assessmentTracker.flowPass":E.PASS, "assessmentTracker.source":"flow", "assessmentTracker.who":"SLT", "assessmentTracker.setupDone":"1", "assessmentTracker.toured":"1"};
  const ST = (id) => ({"assessmentTracker.staffentry.flowPass":E.STAFF_PASS, "assessmentTracker.staffentry.staffId":id});
  const vp = {width:1366, height:768};
  await go("assessment_tracker_staff_entry_V39.html", ST("st_115"), vp, [(pg) => pg.evaluate(() => window.eval("switchTab('fwentry')"))], "staff-signoff");
  await go("assessment_tracker_staff_entry_V39.html", ST("st_115"), vp, [(pg) => pg.evaluate(() => window.eval("switchTab('fwentry')")), (pg) => pg.click("[data-fwbulk-strand]")], "staff-signoff-strand-modal");
  await go("assessment_tracker_V39.html", SLT, vp, [(pg) => pg.evaluate(() => window.eval("switchTab('qualentry')")), (pg) => pg.selectOption("#qeQual", "q_btecsci"), (pg) => pg.selectOption("#qeYear", "10")], "slt-quals");
  await go("assessment_tracker_V39.html", SLT, vp, [(pg) => pg.evaluate(() => window.eval("switchTab('quality')"))], "slt-checks");
  await go("assessment_tracker_V39.html", SLT, vp, [(pg) => pg.evaluate(() => window.eval("setCurResult(state.pupils[3].id,'su_art','dp_2026_1','level','2E'); openSendPanel()"))], "slt-sendpanel");
  await go("assessment_tracker_staff_entry_V39.html", ST("st_104"), vp, [(pg) => pg.evaluate(() => window.eval("switchTab('curentry')")), (pg) => pg.focus("#ceTable .lvlin")], "staff-levels-dark", "dark");
  await go("assessment_tracker_staff_entry_V39.html", ST("st_104"), {width:1920, height:1080}, [(pg) => pg.evaluate(() => window.eval("switchTab('classview')"))], "staff-overview-1920");
  await browser.close(); srv.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
