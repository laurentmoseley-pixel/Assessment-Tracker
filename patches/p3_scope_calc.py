import sys; sys.path.insert(0, "/home/claude/work/patches")
from rp import rp
F = "d_app.js"

# ---------- Staff entry: refuse at the box what can't be saved ----------
rp(F, '''/* why there is nothing to enter, if there isn't */
function entryBlocked(){''', '''/* V42: Staff entry may only change what entryScope lets it save. Anything else is refused where it is
   typed, with a message, instead of looking saved and never reaching SharePoint. kind: cur (levels and
   grades, by subject), res (assessment results), qual, fw (sign-offs), aaa. */
let entryRefusedAt = 0;
function entryMay(kind, pid, a, dpid){
  if(!ENTRY_MODE) return true;
  const ids = entryScopeIds;
  let ok = !!(ids && ids.pupils[pid]);
  if(ok && kind === "cur") ok = !!(ids.drops[dpid] && ids.subjects[a] && (!ids.pairs || (ids.pairs[pid] && ids.pairs[pid][a])));
  if(ok && kind === "res") ok = !!(ids.drops[dpid] && ids.assessments[a]);
  if(ok && kind === "qual") ok = !!(ids.drops[dpid] && ids.quals && ids.quals[a]);
  if(ok && kind === "fw") ok = !!(ids.fws && ids.fws[a]);
  if(!ok && Date.now() - entryRefusedAt > 3000){
    entryRefusedAt = Date.now();
    try { toast("That isn\\u2019t one of your pupils and subjects in an open window, so Staff entry can\\u2019t save it. Nothing was changed.", "bad"); } catch(e){}
  }
  return ok;
}
/* why there is nothing to enter, if there isn't */
function entryBlocked(){''')
rp(F, '''function setResult(pupilId, assessmentId, dataPointId, value){
  const existing = resultFor(pupilId, assessmentId, dataPointId);''', '''function setResult(pupilId, assessmentId, dataPointId, value){
  if(!entryMay("res", pupilId, assessmentId, dataPointId)) return false;
  const existing = resultFor(pupilId, assessmentId, dataPointId);''')
rp(F, '''function setCurResult(pid, sid, dpid, kind, value){
  const v = String(value==null?"":value).trim();''', '''function setCurResult(pid, sid, dpid, kind, value){
  if(!entryMay("cur", pid, sid, dpid)) return false;
  const v = String(value==null?"":value).trim();''')
rp(F, '''function setQualResult(pid, qid, dpid, patch){
  state.qualResults = state.qualResults || [];''', '''function setQualResult(pid, qid, dpid, patch){
  if(!entryMay("qual", pid, qid, dpid)) return false;
  state.qualResults = state.qualResults || [];''')
rp(F, '''function fwSet(pid, fwId, stId, status, extra){
  const r = fwRow(pid, fwId, true);''', '''function fwSet(pid, fwId, stId, status, extra){
  if(!entryMay("fw", pid, fwId)) return false;
  const r = fwRow(pid, fwId, true);''')

# ---------- Enter levels: a box saves to the drop and kind it was drawn for ----------
rp(F, '''function commitCurInput(el){
  const kind = document.getElementById("ceKind").value || "level";
  const dpId = document.getElementById("ceDrop").value;''', '''function commitCurInput(el){
  /* V42: the kind and drop the box was drawn for (data-ctx), not whatever the menus say now */
  const ctx = String(el.getAttribute("data-ctx") || "").split("|");
  const kind = ctx[0] || document.getElementById("ceKind").value || "level";
  const dpId = ctx.length > 1 && (ctx[1] || kind === "target") ? (ctx[1] || document.getElementById("ceDrop").value) : document.getElementById("ceDrop").value;''')
rp(F, '''  const had = curGet(curIndex(), pid, sid, kind==="target" ? "" : dpId, kind);
  if((had ? had.value : "") !== r.value) setCurResult(pid, sid, kind==="target" ? "" : dpId, kind, r.value);''', '''  const had = curGet(curIndex(), pid, sid, kind==="target" ? "" : dpId, kind);
  if((had ? had.value : "") !== r.value && setCurResult(pid, sid, kind==="target" ? "" : dpId, kind, r.value) === false){
    el.value = had ? had.value : ""; el.classList.add("bad-input"); el.title = "Staff entry can\\u2019t change this box"; return false;
  }''')
