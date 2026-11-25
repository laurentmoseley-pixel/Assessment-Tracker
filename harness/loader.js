/* Opens a tracker file in jsdom against a FakeFlow. Every network call goes to the fake: nothing
   can reach the real flow. Returns helpers to evaluate inside the page. */
"use strict";
process.env.TZ = "Europe/London";
const fs = require("fs");
const {JSDOM, VirtualConsole} = require("jsdom");
const {webcrypto} = require("crypto");
const util = require("util");
const FDB = require("fake-indexeddb");

const htmlCache = {};
/* a page closed while its timers still run can throw from inside jsdom: not a test failure */
process.on("uncaughtException", (e) => {
  const m = String(e && e.stack || e);
  if(/tracker\.test/.test(m) && /reading 'getElementById'|of null|of undefined/.test(m)){ return; }
  if(/runAnimationFrameCallbacks/.test(m) && /reading '_location'/.test(m)){ return; }      /* a frame queued just before the page closed */
  console.error("UNCAUGHT", m); process.exit(2);
});
function readHtml(file){ return htmlCache[file] || (htmlCache[file] = fs.readFileSync(file, "utf8")); }

function open(file, flow, opts){
  opts = opts || {};
  const html = readHtml(file);
  const errors = [], logs = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => { if(!/Not implemented|Could not parse CSS/.test(String(e && e.message))) errors.push(String(e && (e.stack || e.message))); });
  vc.on("error", (...a) => { const m = a.map(String).join(" "); if(!/Failed to create chart/.test(m)) errors.push(m); });
  vc.on("warn", (...a) => logs.push("warn: " + a.map(String).join(" ")));
  vc.on("log", (...a) => logs.push(a.map(String).join(" ")));
  const confirms = opts.confirm == null ? true : opts.confirm;
  const dom = new JSDOM(html, {
    url: opts.url || "https://tracker.test/assessment_tracker_V39.html",
    runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w){
      w.fetch = (u, i) => {
        if(String(u).indexOf("https://") !== 0) return Promise.reject(new Error("blocked"));
        return flow.fetch(u, i);
      };
      w.indexedDB = opts.idb || new FDB.IDBFactory();
      w.IDBKeyRange = FDB.IDBKeyRange;
      Object.defineProperty(w, "crypto", {value: webcrypto, configurable: true});
      w.TextEncoder = util.TextEncoder; w.TextDecoder = util.TextDecoder;
      w.matchMedia = () => ({matches:false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){}});
      w.HTMLCanvasElement.prototype.getContext = () => null;
      if(w.HTMLDialogElement){
        if(!w.HTMLDialogElement.prototype.showModal) w.HTMLDialogElement.prototype.showModal = function(){ this.open = true; this.setAttribute("open", ""); };
        if(!w.HTMLDialogElement.prototype.close) w.HTMLDialogElement.prototype.close = function(){ this.open = false; this.removeAttribute("open"); };
      }
      w.alert = (m) => { logs.push("alert: " + m); };
      w.confirm = (m) => { logs.push("confirm: " + m); return typeof confirms === "function" ? confirms(m) : confirms; };
      w.prompt = () => null;
      w.scrollTo = () => {};
      w.HTMLElement.prototype.scrollIntoView = function(){};
      w.URL.createObjectURL = () => "blob:fake"; w.URL.revokeObjectURL = () => {};
      const ls = opts.localStorage || {};
      Object.keys(ls).forEach((k) => w.localStorage.setItem(k, ls[k]));
      if(opts.before) opts.before(w);
    }
  });
  const w = dom.window;
  const ev = (expr) => w.eval(expr);
  return {dom, w, ev, errors, logs, flow,
    settle: (ms) => settle(w, ms),
    close: () => { try { w.close(); } catch(e){} },
    lsDump: () => { const o = {}; for(let i = 0; i < w.localStorage.length; i++){ const k = w.localStorage.key(i); o[k] = w.localStorage.getItem(k); } return o; }};
}
/* let promises and short timers run */
function settle(w, ms){
  return new Promise((r) => setTimeout(r, ms == null ? 50 : ms));
}
async function until(fn, ms, step){
  const t0 = Date.now();
  while(Date.now() - t0 < (ms || 20000)){
    let v; try { v = fn(); } catch(e){ v = false; }
    if(v) return v;
    await new Promise((r) => setTimeout(r, step || 25));
  }
  throw new Error("timed out waiting");
}
module.exports = {open, settle, until};
