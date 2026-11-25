/* Shared set-up for tests: build a fake site seeded the way V41.x saved it, open SLT or Staff entry copies. */
"use strict";
process.env.TZ = "Europe/London";
const path = require("path");
const {FakeSharePoint, FakeFlow} = require("./fakesp");
const L = require("./loader");
const fixture = require("./fixture");

const PASS = "test-pass", STAFF_PASS = "staff-pass";
function files(dir){
  dir = dir || process.env.TRACKER_DIR || path.join(__dirname, "../out/current");
  return {slt:path.join(dir, "assessment_tracker_V39.html"), staff:path.join(dir, "assessment_tracker_staff_entry_V39.html")};
}
let schemaCache = null;
/* the app's own list design, read from a page */
async function schemaFrom(file){
  if(schemaCache) return schemaCache;
  const sp = new FakeSharePoint({}, {lists:[]});
  const flow = new FakeFlow(sp);
  const t = L.open(file, flow, {localStorage:{"assessmentTracker.source":"excel"}});
  await L.until(() => t.ev("typeof SP_SCHEMA") === "object" && !t.ev("document.body.classList.contains('loading')"));
  schemaCache = JSON.parse(t.ev("JSON.stringify(SP_SCHEMA)"));
  t.close();
  return schemaCache;
}
/* records as the tracker writes them, from a page running `file` (default: the 41.26 baseline build) */
async function recordsFor(model, file){
  const sp = new FakeSharePoint({}, {lists:[]});
  const t = L.open(file, new FakeFlow(sp), {localStorage:{"assessmentTracker.source":"excel"}});
  await L.until(() => t.ev("typeof spRecords") === "function" && t.ev("typeof migrate") === "function" && !t.ev("document.body.classList.contains('loading')"));
  t.w.__model = model;
  const rec = JSON.parse(t.ev("(function(){ const st = migrate(window.__model); return JSON.stringify(spRecords(st)); })()"));
  t.close();
  return rec;
}
async function seededSite(opts){
  opts = opts || {};
  const F = files(opts.dir);
  const writer = opts.writerFile || path.join(__dirname, "../out/baseline-41.26/assessment_tracker_V39.html");
  const schema = await schemaFrom(F.slt);
  const sp = new FakeSharePoint(schema, {threshold:opts.threshold});
  const model = opts.model || fixture.make(opts.fixture);
  const rec = await recordsFor(model, writer);
  ["Settings","DataDrops","Assessments","Subjects","Qualifications","Frameworks","Pupils","Results","CurriculumResults","Baselines","PathwayLog","QualResults","StatementMarks"].forEach((n) => {
    Object.keys(rec[n] || {}).forEach((k) => sp.create(n, rec[n][k]));
  });
  sp.create("Settings", {Title:"savedAt", SettingValue:model.meta.saved});
  sp.create("Settings", {Title:"savedBy", SettingValue:model.meta.savedBy});
  sp.create("Settings", {Title:"appBuild", SettingValue:opts.appBuild || "41.26"});
  return {sp, model, schema, rec};
}
function flowFor(sp, opts){ return new FakeFlow(sp, Object.assign({passes:[PASS, STAFF_PASS], labelled:!!process.env.LABELLED, stopOnError:!!process.env.STOPERR}, opts || {})); }
/* open the SLT copy, connected and unlocked */
async function openSlt(sp, opts){
  opts = opts || {};
  const F = files(opts.dir);
  const flow = opts.flow || flowFor(sp, opts.flowOpts);
  const ls = Object.assign({"assessmentTracker.flowPass":PASS, "assessmentTracker.source":"flow", "assessmentTracker.who":opts.who || "SLT tester",
    "assessmentTracker.setupDone":"1"}, opts.localStorage || {});
  const t = L.open(F.slt, flow, {localStorage:ls, idb:opts.idb, confirm:opts.confirm});
  if(opts.noWait) return t;
  await L.until(() => t.ev("sheetReady === true") || t.ev("document.getElementById('bootBanner').textContent.indexOf('Could not load') >= 0"), opts.timeout || 60000);
  return t;
}
async function openStaff(sp, staffId, opts){
  opts = opts || {};
  const F = files(opts.dir);
  const flow = opts.flow || flowFor(sp, opts.flowOpts);
  const ls = Object.assign({"assessmentTracker.staffentry.flowPass":STAFF_PASS, "assessmentTracker.staffentry.staffId":staffId}, opts.localStorage || {});
  const t = L.open(F.staff, flow, {localStorage:ls, idb:opts.idb, confirm:opts.confirm});
  if(opts.noWait) return t;
  await L.until(() => t.ev("sheetReady === true && !!entryScopeIds"), opts.timeout || 60000);
  return t;
}
/* what the page's tracker holds, in a form that can be compared */
function stateDigest(t){
  return JSON.parse(t.ev(`(function(){
    const st = state;
    const sortBy = (a, k) => a.slice().sort((x, y) => String(x[k]).localeCompare(String(y[k])));
    const pick = (o, ks) => { const r = {}; ks.forEach((k) => { r[k] = o[k]; }); return r; };
    return JSON.stringify({
      pupils: sortBy(st.pupils, "id").map((p) => pick(p, ["id","name","year","group","dob","startDate","pathway","sen","fsm6"])),
      results: sortBy(st.results, "id").map((r) => pick(r, ["id","pupilId","assessmentId","dataPointId","value"])),
      curResults: sortBy(st.curResults, "id").map((r) => pick(r, ["id","pupilId","subjectId","dataPointId","kind","value"])),
      baselines: sortBy(st.baselines || [], "id").map((r) => pick(r, ["pupilId","subjectId","value","date"])),
      qualResults: sortBy(st.qualResults || [], "id").map((r) => pick(r, ["pupilId","qualId","dataPointId","status","units","grade"])),
      fwMarks: sortBy(st.fwMarks || [], "id").map((r) => ({id:r.id, pupilId:r.pupilId, fwId:r.fwId, marks:JSON.stringify(Object.keys(r.marks).sort().map((k) => [k, r.marks[k]]))})),
      pathwayLogs: sortBy(st.pathwayLogs || [], "id").map((l) => pick(l, ["id","pupilId","to","notes"])),
      staff: sortBy(st.staff || [], "id").map((s) => ({id:s.id, subjects:s.subjects.slice().sort(), years:s.years, groups:s.groups})),
      drops: st.settings.dataPoints.map((d) => pick(d, ["id","name","date","winFrom","winTo"])),
      hidden: Object.keys(st.hidden || {}).sort(),
      quals: (st.quals || []).map((q) => ({id:q.id, units:q.units.map((u) => u.id)}))
    });
  })()`));
}
module.exports = {PASS, STAFF_PASS, files, schemaFrom, recordsFor, seededSite, flowFor, openSlt, openStaff, stateDigest, L, fixture};
