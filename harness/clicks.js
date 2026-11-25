/* Click counts for the three routines, done for real in Chrome against the fake SharePoint, and
   checked as saved. Mouse clicks are counted (a menu choice = 2: open, pick); keystrokes separately.
   Run: node clicks.js <dir> */
"use strict";
process.env.TZ = "Europe/London";
const fs = require("fs"), path = require("path"), http = require("http");
const {chromium} = require("playwright-core");
const E = require("./env");
const dir = path.resolve(process.argv[2] || "../out/current");
function serve(root){ return new Promise((res) => { const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split("?")[0])); if(!fs.existsSync(f)){ r.writeHead(404); r.end(); return; } r.writeHead(200, {"content-type":"text/html; charset=utf-8"}); fs.createReadStream(f).pipe(r); }).listen(0, "127.0.0.1", () => res(srv)); }); }
async function open(browser, site, url, ls){
  const ctx = await browser.newContext({viewport:{width:1366, height:768}});
  const flow = E.flowFor(site.sp);
  await ctx.route("**/*", async (route) => {
    const u = route.request().url();
    if(u.startsWith("http://127.0.0.1")) return route.continue();
    if(/powerplatform\.com/.test(u)){ const resp = await flow.fetch(u, {body:route.request().postData()}); return route.fulfill({status:resp.status, contentType:"application/json", body:await resp.text()}); }
    return route.abort();
  });
  await ctx.addInitScript((ls) => { if(!sessionStorage.getItem("s")){ Object.keys(ls).forEach((k) => localStorage.setItem(k, ls[k])); sessionStorage.setItem("s", "1"); } }, ls);
  const pg = await ctx.newPage();
  pg.on("dialog", (d) => d.accept());
  await pg.goto(url);
  await pg.waitForFunction(() => window.eval("typeof sheetReady !== 'undefined' && sheetReady === true && !document.body.classList.contains('loading')"), null, {timeout:60000});
  await pg.waitForTimeout(800);
  return {ctx, pg, flow};
}
function counter(pg){
  const c = {clicks:0, keys:0};
  return {c,
    click: async (sel) => { await pg.click(sel); c.clicks++; await pg.waitForTimeout(150); },
    choose: async (sel, v) => { await pg.selectOption(sel, v); c.clicks += 2; await pg.waitForTimeout(200); },
    type: async (sel, text) => { await pg.fill(sel, text); c.keys += text.length; },
    key: async (k) => { await pg.keyboard.press(k); c.keys++; }};
}
async function savedOK(pg){ await pg.waitForFunction(() => !window.eval("dirty") && !window.eval("autoInFlight"), null, {timeout:30000}); return pg.evaluate(() => document.getElementById("dirtyFlag").textContent); }

