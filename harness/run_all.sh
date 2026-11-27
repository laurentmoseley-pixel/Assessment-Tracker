#!/bin/bash
# runs every test suite against TRACKER_DIR (default ../out/current)
export TRACKER_DIR=${TRACKER_DIR:-../out/current}
fail=0
for f in tests_save.js tests_scope.js tests_calc.js tests_checks.js tests_gcse.js tests_quals.js; do
  echo "### $f"; timeout 1200 node $f || fail=1
done
echo "### tests_fuzz.js"; timeout 1800 node tests_fuzz.js ${FUZZ_SEEDS:-1,2,3,4} ${FUZZ_ROUNDS:-25} || fail=1
exit $fail
