/* Real-browser pass (Chrome): every page of both files at 1366x768 and 1920x1080, with the flow answered
   by the fake SharePoint (nothing leaves the machine). Console errors, axe-core (WCAG 2.2 A/AA),
   keyboard focus, screenshots.
   Run: node browser.js <dir> <outDir> [quick] */
"use strict";
process.env.TZ = "Europe/London";
const fs = require("fs"), path = require("path"), http = require("http");
const {chromium} = require("playwright-core");
const E = require("./env");
const dir = path.resolve(process.argv[2] || "../out/current"), outDir = path.resolve(process.argv[3] || "../out/browser");
const quick = process.argv[4] === "quick";
fs.mkdirSync(outDir, {recursive:true});
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

function serve(root){
  return new Promise((res) => {
    const srv = http.createServer((q, r) => {
      const f = path.join(root, decodeURIComponent(q.url.split("?")[0]));
      if(!f.startsWith(root) || !fs.existsSync(f)){ r.writeHead(404); r.end(); return; }
      r.writeHead(200, {"content-type":"text/html; charset=utf-8"}); fs.createReadStream(f).pipe(r);
    }).listen(0, "127.0.0.1", () => res(srv));
  });
}
async function page(browser, site, file, ls, vp){
  const ctx = await browser.newContext({viewport:vp, deviceScaleFactor:1});
  const flow = E.flowFor(site.sp);
  await ctx.route("**/*", async (route) => {
    const u = route.request().url();
    if(u.startsWith("http://127.0.0.1")) return route.continue();
    if(/powerplatform\.com|powerautomate|logic\.azure/.test(u)){
      const resp = await flow.fetch(u, {body:route.request().postData()}).catch(() => null);
      if(!resp) return route.abort();
      return route.fulfill({status:resp.status, contentType:"application/json", body:await resp.text()});
    }
    return route.abort();
  });
  await ctx.addInitScript((ls) => { try { if(!sessionStorage.getItem("__seeded")){ Object.keys(ls).forEach((k) => localStorage.setItem(k, ls[k])); sessionStorage.setItem("__seeded", "1"); } } catch(e){} }, ls);
  const pg = await ctx.newPage();
  const errors = [];
  pg.on("console", (m) => { if(m.type() === "error") errors.push(m.text()); });
  pg.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  await pg.goto(file);
  return {ctx, pg, errors, flow};
}
async function axe(pg, sel){
  await pg.addScriptTag({content:AXE}).catch(() => {});
  return pg.evaluate(async (sel) => {
    const r = await window.axe.run(sel ? document.querySelector(sel) : document, {runOnly:{type:"tag", values:["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]}, resultTypes:["violations"]});
    return r.violations.map((v) => ({id:v.id, impact:v.impact, n:v.nodes.length, ex:v.nodes.slice(0, 2).map((n) => n.target.join(" ") + " :: " + (n.failureSummary || "").split("\n").slice(1, 2).join(""))}));
  }, sel);
}
(async () => {
  const site = await E.seededSite();
  const srv = await serve(dir);
  const base = "http://127.0.0.1:" + srv.address().port + "/";
  const browser = await chromium.launch({executablePath:"/usr/bin/google-chrome", args:["--no-sandbox"]});
  const report = {};
  const vps = quick ? [{width:1366, height:768}] : [{width:1366, height:768}, {width:1920, height:1080}];
  for(const which of ["slt", "staff"]){
    for(const vp of vps){
      const ls = which === "slt" ? {"assessmentTracker.flowPass":E.PASS, "assessmentTracker.source":"flow", "assessmentTracker.who":"SLT tester", "assessmentTracker.setupDone":"1", "assessmentTracker.toured":"1"}
                                 : {"assessmentTracker.staffentry.flowPass":E.STAFF_PASS, "assessmentTracker.staffentry.staffId":"st_104"};
      const file = base + (which === "slt" ? "assessment_tracker_V39.html" : "assessment_tracker_staff_entry_V39.html");
      const P = await page(browser, site, file, ls, vp);
      await P.pg.waitForFunction(() => window.eval("typeof sheetReady !== 'undefined' && sheetReady === true"), null, {timeout:60000});
      await P.pg.waitForTimeout(1500);
      const tabs = await P.pg.evaluate(() => Array.prototype.map.call(document.querySelectorAll("section.tabpane"), (s) => s.id.replace(/^tab-/, "")).filter((t) => window.eval("ENTRY_MODE") ? window.eval("ENTRY_TABS").indexOf(t) >= 0 : t !== "classview"));
      const key = which + "@" + vp.width;
      report[key] = {tabs:{}, errors:[]};
      for(const tab of tabs){
        const e0 = P.errors.length;
        await P.pg.evaluate((t) => window.eval("switchTab(" + JSON.stringify(t) + ")"), tab);
        await P.pg.waitForTimeout(quick ? 250 : 600);
        const v = await axe(P.pg, "#tab-" + tab);
        const shot = path.join(outDir, key + "-" + tab + ".png");
        if(!quick || ["dashboard","curentry","fwentry","qualentry","classview","entry","quality","aaaentry","pupil","cur"].indexOf(tab) >= 0) await P.pg.screenshot({path:shot, fullPage:false});
        report[key].tabs[tab] = {axe:v, errors:P.errors.slice(e0)};
      }
      /* keyboard: Tab moves focus and the focused element shows a ring */
      await P.pg.evaluate(() => window.eval("switchTab(" + JSON.stringify(window.eval("ENTRY_MODE") ? "curentry" : "dashboard") + ")"));
      const foc = [];
      for(let i = 0; i < 12; i++){
        await P.pg.keyboard.press("Tab");
        foc.push(await P.pg.evaluate(() => { const a = document.activeElement; if(!a || a === document.body) return null; const cs = getComputedStyle(a); return {tag:a.tagName, id:a.id || a.getAttribute("data-tab") || a.className.slice(0, 30), ring:(cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || /rgb/.test(cs.boxShadow)}; }));
      }
      report[key].keyboard = foc;
      report[key].errors = P.errors;
      await P.ctx.close();
      console.log(key, "tabs", tabs.length, "console errors", P.errors.length, "axe rules failing", Object.keys(report[key].tabs).reduce((n, t) => n + report[key].tabs[t].axe.length, 0),
        "focus ring missing", foc.filter((f) => f && !f.ring).length + "/" + foc.filter(Boolean).length);
    }
  }
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 1));
  await browser.close(); srv.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
