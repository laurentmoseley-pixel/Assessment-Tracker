#!/usr/bin/env node
/* Builds the web version for GitHub Pages: app/ (SLT) and staff/ (Staff entry).
   These are public, so the flow link is always left out, even if flow-url.txt is on this computer:
   each computer pastes the link once. Each gets a web app manifest so Edge, Chrome and iPad can
   install it as an app. Run from the repository root: node tools/build-pages.js */
const fs = require("fs"), path = require("path"), cp = require("child_process");
const root = path.join(__dirname, ".."), tmp = path.join(root, "out", "pages-build");
cp.execFileSync(process.execPath, [path.join(root, "build.js"), tmp], {env:Object.assign({}, process.env, {TRACKER_NO_FLOW:"1"}), stdio:"inherit"});
const apps = [
  {dir:"app", file:"assessment_tracker_V39.html", name:"Assessment Tracker", short:"Tracker"},
  {dir:"staff", file:"assessment_tracker_staff_entry_V39.html", name:"Staff entry", short:"Staff entry"}
];
apps.forEach(function(a){
  let html = fs.readFileSync(path.join(tmp, a.file), "utf8");
  if((html.match(/^const FLOW_URL = "";$/gm) || []).length !== 1) throw new Error(a.file + ": the flow link must be empty in the web version");
  if(/sig=|environment\.api\.powerplatform\.com:443/.test(html)) throw new Error(a.file + ": something that looks like a flow link is in the web version");
  const head = '</title>\n<link rel="manifest" href="manifest.webmanifest">\n<meta name="theme-color" content="#0B6B58">\n' +
    '<link rel="icon" href="../assets/icon.svg" type="image/svg+xml">\n<link rel="apple-touch-icon" href="../assets/icon-180.png">\n<meta name="apple-mobile-web-app-title" content="' + a.short + '">';
  if(html.indexOf("</title>") < 0) throw new Error("no </title>");
  html = html.replace("</title>", function(){ return head; });
  fs.mkdirSync(path.join(root, a.dir), {recursive:true});
  fs.writeFileSync(path.join(root, a.dir, "index.html"), html);
  fs.writeFileSync(path.join(root, a.dir, "manifest.webmanifest"), JSON.stringify({
    id:"./", name:a.name, short_name:a.short, start_url:"./", scope:"./", display:"standalone",
    background_color:"#F5F6FA", theme_color:"#0B6B58",
    icons:[{src:"../assets/icon-192.png", sizes:"192x192", type:"image/png"}, {src:"../assets/icon-512.png", sizes:"512x512", type:"image/png"},
           {src:"../assets/icon.svg", sizes:"any", type:"image/svg+xml"}]
  }, null, 2) + "\n");
  console.log("Web version: " + a.dir + "/index.html (" + a.name + ", no flow link)");
});
