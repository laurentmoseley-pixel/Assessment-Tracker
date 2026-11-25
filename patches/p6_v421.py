import sys; sys.path.insert(0, "/home/claude/work/patches")
from rp import rp
F = "d_app.js"
rp(F, 'const APP_BUILD = "42.0";', 'const APP_BUILD = "42.1";')
rp(F, '''function qualForSubject(pid, sid, dpid){
  const qs = quals().filter(function(q){ return qualSubjectId(q) === sid && qualReplaces(q); });
  for(let i = 0; i < qs.length; i++){
    const rec = qualAt(pid, qs[i].id, dpid);
    if(rec && rec.status !== "withdrawn") return {q:qs[i], rec:rec};
  }
  return null;
}''', '''/* V42.1: a pupil on more than one qualification for the same subject (BTEC Home Cooking Level 1 and
   Level 2, say) is judged by the one they are working on now, and that is the one whose grade box
   shows on Enter levels:
   1. still working towards it (started, on track, at risk, entered), then not started yet, then finished;
   2. among those, the one updated most recently;
   3. then the higher level; then the order on the Qualifications list.
   Before, the first on the list always won, so a Level 1 finished last year could stand in for the
   Level 2 a pupil is doing now, and this half-term's grade was saved against Level 1. */
function qualForSubject(pid, sid, dpid){
  const qs = quals().filter(function(q){ return qualSubjectId(q) === sid && qualReplaces(q); });
  if(qs.length < 2){
    const rec0 = qs.length ? qualAt(pid, qs[0].id, dpid) : null;
    return rec0 && rec0.status !== "withdrawn" ? {q:qs[0], rec:rec0} : null;
  }
  const order = qualIndex().order;
  let best = null;
  qs.forEach(function(q, i){
    const rec = qualAt(pid, q.id, dpid);
    if(!rec || rec.status === "withdrawn") return;
    const k = [QUAL_LIVE[rec.status] ? 3 : (rec.status === "notstarted" ? 2 : 1), order[rec.dataPointId] == null ? -1 : order[rec.dataPointId], QUAL_LEVEL_RANK[q.level] || 0, -i];
    if(!best || k.some(function(v, j){ return k.slice(0, j).every(function(w, m){ return w === best.k[m]; }) && v > best.k[j]; })) best = {q:q, rec:rec, k:k};
  });
  return best ? {q:best.q, rec:best.rec} : null;
}''')
# the level box takes FLS1-FLS10 (five characters), not just three
rp(F, ''' autocomplete="off" spellcheck="false" maxlength="3" title="''', ''' autocomplete="off" spellcheck="false" maxlength="5" title="''')
rp(F, '''/* ===== CHANGELOG =====
''', '''/* ===== CHANGELOG =====
   V42.1
   - Two qualifications for one subject (BTEC Home Cooking Level 1 and Level 2): the subject is judged
     by the one the pupil is working on now, and its grade box is the one on Enter levels. Before, the
     first on the list won, so a finished Level 1 could stand in for Level 2.
   - The level box takes FLS1-FLS10 (it stopped at three characters, so FLS could not be typed).
''')
print("p6 ok")
