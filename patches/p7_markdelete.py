import sys; sys.path.insert(0, "/home/claude/work/patches")
from rp import rp
F = "d_app.js"
rp(F, '''    ops = ops.filter(function(o){ return o.op === "delete"; }).concat(ops.filter(function(o){ return o.op !== "delete"; }));
    return spMergeFetch(ops, peek ? PEEK : null).then(function(peekAns){
      if(peekAns !== undefined){ readPeek(peekAns); peekDone = true; }
    });''', '''    ops = ops.filter(function(o){ return o.op === "delete"; }).concat(ops.filter(function(o){ return o.op !== "delete"; }));
    /* V42.1: clearing the last sign-off on a pupil's framework row removes the row; first check that
       nobody has signed off something else on it meanwhile (if so, just take our ticks off) */
    ops.forEach(function(o){
      if(o.op !== "delete" || o.list !== "StatementMarks" || !spBaseline || !spBaseline.StatementMarks || !spBaseline.StatementMarks[o.key] || !spIds.StatementMarks[o.key]) return;
      const f = Object.assign({}, spBaseline.StatementMarks[o.key]); f.MarksJson = "{}"; f.ReasonsJson = "{}";
      o.fields = f; o.delMerge = true;
    });
    return spMergeFetch(ops, peek ? PEEK : null).then(function(peekAns){
      if(peekAns !== undefined){ readPeek(peekAns); peekDone = true; }
      ops.forEach(function(o){
        if(!o.delMerge) return;
        const mb = o.mergeBody;
        const left = !!mb && Object.keys(mb).some(function(k){ return SP_MERGE[o.list][k] === "obj" ? Object.keys(spJsonObj(mb[k])).length > 0 : String(mb[k] || "") !== ""; });
        if(left){ o.op = "upsert"; o.changed = mb; } else delete o.mergeBody;
      });
    });''')
rp(F, '''  const want = ops.filter(function(o){
    if(o.op !== "upsert" || !SP_MERGE[o.list] || !(spIds[o.list] && spIds[o.list][o.key])) return false;
    if(force) return true;''', '''  const want = ops.filter(function(o){
    if(!(o.op === "upsert" || o.delMerge) || !SP_MERGE[o.list] || !(spIds[o.list] && spIds[o.list][o.key])) return false;
    if(force || o.delMerge) return true;''')
rp(F, '''   - The level box takes FLS1-FLS10 (it stopped at three characters, so FLS could not be typed).
''', '''   - The level box takes FLS1-FLS10 (it stopped at three characters, so FLS could not be typed).
   - Clearing the last sign-off on a pupil's framework no longer removes a colleague's tick added meanwhile.
''')
print("p7 ok")
