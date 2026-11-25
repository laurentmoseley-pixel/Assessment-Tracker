import sys; sys.path.insert(0, "/home/claude/work/patches")
from rp import rp, P
F = "d_app.js"
# the GCSE jump focuses the first grade-now box, not the target
rp(F, '''  const first = document.querySelector("#qeTable .lvlin");
  if(first) first.focus();
}''', '''  const first = document.querySelector('#qeTable .lvlin[data-ctx^="predicted|"]');
  if(first) first.focus();
}''')
# the pupil page lists GCSE only for subjects with GCSE grades saved (new_fn.txt holds the final function)
s = open(P + F, encoding="utf-8").read()
a = s.index("function profileGcseRows(p){"); b = s.index("function profileQualsHtml(p){")
new_fn = open(sys.argv[1] if len(sys.argv) > 1 else "/home/claude/work/patches/p9_profile_gcse_rows.js", encoding="utf-8").read()
open(P + F, "w", encoding="utf-8").write(s[:a] + new_fn + s[b:])
print("p9 ok")