(async () => {
  const site = await E.seededSite();
  const srv = await serve(dir);
  const base = "http://127.0.0.1:" + srv.address().port + "/";
  const browser = await chromium.launch({executablePath:"/usr/bin/google-chrome", args:["--no-sandbox"]});
  const out = {};
  /* 1. half-term levels for one class (Staff entry, an Art teacher of 7A/7B) */
  {
    const ls = {"assessmentTracker.staffentry.flowPass":E.STAFF_PASS, "assessmentTracker.staffentry.staffId":"st_104"};
    for(const visit of [1, 2]){
      const P = await open(browser, site, base + "assessment_tracker_staff_entry_V39.html", ls);
      const K = counter(P.pg);
      const tab = await P.pg.evaluate(() => window.eval("activeTab"));
      if(tab !== "curentry") await K.click('#subnav button[data-tab="curentry"], [data-tab="curentry"]');
      const subj = await P.pg.$eval("#ceSubject", (s) => s.value);
      if(subj !== "su_art") await K.choose("#ceSubject", "su_art");
      await P.pg.waitForSelector("#ceTable .lvlin");
      const n = await P.pg.$$eval("#ceTable .lvlin", (a) => a.length);
      for(let i = 0; i < n; i++){ await P.pg.focus('#ceTable .lvlin[data-row="' + i + '"]'); K.c.keys += 0; await P.pg.keyboard.type("4d"); K.c.keys += 2; await K.key("Enter"); }
      const chip = await savedOK(P.pg);
      const inSp = site.sp.lists.CurriculumResults.filter((x) => x.SubjectId === "su_art" && x.DataDropId === "dp_2026_1" && x.CurValue === "4D").length;
      out["1. Levels for one class (visit " + visit + ")"] = {clicks:K.c.clicks, keys:K.c.keys, pupils:n, savedInSharePoint:inSp, chip:chip};
      ls["assessmentTracker.staffentry.picks"] = await P.pg.evaluate(() => localStorage.getItem("assessmentTracker.staffentry.picks") || "");
      ls["assessmentTracker.staffentry.lastTab"] = await P.pg.evaluate(() => localStorage.getItem("assessmentTracker.staffentry.lastTab") || "");
      await P.ctx.close();
    }
  }
  /* 2. sign off a strand for a class (Staff entry, an English teacher of 7A/7B) */
  {
    const ls = {"assessmentTracker.staffentry.flowPass":E.STAFF_PASS, "assessmentTracker.staffentry.staffId":"st_115"};
    const P = await open(browser, site, base + "assessment_tracker_staff_entry_V39.html", ls);
    const K = counter(P.pg);
    if(await P.pg.evaluate(() => window.eval("activeTab")) !== "fwentry") await K.click('#subnav button[data-tab="fwentry"], [data-tab="fwentry"]');
    await P.pg.waitForSelector("#fwTable table");
    const strand = await P.pg.$$("[data-fwbulk-strand]");
    if(strand.length){ await K.click("[data-fwbulk-strand]"); }
    else { await K.click("[data-fwbulk]"); await K.click("[data-bk-strand]"); }
    await K.click('#modalScrim .btn:not(.ghost):last-of-type, #modalScrim button:has-text("Sign off")');
    const chip = await savedOK(P.pg);
    out["2. Sign off a strand for a class"] = {clicks:K.c.clicks, keys:K.c.keys, chip:chip, marksRows:site.sp.lists.StatementMarks.length};
    await P.ctx.close();
  }
  /* 3. BTEC status update for a class (SLT copy, Qualifications) */
  {
    const ls = {"assessmentTracker.flowPass":E.PASS, "assessmentTracker.source":"flow", "assessmentTracker.who":"SLT", "assessmentTracker.setupDone":"1", "assessmentTracker.toured":"1"};
    for(const visit of [1, 2]){
      const P = await open(browser, site, base + "assessment_tracker_V39.html", ls);
      const K = counter(P.pg);
      await K.click('#tabs button[data-group="enter"]');
      if(await P.pg.evaluate(() => window.eval("activeTab")) !== "qualentry") await K.click('#subnav button[data-tab="qualentry"]');
      if(await P.pg.$eval("#qeQual", (s) => s.value) !== "q_btecsci") await K.choose("#qeQual", "q_btecsci");
      if(await P.pg.$eval("#qeYear", (s) => s.value) !== "10") await K.choose("#qeYear", "10");
      const n = await P.pg.$$eval('[data-qe="status"]', (a) => a.length);
      if(await P.pg.$("#qeBulkStatus")){ await K.choose("#qeBulkStatus", "atrisk"); await K.click('[data-act="qe-bulk"]'); K.c.clicks++; /* the confirm */ }
      else { for(let i = 0; i < n; i++){ const sel = (await P.pg.$$('[data-qe="status"]'))[i]; await sel.selectOption("atrisk"); K.c.clicks += 2; await P.pg.waitForTimeout(150); } }
      const chip = await savedOK(P.pg);
      out["3. BTEC status for a class (visit " + visit + ")"] = {clicks:K.c.clicks, pupils:n, chip:chip};
      ls["assessmentTracker.picks"] = await P.pg.evaluate(() => localStorage.getItem("assessmentTracker.picks") || "");
      await P.ctx.close();
    }
  }
  console.log(JSON.stringify(out, null, 1));
  await browser.close(); srv.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
