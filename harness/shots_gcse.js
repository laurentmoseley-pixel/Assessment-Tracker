"use strict";
process.env.TZ = "Europe/London";
const fs = require("fs"), path = require("path"), http = require("http");
const {chromium} = require("playwright-core");
const E = require("./env");
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
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
  const axeRun = async (pg, sel) => { await pg.addScriptTag({content:AXE}).catch(() => {}); return pg.evaluate(async (sel) => { const r = await window.axe.run(document.querySelector(sel), {runOnly:{type:"tag", values:["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]}, resultTypes:["violations"]}); return r.violations.map((v) => v.id + ":" + v.nodes.length + " " + v.nodes.slice(0,1).map((n) => n.target.join(" ")).join("")); }, sel); };
  const vp = {width:1366, height:768};
  const ax = (sel) => async (pg) => { const v = await axeRun(pg, sel); console.log("  axe", sel, v.length ? v.join(" | ") : "0 violations"); };
  await go("assessment_tracker_V39.html", SLT, vp, [(pg) => pg.evaluate(() => window.eval("gcseGo('su_english','dp_2026_1','11','')")), ax("#tab-qualentry")], "gcse-english-slt");
  await go("assessment_tracker_V39.html", SLT, vp, [(pg) => pg.evaluate(() => window.eval("gcseGo('*','dp_2026_1','10','')")), ax("#tab-qualentry")], "gcse-grid-slt");
  await go("assessment_tracker_V39.html", SLT, vp, [(pg) => pg.evaluate(() => window.eval("gcseGo('su_science','dp_2026_1','10','')")), ax("#tab-qualentry")], "gcse-science-btec");
  await go("assessment_tracker_V39.html", SLT, vp, [(pg) => pg.evaluate(() => window.eval("switchTab('curentry'); document.getElementById('ceMode').value='list'; document.getElementById('ceSubject').value='su_maths'; document.getElementById('ceDrop').value='dp_2026_1'; document.getElementById('ceYear').value='9'; renderCurEntry();")), ax("#tab-curentry")], "levels-maths-y9");
  await go("assessment_tracker_V39.html", SLT, vp, [(pg) => pg.evaluate(() => window.eval("switchTab('curentry'); document.getElementById('ceMode').value='list'; document.getElementById('ceSubject').value='su_maths'; document.getElementById('ceDrop').value='dp_2026_1'; document.getElementById('ceYear').value='11'; renderCurEntry();"))], "levels-maths-y11");
  await go("assessment_tracker_V39.html", SLT, {width:1366, height:2400}, [(pg) => pg.evaluate(() => window.eval("const p = state.pupils.filter(function(x){ return +x.year === 11 && x.id < 'pu_1080'; })[0]; goToPupil(p.id);")), (pg) => pg.evaluate(() => { const h = [...document.querySelectorAll('#tab-pupil h2, #tab-pupil h3')].find((x) => /Curriculum statements|Qualifications/.test(x.textContent)); if(h) h.scrollIntoView(); }), ax("#tab-pupil")], "pupil-y11");
  await go("assessment_tracker_V39.html", SLT, vp, [(pg) => pg.evaluate(() => window.eval("switchTab('io')")), (pg) => pg.evaluate(() => { const h = [...document.querySelectorAll('#tab-io h2')].find((x) => /Export/.test(x.textContent)); if(h) h.scrollIntoView(); }), ax("#tab-io")], "io-export");
  await go("assessment_tracker_staff_entry_V39.html", ST("st_107"), vp, [(pg) => pg.evaluate(() => window.eval("switchTab('staff' in PAGE_RENDER && ENTRY_TABS.indexOf('staff')>=0 ? 'staff' : 'qualentry'); gcseGo('su_geography','dp_2026_1','','10A')")), ax("#tab-qualentry")], "staff-gcse-geography", "dark");
  await browser.close(); srv.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
