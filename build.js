#!/usr/bin/env node
/* Builds both tracker files from one source (src/parts).
   The Staff entry file differs from the SLT file in exactly four places:
   <title>, the app name in the header, COPY_ID and ENTRY_FILE. Each must occur exactly once. */
const fs = require("fs"), path = require("path");
const root = __dirname;
const args = process.argv.slice(2), FAKE = args.indexOf("--fake-flow") >= 0, pos = args.filter(function(a){ return a !== "--fake-flow"; });
const outDir = pos[0] || path.join(root, "out");
const partsDir = pos[1] || path.join(root, "src/parts");   /* e.g. src/parts-41.26 to rebuild the original */
const parts = ["a_head_css.html", "b_body.html", "c_libs.html", "d_app.js", "e_tail.html"];

/* each staff difference lives in one part, where it occurs exactly once */
const VARIANT = [
  ["a_head_css.html", "<title>Assessment Tracker</title>", "<title>Staff entry</title>"],
  ["b_body.html", '<div class="appname"><b>Assessment Tracker</b>', '<div class="appname"><b>Staff entry</b>'],
  ["d_app.js", 'const COPY_ID = "";', 'const COPY_ID = "staffentry";'],
  ["d_app.js", "const ENTRY_FILE = false;", "const ENTRY_FILE = true;"]
];
function countOf(s, x){ let n = 0, i = 0; while((i = s.indexOf(x, i)) >= 0){ n++; i += x.length; } return n; }
const text = {}; parts.forEach(function(p){ text[p] = fs.readFileSync(path.join(partsDir, p), "utf8"); });
/* The Power Automate link holds the flow's key, so it is kept out of the source and out of GitHub.
   The build puts it in from flow-url.txt beside this script (never committed: see .gitignore) or from
   TRACKER_FLOW_URL. --fake-flow puts in a made-up link, for the tests only. With none, the files ask
   each computer to paste the link once (Set up -> Settings & data), as the app always allowed. */
let flow = "", flowFrom = "none: each computer pastes the link once";
if(process.env.TRACKER_NO_FLOW){ flowFrom = "left out on purpose (web version)"; }
else if(FAKE){ flow = "https://fake.environment.api.powerplatform.com/tests-only"; flowFrom = "made-up, for the tests only: don't give these files to anyone"; }
else if(process.env.TRACKER_FLOW_URL){ flow = process.env.TRACKER_FLOW_URL.trim(); flowFrom = "built in from TRACKER_FLOW_URL"; }
else if(fs.existsSync(path.join(root, "flow-url.txt"))){ flow = fs.readFileSync(path.join(root, "flow-url.txt"), "utf8").trim(); flowFrom = "built in from flow-url.txt"; }
if(flow){
  if(!/^https:\/\/\S+$/.test(flow)) throw new Error("the flow link must be one https:// link with no spaces");
  const line = /^const FLOW_URL = "";$/m;      /* the declaration line, not the copies made inside the app */
  if((text["d_app.js"].match(/^const FLOW_URL = "";$/gm) || []).length !== 1) throw new Error('d_app.js must hold the line const FLOW_URL = ""; exactly once (keep the link out of the source)');
  text["d_app.js"] = text["d_app.js"].replace(line, function(){ return "const FLOW_URL = " + JSON.stringify(flow) + ";"; });
}
const staffText = Object.assign({}, text);
VARIANT.forEach(function(v){
  if(countOf(text[v[0]], v[1]) !== 1) throw new Error(v[0] + ": marker must occur exactly once: " + v[1] + " (found " + countOf(text[v[0]], v[1]) + ")");
  staffText[v[0]] = staffText[v[0]].replace(v[1], v[2]);
});
const staff = parts.map(function(p){ return staffText[p]; }).join("");
const src = parts.map(function(p){ return text[p]; }).join("");
const build = (/const APP_BUILD = "([^"]+)";/.exec(src) || [])[1];
if(!build) throw new Error("APP_BUILD not found");
/* the two files must differ in exactly the four lines above, and nowhere else */
const a = src.split("\n"), b = staff.split("\n");
if(a.length !== b.length) throw new Error("line counts differ");
const diff = a.map(function(l, i){ return l === b[i] ? null : i + 1; }).filter(Boolean);
if(diff.length !== 4) throw new Error("expected 4 differing lines, found " + diff.length + ": " + diff.join(","));
fs.mkdirSync(outDir, {recursive:true});
fs.writeFileSync(path.join(outDir, "assessment_tracker_V39.html"), src);
fs.writeFileSync(path.join(outDir, "assessment_tracker_staff_entry_V39.html"), staff);
/* the app script must parse */
const vm = require("vm");
const js = text["d_app.js"];
new vm.Script(js.replace(/^<script>\n/, ""), {filename:"d_app.js"});
console.log("Built V" + build + " -> " + outDir + " (" + Math.round(src.length / 1024) + " KB each). Flow link: " + flowFrom + ".");