rp(F, '''        ? '<select class="qualgradein" data-qualgrade="' + p.id + '|' + qf.q.id + '" aria-label="' + lab + '"''', '''        ? '<select class="qualgradein" data-qualgrade="' + p.id + '|' + qf.q.id + '" data-dp="' + dp.id + '" aria-label="' + lab + '"''')
rp(F, '''        : '<input class="qualgradein" data-qualgrade="' + p.id + '|' + qf.q.id + '" value="' + esc(v) + '"''', '''        : '<input class="qualgradein" data-qualgrade="' + p.id + '|' + qf.q.id + '" data-dp="' + dp.id + '" value="' + esc(v) + '"''')
rp(F, '''      const pq = t.getAttribute("data-qualgrade").split("|"), dpId = document.getElementById("ceDrop").value, v = String(t.value || "").trim();''',
      '''      const pq = t.getAttribute("data-qualgrade").split("|"), dpId = t.getAttribute("data-dp") || document.getElementById("ceDrop").value, v = String(t.value || "").trim();''')

# ---------- one status for a pupil on a qualification that replaces the subject's level ----------
rp(F, '''function subjStatus(p, su, idx, uptoDp){
  idx = idx || curIndex();''', '''function subjStatus(p, su, idx, uptoDp){
  idx = idx || curIndex();
  /* V42: a pupil on a qualification that stands in for this subject (BTEC Science, BTEC Sport, catering)
     is judged by its grade on every page and report, as the Curriculum page and profile already did:
     up = ahead, the same = on track, down = well behind; with fewer than two grades, by its status */
  const qDp = uptoDp || latestStartedDrop();
  const QR = qDp ? qualRowFor(p, su, qDp) : null;
  if(QR) return {st:QR.status, j:{status:"none"}, g:{status:"none", target:null, pred:null, predDp:null, actual:null}, last:null, ser:[], gc:false, stale:false,
                 ctxDp:QR.qlast ? QR.qlast.dp : (byId(state.settings.dataPoints, QR.qnow.dataPointId) || qDp), qual:QR};''')
rp(F, '''/* a pupil judged by a qualification grade: up, the same, or down on their last grade */
function ceQualStatus(p, qf, dp){
  const o = {html:'<span class="muted">' + esc(qualShort(qf.q)) + '</span>', cls:"", rowCls:"", title:qualTitle(qf.q)};
  const own = qualOwnAt(p.id, qf.q.id, dp.id);
  if(!own || !own.grade) return o;''', '''/* a pupil judged by a qualification grade: up, the same, or down on their last grade */
function ceQualStatus(p, qf, dp){
  const o = {html:'<span class="muted">' + esc(qualShort(qf.q)) + '</span>', cls:"", rowCls:"", title:qualTitle(qf.q)};
  const own = qualOwnAt(p.id, qf.q.id, dp.id);
  if(!own || !own.grade) return o;
  /* V42: with no earlier grade to compare, the status the Curriculum page shows (from the qualification
     status: at risk = behind), not a green "on track" for every first grade */
  const R = qualRowFor(p, byId(state.subjects, (qf.q && qualSubjectId(qf.q)) || "") || {id:qualSubjectId(qf.q)}, dp);
  if(R && !(R.qlast && R.qprev)){ o.html = qualRowTag(R); o.cls = "s-" + R.status; o.rowCls = R.status === "well" ? "row-concern" : (R.status === "behind" ? "row-watch" : ""); return o; }''')
# triangulation: a qualification pupil is described by their grade
rp(F, '''    const st = subjStatus(p, su, idx).st;
    if(["ahead","ontrack","behind","well"].indexOf(st) < 0) return;
    as.forEach(function(a){''', '''    const S0 = subjStatus(p, su, idx), st = S0.st;
    if(["ahead","ontrack","behind","well"].indexOf(st) < 0) return;
    const inWhat = S0.qual ? "their " + qualShort(S0.qual.qual) + " grade" : "levels";
    as.forEach(function(a){''')
