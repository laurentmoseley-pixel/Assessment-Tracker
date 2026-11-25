/* A fake SharePoint site behind a fake TrackerAPI flow.
   Models what the tracker relies on: lists and items, $select/$filter/$orderby/$top, 5,000-item pages
   with odata.nextLink, the list-view threshold on unindexed filters, unique Title and unique key
   columns (case-insensitive, as SharePoint is), DateOnly fields returned as UK midnight in UTC,
   empty text stored as null. The flow checks the passphrase, runs every call (an Apply to each keeps
   going after a failed iteration), and answers 502 if any call failed. Faults can be injected. */
"use strict";
process.env.TZ = "Europe/London";

const SCHEMA_TYPES = {};   /* list -> field -> type, filled from the app's SP_SCHEMA */

class FakeSharePoint {
  constructor(schema, opts){
    opts = opts || {};
    this.schema = schema;            /* the app's SP_SCHEMA */
    this.lists = {};
    this.nextId = {};
    this.threshold = opts.threshold || 5000;
    this.log = [];
    this.createLists(opts.lists || Object.keys(schema));
  }
  createLists(names){
    names.forEach((n) => { if(!this.lists[n]){ this.lists[n] = []; this.nextId[n] = 1; } });
  }
  fieldType(list, f){
    if(f === "Title") return "text";
    const sc = this.schema[list]; if(!sc) return "text";
    const x = sc.fields.filter((a) => a[0] === f || ("_x0066_" + a[0].slice(1)) === f || ("OData__x0066_" + a[0].slice(1)) === f)[0];
    return x ? x[1] : null;
  }
  uniqueCols(list){ const sc = this.schema[list] || {}; return ["Title"].concat(sc.unique || []); }
  indexedCols(list){ const sc = this.schema[list] || {}; return ["Id", "ID", "Title"].concat(sc.unique || [], sc.indexed || []); }
  /* values as SharePoint stores them */
  store(list, f, v){
    const t = this.fieldType(list, f);
    if(t == null) throw spErr(400, "Column '" + f + "' does not exist. It may have been deleted by another user.");
    if(v === undefined) return undefined;
    if(t === "text" || t === "note"){
      if(v === "" || v == null) return null;
      if(typeof v !== "string") v = String(v);
      if(t === "text" && v.length > 255) throw spErr(400, "The field " + f + " is limited to 255 characters.");
      return v;
    }
    if(t === "num"){ if(v === "" || v == null) return null; const n = Number(v); if(isNaN(n)) throw spErr(400, "Bad number for " + f); return n; }
    if(t === "bool1" || t === "bool0"){ if(v == null) return null; return v === true || v === "true" || v === 1 || v === "1"; }
    if(t === "date"){
      if(v == null || v === "") return null;
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
      if(!m) throw spErr(400, "Bad date for " + f);
      /* a DateOnly field keeps the date: send back UK midnight as UTC */
      return new Date(+m[1], +m[2] - 1, +m[3]).toISOString().replace(/\.000Z$/, "Z");
    }
    return v;
  }
  defaults(list){
    const o = {};
    (this.schema[list] ? this.schema[list].fields : []).forEach((a) => {
      const k = a[0] === "fsm6" ? "OData__x0066_sm6" : a[0];
      o[k] = a[1] === "bool1" ? true : (a[1] === "bool0" ? false : null);
    });
    return o;
  }
  uidx(list, c){
    this._u = this._u || {};
    const k = list + "|" + c;
    if(!this._u[k]){ const m = new Map(); (this.lists[list] || []).forEach((x) => { if(x[c] != null && x[c] !== "") m.set(String(x[c]).toLowerCase(), x.Id); }); this._u[k] = m; }
    return this._u[k];
  }
  reindex(list){ if(!this._u) return; Object.keys(this._u).forEach((k) => { if(k.indexOf(list + "|") === 0) delete this._u[k]; }); }
  checkUnique(list, item, selfId){
    if(this.noUnique && this.noUnique[list]) return;
    this.uniqueCols(list).forEach((c) => {
      const v = item[c]; if(v == null || v === "") return;
      const hit = this.uidx(list, c).get(String(v).toLowerCase());
      if(hit != null && hit !== selfId) throw spErr(500, "The list item could not be added or updated because duplicate values were found in the following field(s) in the list: [" + c + "].");
    });
  }
  noteItem(list, it, old){
    if(!this._u) return;
    this.uniqueCols(list).forEach((c) => {
      const k = list + "|" + c, m = this._u[k]; if(!m) return;
      if(old && old[c] != null && old[c] !== "" && m.get(String(old[c]).toLowerCase()) === old.Id) m.delete(String(old[c]).toLowerCase());
      if(it && it[c] != null && it[c] !== "") m.set(String(it[c]).toLowerCase(), it.Id);
    });
  }
  create(list, body){
    if(!this.lists[list]) throw spErr(404, "List '" + list + "' does not exist at site.");
    const it = Object.assign({Id:0}, this.defaults(list));
    Object.keys(body || {}).forEach((k) => { if(k === "__metadata") return; const s = this.store(list, k, body[k]); if(s !== undefined) it[k] = s; });
    if(it.Title == null) it.Title = null;
    this.checkUnique(list, it, -1);
    it.Id = this.nextId[list]++;
    it.ID = it.Id;
    this.lists[list].push(it);
    this.noteItem(list, it, null);
    return Object.assign({}, it);
  }
  update(list, id, body){
    if(!this.lists[list]) throw spErr(404, "List '" + list + "' does not exist at site.");
    const it = this.lists[list].find((x) => x.Id === id);
    if(!it) throw spErr(404, "Item does not exist. It may have been deleted by another user.");
    const next = Object.assign({}, it);
    Object.keys(body || {}).forEach((k) => { if(k === "__metadata") return; const s = this.store(list, k, body[k]); if(s !== undefined) next[k] = s; });
    this.checkUnique(list, next, id);
    const old = Object.assign({}, it);
    Object.assign(it, next);
    this.noteItem(list, it, old);
    return null;
  }
  remove(list, id){
    if(!this.lists[list]) throw spErr(404, "List '" + list + "' does not exist at site.");
    const i = this.lists[list].findIndex((x) => x.Id === id);
    if(i < 0) throw spErr(404, "Item does not exist. It may have been deleted by another user.");
    const old = this.lists[list][i];
    this.lists[list].splice(i, 1);
    this.noteItem(list, null, old);
    return null;
  }
  query(list, q){
    if(!this.lists[list]) throw spErr(404, "List '" + list + "' does not exist at site.");
    let items = this.lists[list].slice();
    const top = q.$top != null ? parseInt(q.$top, 10) : 100;
    if(top > 5000) throw spErr(400, "The $top value is too large.");
    if(q.$filter){
      const ast = parseFilter(q.$filter);
      const cols = filterCols(ast);
      const idx = this.indexedCols(list);
      if(items.length > this.threshold && cols.some((c) => idx.indexOf(c) < 0))
        throw spErr(500, "The attempted operation is prohibited because it exceeds the list view threshold.");
      items = items.filter((it) => evalFilter(ast, it));
    }
    let desc = false;
    if(q.$orderby){
      const m = /^(\w+)(?:\s+(asc|desc))?$/i.exec(q.$orderby.trim());
      if(!m) throw spErr(400, "Bad orderby");
      if(m[1] !== "Id" && m[1] !== "ID" && this.lists[list].length > this.threshold && this.indexedCols(list).indexOf(m[1]) < 0) throw spErr(500, "The attempted operation is prohibited because it exceeds the list view threshold.");
      desc = /desc/i.test(m[2] || "");
      items.sort((a, b) => (a[m[1]] > b[m[1]] ? 1 : a[m[1]] < b[m[1]] ? -1 : 0) * (desc ? -1 : 1));
    } else items.sort((a, b) => a.Id - b.Id);
    let start = 0;
    if(q.$skiptoken){
      const m = /p_ID=(\d+)/.exec(q.$skiptoken);
      const after = m ? +m[1] : 0;
      items = items.filter((x) => desc ? x.Id < after : x.Id > after);
    }
    const page = items.slice(start, start + top);
    const sel = q.$select ? q.$select.split(",").map((s) => s.trim()).filter(Boolean) : null;
    const value = page.map((it) => {
      if(!sel) return Object.assign({}, it);
      const o = {};
      sel.forEach((f) => { if(f in it) o[f] = it[f]; else if(f === "Id") o.Id = it.Id; else if(this.fieldType(list, f) == null) throw spErr(400, "The field or property '" + f + "' does not exist."); else o[f] = null; });
      return o;
    });
    const out = {value:value};
    if(items.length > top){
      const last = page[page.length - 1];
      const keep = Object.keys(q).filter((k) => k !== "$skiptoken").map((k) => k + "=" + encodeURIComponent(q[k]).replace(/%2C/g, ",")).join("&");
      out["odata.nextLink"] = "https://fake.sharepoint.com/sites/x/_api/web/lists/GetByTitle('" + list + "')/items?%24skiptoken=Paged%3dTRUE%26p_ID%3d" + last.Id + "&" + keep;
    }
    return out;
  }
  /* one REST request, as the flow's "Send an HTTP request to SharePoint" runs it */
  request(c){
    const uri = String(c.uri || "");
    let m;
    if(c.method === "GET" && /^_api\/web\/lists\?/.test(uri)){
      return {value:Object.keys(this.lists).map((t) => ({Title:t}))};
    }
    if(c.method === "GET" && /^_api\/web\/?(\?|$)/.test(uri)) return {Title:"Fake site"};
    if((m = /^_api\/web\/lists\/getbytitle\('([^']+)'\)\/items(?:\((\d+)\))?(?:\?(.*))?$/i.exec(uri))){
      const list = m[1], id = m[2] ? +m[2] : null, q = parseQuery(m[3]);
      if(c.method === "GET" && id == null) return this.query(list, q);
      if(c.method === "GET" && id != null){ const it = (this.lists[list] || []).find((x) => x.Id === id); if(!it) throw spErr(404, "Item does not exist."); return Object.assign({}, it); }
      if(c.method === "POST" && id == null) return this.create(list, c.body);
      if((c.method === "PATCH" || c.method === "MERGE") && id != null) return this.update(list, id, c.body);
      if(c.method === "DELETE" && id != null) return this.remove(list, id);
    }
    if(c.method === "POST" && /^_api\/web\/lists$/.test(uri)){ this.createLists([c.body.Title]); return {Title:c.body.Title}; }
    if((m = /^_api\/web\/lists\/getbytitle\('([^']+)'\)\/fields/i.exec(uri))){
      const list = m[1];
      if(!this.lists[list]) throw spErr(404, "List does not exist.");
      if(c.method === "GET"){
        const sc = this.schema[list];
        const f = [{InternalName:"Title", Title:sc ? sc.title : "Title", Indexed:true, EnforceUniqueValues:true}].concat((sc ? sc.fields : []).map((a) => ({InternalName:a[0] === "fsm6" ? "_x0066_sm6" : a[0], Title:a[0], Indexed:(sc.indexed || []).concat(sc.unique || []).indexOf(a[0]) >= 0, EnforceUniqueValues:(sc.unique || []).indexOf(a[0]) >= 0})));
        return {value:f};
      }
      return {};
    }
    throw spErr(400, "Fake SharePoint does not support " + c.method + " " + uri);
  }
  counts(){ const o = {}; Object.keys(this.lists).forEach((n) => { o[n] = this.lists[n].length; }); return o; }
  snapshot(){ return JSON.parse(JSON.stringify(this.lists)); }
}
function spErr(status, msg){ const e = new Error(msg); e.status = status; e.sp = true; return e; }
function parseQuery(s){
  const out = {};
  String(s || "").split("&").forEach((part) => {
    if(!part) return;
    const i = part.indexOf("=");
    const k = decodeURIComponent(i < 0 ? part : part.slice(0, i)), v = i < 0 ? "" : decodeURIComponent(part.slice(i + 1));
    out[k] = v;
  });
  return out;
}
/* ---- a small OData $filter parser: eq ne gt ge lt le, and, or, parentheses ---- */
function tokenize(s){
  const t = []; let i = 0;
  while(i < s.length){
    const ch = s[i];
    if(/\s/.test(ch)){ i++; continue; }
    if(ch === "(" || ch === ")"){ t.push(ch); i++; continue; }
    if(ch === "'"){ let j = i + 1, v = ""; while(j < s.length){ if(s[j] === "'" && s[j + 1] === "'"){ v += "'"; j += 2; continue; } if(s[j] === "'") break; v += s[j++]; } t.push({str:v}); i = j + 1; continue; }
    const m = /^[A-Za-z_][\w]*|^-?\d+(\.\d+)?/.exec(s.slice(i));
    if(!m) throw spErr(400, "Bad filter near " + s.slice(i, i + 10));
    t.push(m[0]); i += m[0].length;
  }
  return t;
}
function parseFilter(s){
  const t = tokenize(s); let p = 0;
  const peek = () => t[p], next = () => t[p++];
  function primary(){
    if(peek() === "("){ next(); const e = orExpr(); if(next() !== ")") throw spErr(400, "Bad filter"); return e; }
    const col = next(), op = next(), val = next();
    if(typeof col !== "string" || ["eq","ne","gt","ge","lt","le"].indexOf(op) < 0) throw spErr(400, "Bad filter: " + s);
    return {col:col, op:op, val:(val && typeof val === "object") ? val.str : (val === "true" ? true : (val === "false" ? false : (val === "null" ? null : Number(val))))};
  }
  function andExpr(){ let e = primary(); while(peek() === "and"){ next(); e = {and:[e, primary()]}; } return e; }
  function orExpr(){ let e = andExpr(); while(peek() === "or"){ next(); e = {or:[e, andExpr()]}; } return e; }
  const e = orExpr();
  if(p !== t.length) throw spErr(400, "Bad filter: " + s);
  return e;
}
function filterCols(e){ if(e.and) return filterCols(e.and[0]).concat(filterCols(e.and[1])); if(e.or) return filterCols(e.or[0]).concat(filterCols(e.or[1])); return [e.col]; }
function evalFilter(e, it){
  if(e.and) return evalFilter(e.and[0], it) && evalFilter(e.and[1], it);
  if(e.or) return evalFilter(e.or[0], it) || evalFilter(e.or[1], it);
  let v = it[e.col]; if(e.col === "ID") v = it.Id;
  const w = e.val;
  const cmp = (typeof v === "string" && typeof w === "string") ? v.toLowerCase().localeCompare(w.toLowerCase()) : (v > w ? 1 : (v < w ? -1 : 0));
  if(e.op === "eq") return (typeof v === "string" && typeof w === "string") ? v.toLowerCase() === w.toLowerCase() : v === w;
  if(e.op === "ne") return !(v === w);
  if(v == null) return false;
  if(e.op === "gt") return cmp > 0; if(e.op === "ge") return cmp >= 0; if(e.op === "lt") return cmp < 0; if(e.op === "le") return cmp <= 0;
  return false;
}

