import sys; sys.path.insert(0, "/home/claude/work/patches")
from rp import rp
F = "d_app.js"

rp(F, 'const APP_BUILD = "42.3";', 'const APP_BUILD = "42.4";')
rp(F, """/* ===== CHANGELOG =====
   V42.3""", """/* ===== CHANGELOG =====
   V42.4
   - Import units: a Merge into column. A duplicate unit (the same unit twice, as EfL imports left
     some) is merged into the one it names: every pupil's tick moves across first, then the
     duplicate goes. Nothing ticked is lost.
   - Import units puts each qualification's units in the order of the file.
   V42.3""")

# ---------- export: the new column, and how to use it ----------
rp(F, '''    const rows = [["QualId","Qualification","Type","Board","Module","UnitId","Unit (code and wording)","Credits","Pupils ticked","Remove (Yes to delete)"]];''',
      '''    const rows = [["QualId","Qualification","Type","Board","Module","UnitId","Unit (code and wording)","Credits","Pupils ticked","Remove (Yes to delete)","Merge into (UnitId)"]];''')
rp(F, '''        G.units.forEach(function(u){ rows.push([q.id, q.name, (QUAL_TYPES[q.type] || QUAL_TYPES.other).label, q.board || "", G.name || "", u.id, u.name, u.credits != null ? u.credits : "", ticks[q.id + "|" + u.id] || 0, ""]); });''',
      '''        G.units.forEach(function(u){ rows.push([q.id, q.name, (QUAL_TYPES[q.type] || QUAL_TYPES.other).label, q.board || "", G.name || "", u.id, u.name, u.credits != null ? u.credits : "", ticks[q.id + "|" + u.id] || 0, "", ""]); });''')
rp(F, '''    ws["!cols"] = [{wch:10},{wch:34},{wch:14},{wch:14},{wch:34},{wch:10},{wch:90},{wch:8},{wch:8},{wch:12}];
    ws["!autofilter"] = {ref:"A1:J" + rows.length};''', '''    ws["!cols"] = [{wch:10},{wch:34},{wch:14},{wch:14},{wch:34},{wch:10},{wch:90},{wch:8},{wch:8},{wch:12},{wch:14}];
    ws["!autofilter"] = {ref:"A1:K" + rows.length};''')
rp(F, '''      ["Remove a unit: type Yes in the Remove column (pupils' ticks for it are dropped)."],''',
      '''      ["Remove a unit: type Yes in the Remove column (pupils' ticks for it are dropped)."],
      ["The same unit twice: put the UnitId of the one to keep in Merge into, on the row of the one to lose. Pupils' ticks move across first, then the duplicate goes."],''')

# ---------- read: merges ----------
rp(F, '''                   name:col(r, /^unit\\s*\\(|^unit$|^unit text|wording/i), credits:col(r, /^credits$/i), del:/^(y|yes|x|true|delete|remove)$/i.test(col(r, /^remove/i))};''',
      '''                   name:col(r, /^unit\\s*\\(|^unit$|^unit text|wording/i), credits:col(r, /^credits$/i), del:/^(y|yes|x|true|delete|remove)$/i.test(col(r, /^remove/i)),
                   merge:col(r, /^merge/i), at:plan.rows.length + plan.same + plan.bad};''')
rp(F, '''        const u = x.uid ? (q.units || []).filter(function(v){ return v.id === x.uid; })[0] : null;
        if(x.del){ if(u){ plan.del++; plan.rows.push(x); } return; }''', '''        const u = x.uid ? (q.units || []).filter(function(v){ return v.id === x.uid; })[0] : null;
        /* V42.4: merge a duplicate into the unit named, moving pupils' ticks first */
        if(x.merge){
          const to = (q.units || []).filter(function(v){ return v.id === x.merge; })[0];
          if(!u || !to || to === u){ plan.bad++; return; }
          x.u = u; x.to = to; plan.merge = (plan.merge || 0) + 1;
          const who = {}; (state.qualResults || []).forEach(function(r){ if(r.qualId === q.id && (r.units || []).indexOf(u.id) >= 0) who[r.pupilId] = true; });
          plan.moved = (plan.moved || 0) + Object.keys(who).length;
          plan.rows.push(x); return;
        }
        if(x.del){ if(u){ plan.del++; plan.rows.push(x); } return; }''')