rp(F, '''        out.push({su:su, a:a, kind:"levels-up", why:su.name+': '+(CUR_STATUS[st] || {}).label+' in levels, but '+shortAsmName(a)+' is '+(l.ev.display || l.r.value)+' (Concern, '+l.dp.name+')'});''',
      '''        out.push({su:su, a:a, kind:"levels-up", why:su.name+': '+(CUR_STATUS[st] || {}).label+' in '+inWhat+', but '+shortAsmName(a)+' is '+(l.ev.display || l.r.value)+' (Concern, '+l.dp.name+')'});''')
rp(F, '''        out.push({su:su, a:a, kind:"levels-down", why:su.name+': '+(CUR_STATUS[st] || {}).label+' in levels, but '+shortAsmName(a)+' is '+(l.ev.display || l.r.value)+' (Secure, '+l.dp.name+')'});''',
      '''        out.push({su:su, a:a, kind:"levels-down", why:su.name+': '+(CUR_STATUS[st] || {}).label+' in '+inWhat+', but '+shortAsmName(a)+' is '+(l.ev.display || l.r.value)+' (Secure, '+l.dp.name+')'});''')
# reports: a row for a qualification pupil
rp(F, '''      const S = subjStatus(p, su, idx);
      const ser = S.ser, g = S.g, last = S.last, j = S.j, st = S.st;
      if(!ser.length && !g.target && !g.pred && !g.actual) return;
      const m = subjectMetrics(p, su, idx);''', '''      const S = subjStatus(p, su, idx);
      const ser = S.ser, g = S.g, last = S.last, j = S.j, st = S.st;
      if(S.qual){
        /* V42: judged by a qualification grade (BTEC and similar), as on the Curriculum page */
        const Q = S.qual;
        if(["ahead","ontrack","behind","well"].indexOf(st) >= 0){ n++; if(st==="ahead" || st==="ontrack") on++; }
        const qs = QUAL_STATUS_BY[Q.qnow.status];
        bySub.push([p.name, p.upn||"", p.year, p.group||"", PATHWAY_LABELS[p.pathway]||"", su.name, qualTitle(Q.qual),
          Q.qprev ? Q.qprev.r.grade : "", Q.qprev ? Q.qprev.dp.name : "", Q.qlast ? Q.qlast.r.grade : (qs ? qs.label : ""), Q.qlast ? Q.qlast.dp.name : "",
          Q.qlast && Q.qprev ? (st === "ahead" ? "up" : (st === "ontrack" ? "same" : "down")) : "", "",
          (CUR_STATUS[st] || CUR_STATUS.none).label.replace("—", ""), "", "", "", "", "", "", "", "", ""]);
        return;
      }
      if(!ser.length && !g.target && !g.pred && !g.actual) return;
      const m = subjectMetrics(p, su, idx);''')
# a level judgement can't run without a start point
rp(F, '''  const sp = judgeStart(pid, sid, idx, when, base);
  out.start = sp;''', '''  const sp = judgeStart(pid, sid, idx, when, base);
  out.start = sp;
  if(!sp || sp.score == null || isNaN(sp.score)){ out.status = "nobase"; return out; }   /* V42: an unreadable start counted as Well behind */''')
# data checks: no "no result this year" or "lower than joining" for a subject a qualification stands in for
rp(F, '''      if(isHidden("ps:" + p.id + "|" + su.id)) return;
      const S = subjStatus(p, su, idx);
      if(!S.stale) return;''', '''      if(isHidden("ps:" + p.id + "|" + su.id)) return;
      const S = subjStatus(p, su, idx);
      if(!S.stale || S.qual) return;''')
rp(F, '''      if(isHidden("ps:" + p.id + "|" + su.id)) return;
      const m = subjectMetrics(p, su, idx);
      if(!m.last) return;''', '''      if(isHidden("ps:" + p.id + "|" + su.id)) return;
      const m = subjectMetrics(p, su, idx);
      if(!m.last) return;
      if(qualForSubject(p.id, su.id, (latestStartedDrop() || {}).id)) return;   /* V42: judged by a qualification grade instead */''')
print("p3 ok")
