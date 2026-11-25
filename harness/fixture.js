/* A made-up school, in the tracker's own data model. Every name is invented.
   About 150 pupils (Years 3-13), 20 staff, 15 subjects, three school years of drops, levels, GCSE
   grades in Years 10-11, BTEC Science / Sport and a catering award replacing levels for some pupils,
   summative results, baselines, two curriculum frameworks with sign-offs, AAA pathways and logs,
   individually added pupils, and one teacher with so many subjects their list is stored in pieces. */
"use strict";
function rng(seed){ let s = seed >>> 0; return function(){ s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const FIRST = ["Arlo","Bryn","Cass","Dex","Elowen","Fenn","Gwen","Hollis","Isla","Jago","Kit","Lowen","Merryn","Nye","Ottilie","Pip","Quill","Rowan","Sennen","Tamsin","Ula","Vane","Wren","Xan","Yestin","Zennor","Alfie","Bea","Cormac","Demelza"];
const LAST = ["Applewood","Brackenridge","Carnhill","Dunmere","Eastholt","Fernlow","Gorsewick","Hallowmere","Ivybridge","Jessamy","Kestlemoor","Larkworthy","Mabehill","Nantcove","Oakhurst","Penwithen","Quarrymoor","Rosemellin","Saltbrook","Treleven","Upcott","Vellandruck","Whitesand","Yarncombe"];
const SUBJECTS = ["English","Maths","Science","PE","Art","Computing","History","Geography","Music","Food Technology","PSHE","RE","Design Technology","Vocational Studies","Spanish"];

function make(opts){
  opts = opts || {};
  const r = rng(opts.seed || 42);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const nPupils = opts.pupils || 150;
  const subjects = SUBJECTS.map((n, i) => ({id:"su_" + n.toLowerCase().replace(/[^a-z]+/g, "").slice(0, 12), name:n, active:true, years:"", order:i + 1}));
  const sid = (name) => subjects.find((s) => s.name === name).id;
  /* drops: six a year for 2024-25 and 2025-26, then the two so far in 2026-27 (one open now) */
  const dps = [];
  [2024, 2025].forEach((y) => {
    [["Aut1", y + "-10-18"], ["Autumn", y + "-12-13"], ["Spr1", (y + 1) + "-02-13"], ["Spring", (y + 1) + "-03-28"], ["Sum1", (y + 1) + "-05-22"], ["Summer", (y + 1) + "-07-11"]]
      .forEach((d, i) => dps.push({id:"dp_" + y + "_" + i, name:d[0] + " " + (d[1].slice(0, 4)), date:d[1]}));
  });
  dps.push({id:"dp_2026_0", name:"Aut1 2026", date:"2026-10-16"});
  dps.push({id:"dp_2026_1", name:"Autumn 2026", date:"2026-12-11", winFrom:"2026-11-16", winTo:"2026-12-18"});
  const pupils = [];
  for(let i = 0; i < nPupils; i++){
    const year = 3 + Math.floor(r() * 11);           /* Years 3-13 */
    const first = FIRST[i % FIRST.length], last = LAST[(i * 7 + 3) % LAST.length];
    const dobY = 2026 - year - 5, startY = 2026 - Math.floor(r() * Math.min(5, year));
    const p = {id:"pu_" + String(1000 + i), name:first + " " + last, surname:last, firstName:first, initials:first[0] + last[0],
      year:year, group:year + (r() < 0.5 ? "A" : "B"), tutor:"", form:"", dob:dobY + "-0" + (1 + Math.floor(r() * 9)) + "-1" + Math.floor(r() * 9),
      startDate:startY + "-09-0" + (1 + Math.floor(r() * 8)), upn:"", gender:r() < 0.7 ? "M" : "F", ethnicity:"", priorEducation:"", notes:"",
      pathway:year >= 10 && year <= 11 ? pick(["attain","attune_learn","attune_school","attend"]) : ""};
    ["sen","ehcp","pp","fsm6","lac","cp"].forEach((k) => { p[k] = r() < 0.2; });
    pupils.push(p);
  }
  /* a pupil in a group of a different age (Data checks should flag it) */
  pupils[5].group = "10A"; pupils[5].year = 6;
  const staff = [];
  for(let i = 0; i < 20; i++){
    const s = subjects[i % subjects.length];
    const subs = [s.id]; if(i % 3 === 0) subs.push(subjects[(i + 5) % subjects.length].id);
    const y = 3 + (i % 11);
    staff.push({id:"st_" + (100 + i), name:FIRST[(i + 11) % FIRST.length] + " " + LAST[(i + 5) % LAST.length] + " (staff)", initials:"T" + i, subjects:subs,
      years:i % 4 === 0 ? String(y) + ", " + (y + 1) : "", groups:i % 4 !== 0 ? (y + "A, " + y + "B") : "", role:i === 0 ? "slt" : "teacher", email:"teacher" + i + "@school.test"});
  }
  /* a teacher with every subject: stored in 240-character pieces */
  staff[1].subjects = subjects.map((x) => x.id);
  staff[1].years = "7, 8, 9";  staff[1].groups = "";
  const hidden = {};
  /* individually added pupils: pupil 3 in teacher 4's Science grid; pupil 7 takes Spanish */
  hidden["sx:st_104|pu_1003|" + sid("Science")] = true;
  hidden["pt:pu_1007|" + sid("Spanish")] = true;
  /* levels and grades */
  const curResults = [];
  const lv = (x) => { x = Math.max(1, Math.min(9.67, x)); const st = Math.round((x - 1) * 3); return (Math.floor(st / 3) + 1) + ["E","D","S"][st % 3]; };
  const coreSubs = ["English","Maths","Science","PE","Art","Computing","History","Geography","PSHE","Food Technology"].map(sid);
  pupils.forEach((p, pi) => {
    coreSubs.forEach((s, si) => {
      let base = Math.max(1, p.year - 2 - r() * 2);
      dps.forEach((d, di) => {
        if(d.date < p.startDate) return;
        if(di === dps.length - 1 && r() < 0.5) return;     /* the open drop: half done */
        const yAt = p.year - (2026 - (+d.date.slice(0, 4) + (+d.date.slice(5, 7) >= 9 ? 1 : 0)));
        const onGcse = yAt >= 10;
        if(onGcse && ["English","Maths","Science"].map(sid).indexOf(s) >= 0){
          curResults.push({id:"cr_" + pi + "_" + si + "_" + di, pupilId:p.id, subjectId:s, dataPointId:d.id, kind:"predicted", value:String(Math.max(1, Math.min(9, Math.round(base / 2 + r() * 2))))});
        } else {
          base += 0.12 + r() * 0.2;
          curResults.push({id:"cr_" + pi + "_" + si + "_" + di, pupilId:p.id, subjectId:s, dataPointId:d.id, kind:"level", value:lv(base)});
        }
      });
    });
    if(p.year >= 10 && p.year <= 11) ["English","Maths"].forEach((n) => curResults.push({id:"crt_" + pi + "_" + n, pupilId:p.id, subjectId:sid(n), dataPointId:"", kind:"target", value:String(4 + Math.floor(r() * 3))}));
  });
  /* qualifications replacing levels: BTEC Science, BTEC Sport, a catering award */
  const quals = [
    {id:"q_btecsci", name:"BTEC Applied Science", type:"btec", board:"Pearson", level:"L12", subjectId:sid("Science"), units:[{id:"u1", name:"Unit 1 Principles of science", credits:null}, {id:"u2", name:"Unit 2 Chemistry and our earth", credits:null}, {id:"u3", name:"Unit 3 Energy and our universe", credits:null}], active:true},
    {id:"q_btecsport", name:"BTEC Sport", type:"btec", board:"Pearson", level:"L12", subjectId:"", units:[{id:"s1", name:"Fitness for sport and exercise", credits:null}, {id:"s2", name:"Practical performance in sport", credits:null}], active:true},
    {id:"q_cater", name:"Hospitality and Catering", type:"cg", board:"City & Guilds", level:"L1", subjectId:sid("Food Technology"), units:[{id:"c1", name:"Food safety", credits:2}, {id:"c2", name:"Cooking skills", credits:3}], active:true},
    {id:"q_asdan", name:"ASDAN Short Course", type:"asdan", board:"ASDAN", level:"", subjectId:"", units:[{id:"a1", name:"1A1 Plan a trip", credits:null}], active:true}
  ];
  const qualResults = [];
  const ks4 = pupils.filter((p) => p.year >= 10 && p.year <= 11);
  ks4.forEach((p, k) => {
    const on = [];
    if(k % 3 === 0) on.push("q_btecsci");          /* a third of KS4 do BTEC Science; the rest GCSE */
    if(k % 4 === 1) on.push("q_btecsport");
    if(k % 5 === 2) on.push("q_cater");
    on.forEach((qid) => {
      const grades = qid === "q_cater" ? [] : ["Level 1 Pass","Level 1 Merit","Level 2 Pass","Level 2 Merit"];
      dps.slice(-4).forEach((d, i) => {
        if(i === 3 && k % 2) return;
        qualResults.push({id:"qr_" + p.id + "_" + qid + "_" + d.id, pupilId:p.id, qualId:qid, dataPointId:d.id,
          status:i === 0 ? "started" : (k % 6 === 0 && i > 1 ? "atrisk" : "ontrack"), units:i > 1 ? ["u1"] : [], grade:grades.length && i > 0 && k % 7 !== 0 ? grades[Math.min(grades.length - 1, i - 1)] : "",
          cert:false, due:"", note:""});
      });
    });
  });
  /* summative assessments and results */
  const assessments = [
    {id:"as_read", name:"Accelerated Reader — reading age", subject:"English", type:"age", active:true, cfg:{concernMonths:18, watchMonths:9, expectedGain:0.5}},
    {id:"as_mtest", name:"Star Maths scaled score", subject:"Maths", type:"scaled", active:true, cfg:{concernBelow:400, watchBelow:500, declineBy:25}},
    {id:"as_ta", name:"Teacher assessment", subject:"All subjects", type:"band", active:true, cfg:{options:"Well below, Below, Working towards, Expected, Above", concernValues:"Well below, Below", watchValues:"Working towards"}}
  ];
  const results = [];
  pupils.forEach((p, i) => dps.slice(-5).forEach((d, j) => {
    if(r() < 0.3) return;
    results.push({id:"re_" + i + "_" + j + "_m", pupilId:p.id, assessmentId:"as_mtest", dataPointId:d.id, value:String(300 + Math.floor(r() * 400))});
    if(r() < 0.5) results.push({id:"re_" + i + "_" + j + "_r", pupilId:p.id, assessmentId:"as_read", dataPointId:d.id, value:(p.year + 4) + "." + String(Math.floor(r() * 12)).padStart(2, "0")});
  }));
  const baselines = pupils.slice(0, 30).map((p, i) => ({id:"bl_" + i, pupilId:p.id, subjectId:sid("English"), value:lv(Math.max(1, p.year - 4)), date:p.startDate, source:"manual"}));
  /* frameworks with sign-offs */
  const mkFw = (id, name, subj) => ({id:id, name:name, subjectId:sid(subj), kind:"levels", version:"2026", active:true,
    levels:[1, 2, 3, 4, 5].map((L) => ({id:"L" + L, name:"Level " + L, map:"", equiv:"", statements:Array.from({length:12}, (_, k) => ({id:id + "_" + L + "_" + k, strand:["Reading","Writing","Number","Shape"][k % 4], ref:L + "." + k, text:"Statement " + k + " at level " + L + " for " + name, key:k % 5 === 0, ht:"", retired:false}))}))});
  const frameworks = [mkFw("fw_eng", "English framework", "English"), mkFw("fw_ma", "Maths framework", "Maths")];
  const fwMarks = [];
  pupils.slice(0, 80).forEach((p, i) => frameworks.forEach((f) => {
    const marks = {};
    f.levels.slice(0, 2).forEach((L) => L.statements.forEach((s, k) => { if((i + k) % 3) marks[s.id] = [1 + ((i + k) % 3), "2026-10-0" + (1 + (k % 9)), "T" + (i % 9)]; }));
    fwMarks.push({id:"fm_" + p.id + "_" + f.id, pupilId:p.id, fwId:f.id, marks:marks, reasons:{}});
  }));
  const pathwayLogs = ks4.slice(0, 20).map((p, i) => ({id:"lg_" + i, pupilId:p.id, ts:"2026-10-" + String(10 + i % 15).padStart(2, "0") + "T10:00", from:"", to:p.pathway, reason:"review", notes:"Note " + i, action:"", staff:"T" + i, type:"review"}));
  return {
    meta:{version:1, school:"Testwood School", academicYear:"2026-27", saved:"2026-11-20T10:00:00.000Z", savedBy:"Fixture", appVersion:41},
    settings:{dataPoints:dps, rules:{minConcerns:2, declineCounts:true}, cur:{rate:0.8, tolSteps:0.5, wellSteps:3, gcseFrom:10, staleDays:28, judgeFrom:"join", minYears:0.4, paceCap:1.25, paceMinDrops:3, gcseProjFrom:7, ks4Judge:"expected"}, fw:{}},
    assessments:assessments, pupils:pupils, leavers:[], results:results, subjects:subjects, curResults:curResults, baselines:baselines,
    pathwayLogs:pathwayLogs, quals:quals, qualResults:qualResults, frameworks:frameworks, fwMarks:fwMarks, staff:staff, hidden:hidden, gcseEarly:{}, gcseBySub:{}
  };
}
module.exports = {make, SUBJECTS};