rp(F, '''</li><li>' + plan.del + ' units removed</li><li>' + plan.same + ' unchanged</li>' + (plan.bad ? '<li>' + plan.bad + ' rows skipped (no unit text or qualification)</li>' : '') + '</ul>';
      const go = document.getElementById("quGo"); if(go) go.disabled = !(plan.upd + plan.add + plan.del);''', '''</li><li>' + plan.del + ' units removed</li>' +
        (plan.merge ? '<li>' + plan.merge + ' duplicate unit' + (plan.merge === 1 ? '' : 's') + ' merged, moving ' + (plan.moved || 0) + ' pupil' + (plan.moved === 1 ? '\\u2019s ticks' : 's\\u2019 ticks') + ' across first</li>' : '') +
        '<li>' + plan.same + ' unchanged</li>' + (plan.bad ? '<li>' + plan.bad + ' rows skipped (no unit text or qualification, or a Merge into that isn\\u2019t a unit of the same qualification)</li>' : '') + '</ul>';
      const go = document.getElementById("quGo"); if(go) go.disabled = !(plan.upd + plan.add + plan.del + (plan.merge || 0));''')

# ---------- commit: merges, then the file's order ----------
rp(F, '''    const cr = x.credits === "" ? null : parseFloat(x.credits);
    const u = x.uid ? q.units.filter(function(v){ return v.id === x.uid; })[0] : null;
    if(x.del){''', '''    if(x.merge){
      const from = x.u.id, to = x.to.id;
      (state.qualResults || []).forEach(function(r){
        if(r.qualId !== q.id || !r.units || r.units.indexOf(from) < 0) return;
        const s = r.units.filter(function(id){ return id !== from; });
        if(s.indexOf(to) < 0) s.push(to);
        r.units = s;
      });
      q.units = q.units.filter(function(v){ return v.id !== from; });
      return;
    }
    const cr = x.credits === "" ? null : parseFloat(x.credits);
    const u = x.uid ? q.units.filter(function(v){ return v.id === x.uid; })[0] : null;
    if(x.del){''')
rp(F, '''    if(u){ u.name = x.name; if(x.mod) u.group = x.mod; else delete u.group; u.credits = cr == null || isNaN(cr) ? null : cr; }
    else { const n = {id:uid("un"), name:x.name, credits:cr == null || isNaN(cr) ? null : cr}; if(x.mod) n.group = x.mod; q.units.push(n); }
  });
  Object.keys(touched).forEach(function(id){
    const q = touched[id]; delete q.__groupsFixed;''', '''    if(u){ u.name = x.name; if(x.mod) u.group = x.mod; else delete u.group; u.credits = cr == null || isNaN(cr) ? null : cr; place[u.id] = x.at; }
    else { const n = {id:uid("un"), name:x.name, credits:cr == null || isNaN(cr) ? null : cr}; if(x.mod) n.group = x.mod; q.units.push(n); place[n.id] = x.at; }
  });
  Object.keys(touched).forEach(function(id){
    const q = touched[id]; delete q.__groupsFixed;
    /* V42.4: the units in the file go in the file's order; any not in it keep theirs, after them */
    const was = {}; q.units.forEach(function(u, i){ was[u.id] = i; });
    q.units.sort(function(a, b){ const pa = place[a.id], pb = place[b.id];
      return (pa == null ? 1e9 + was[a.id] : pa) - (pb == null ? 1e9 + was[b.id] : pb); });''')
rp(F, '''function quCommit(){
  const P = quImp; if(!P) return false;
  const made = {}, touched = {};''', '''function quCommit(){
  const P = quImp; if(!P) return false;
  const made = {}, touched = {}, place = {};''')
rp(F, '''  toast("Units imported: " + P.upd + " changed, " + P.add + " added, " + P.del + " removed.", "ok");''',
      '''  toast("Units imported: " + P.upd + " changed, " + P.add + " added, " + P.del + " removed" + (P.merge ? ", " + P.merge + " merged" : "") + ".", "ok");''')
print("p11 ok")
# follow-up: unchanged rows keep their place in the file's order
rp(F, '''          if(u.name === x.name && (u.group || "") === x.mod && (u.credits == null ? null : +u.credits) === (cr == null || isNaN(cr) ? null : cr)) plan.same++;''',
      '''          if(u.name === x.name && (u.group || "") === x.mod && (u.credits == null ? null : +u.credits) === (cr == null || isNaN(cr) ? null : cr)){ plan.same++; (plan.keep = plan.keep || {})[u.id] = x.at; }''')
rp(F, '''  const made = {}, touched = {}, place = {};''', '''  const made = {}, touched = {}, place = Object.assign({}, P.keep || {});''')
