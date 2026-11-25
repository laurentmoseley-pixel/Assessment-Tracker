function profileGcseRows(p){
  const idx = curIndex(), dps = orderedDataPoints();
  return (state.subjects || []).filter(function(su){ return su.active !== false; }).map(function(su){
    if(isHidden("ps:" + p.id + "|" + su.id)) return "";
    /* only subjects with GCSE grades saved for this pupil: grade now, exam result or target */
    const recs = dps.map(function(d){ return {d:d, r:curGet(idx, p.id, su.id, d.id, "predicted")}; }).filter(function(x){ return x.r; });
    const t = curGet(idx, p.id, su.id, "", "target");
    let act = null; dps.forEach(function(d){ const r = curGet(idx, p.id, su.id, d.id, "actual"); if(r) act = r; });
    if(!recs.length && !act && !t) return "";
    const last = recs.length ? recs[recs.length - 1].r : null, g = gcseJudge(p.id, su.id, idx);
    const S = last && g.pred === last && g.status && g.status !== "none" && CUR_STATUS[g.status] ? ' ' + curTag(g.status) : '';
    const steps = recs.slice(-4).map(function(x){ return '<span class="qstep"><span class="muted small">' + esc(x.d.name) + '</span><strong>' + esc(x.r.value) + '</strong></span>'; });
    return '<tr><td><strong>' + esc(gcseEntryName(su)) + '</strong><div class="muted small">GCSE' + (t ? ' \u00b7 target ' + esc(t.value) : '') + '</div></td>' +
      '<td>' + (steps.length ? steps.join('<span class="qarrow" aria-hidden="true">\u203a</span>') : '<span class="muted">No grades yet</span>') + '</td><td>\u2014</td>' +
      '<td>' + (act ? 'Exam result <strong>' + esc(act.value) + '</strong>' : (last ? 'Now <strong>' + esc(last.value) + '</strong>' + S : '\u2014')) + '</td><td>\u2014</td></tr>';
  }).filter(Boolean);
}
