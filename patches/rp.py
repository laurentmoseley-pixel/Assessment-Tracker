import sys
P = "/home/claude/work/src/parts/"
def rp(fname, a, b, n=1):
    p = P + fname
    s = open(p, encoding="utf-8").read()
    c = s.count(a)
    if c != n:
        raise SystemExit("PATCH FAIL in %s: expected %d, found %d for:\n%s" % (fname, n, c, a[:300]))
    s = s.replace(a, b)
    open(p, "w", encoding="utf-8").write(s)