/* ---- the flow ----
   faults: a function (ctx) -> undefined | {when:"before"|"after"|"midway", status, at} called per flow run.
   "before": nothing runs; "after": everything runs but the answer is lost (status returned);
   "midway": calls up to `at` run, then the run stops (as a flow cancelled by its 2-minute limit). */
class FakeFlow {
  constructor(sp, opts){
    opts = opts || {};
    this.sp = sp;
    this.passes = opts.passes || ["test-pass"];
    this.labelled = !!opts.labelled;       /* answers as {i, b} (concurrency on) */
    this.stopOnError = !!opts.stopOnError;
    this.faults = opts.faults || null;
    this.runs = 0; this.calls = 0;
    this.history = [];
    this.allow = opts.allow || null;       /* per-passphrase list allow-list */
    this.msPerCall = opts.msPerCall || 0;
    this.before = null;                    /* hook(run) before a run, to model a colleague */
  }
  /* the fetch the page sees */
  fetch(url, init){
    const self = this;
    return new Promise((resolve, reject) => {
      const go = () => {
        let payload;
        try { payload = JSON.parse(init && init.body); } catch(e){ return resolve(resp(400, {error:{code:"BadRequest", message:"not JSON"}})); }
        self.runs++;
        const run = {n:self.runs, calls:payload.calls || [], key:payload.key};
        if(self.before) try { self.before(run); } catch(e){}
        if(self.passes.indexOf(payload.key) < 0){ self.history.push({run:run.n, status:403}); return resolve(resp(403, {error:"forbidden"})); }
        const f = self.faults ? self.faults(run, self) : null;
        if(f && f.when === "network"){ self.history.push({run:run.n, fault:"network"}); return reject(new TypeError("Failed to fetch")); }
        if(f && f.when === "before"){ self.history.push({run:run.n, status:f.status, fault:"before"}); return resolve(resp(f.status || 502, {error:{code:"Injected", message:"injected before"}})); }
        const calls = run.calls;
        const answers = []; let failed = null;
        const limit = f && f.when === "midway" ? Math.max(0, Math.min(calls.length, f.at == null ? Math.floor(calls.length / 2) : f.at)) : calls.length;
        for(let k = 0; k < limit; k++){
          const c = calls[k];
          if(self.allow && !self.allow(payload.key, c)){ failed = failed || {status:403, msg:"not allowed"}; answers.push({i:c.i, b:{error:"not allowed"}}); continue; }
          try { self.calls++; const b = self.sp.request(c); answers.push({i:c.i == null ? k : c.i, b:b == null ? "" : b}); }
          catch(e){
            failed = failed || {status:e.status || 500, msg:e.message};
            (self.errs = self.errs || []).push({run:run.n, m:c.method, uri:String(c.uri).slice(0, 90), msg:String(e.message).slice(0, 120)});
            answers.push({i:c.i, b:{"odata.error":{message:{value:e.message}}}});
            if(self.stopOnError) break;
          }
        }
        self.history.push({run:run.n, n:calls.length, ran:limit, failed:failed && failed.msg, fault:f && f.when});
        if(f && f.when === "midway") return resolve(resp(f.status || 504, {error:{code:"GatewayTimeout", message:"The flow took longer than 2 minutes"}}));
        if(f && f.when === "after") return resolve(resp(f.status || 502, {error:{code:"Injected", message:"injected after"}}));
        if(failed) return resolve(resp(502, {error:{code:"ActionFailed", message:"An action failed. No dependent actions succeeded. " + failed.msg}}));
        if(self.labelled) return resolve(resp(200, answers.slice().reverse()));
        return resolve(resp(200, answers.map((a) => a.b)));
      };
      if(self.msPerCall) setTimeout(go, self.msPerCall); else Promise.resolve().then(go);
    });
  }
}
function resp(status, body){
  const text = JSON.stringify(body);
  return {status:status, ok:status >= 200 && status < 300, text:() => Promise.resolve(text), json:() => Promise.resolve(JSON.parse(text))};
}
module.exports = {FakeSharePoint, FakeFlow, parseFilter, evalFilter};
