# Assessment Tracker and Staff entry

The SLT tracker and the Staff entry file, built from one source, with the test harness and the
release notes. Current version: **V42.2**.

There's no pupil data here. The tests use a made-up school. The real data lives in SharePoint and
is reached through the TrackerAPI Power Automate flow.

**The flow's link isn't in this repository** because it holds the flow's key. The build adds it from a file on your computer that is never committed (see below).

## Make the two files for school

1. Put the flow's link in a file called `flow-url.txt` next to `build.js`. It should be one line, starting `https://`.
   - Git ignores this file, so it never reaches GitHub.
2. Run:

   ```
   node build.js out/release
   ```

   This gives `out/release/assessment_tracker_V39.html` and `out/release/assessment_tracker_staff_entry_V39.html`.
3. Copy both into **SLT dashboards** in SharePoint, as usual. The `out/` folder is never committed either.

Without `flow-url.txt`, the files still work. Each computer then pastes the link once, under **Set up → Settings & data**.

The Staff entry file differs from the SLT file in exactly four lines: the title, the app name, `COPY_ID` and `ENTRY_FILE`. The build stops if anything else differs.

## What's where

| Path | What |
|---|---|
| `src/parts/` | The source. Code is in `d_app.js`; markup and styles are in `b_body.html` and `a_head_css.html`. |
| `src/parts-41.26/` | The V41.26 original, for comparison, and to seed "saved by V41" data in the tests. |
| `patches/` | The scripts that turned V41.26 into V42.2, in order. `src/parts/` is the final source. |
| `harness/` | The tests: a fake SharePoint and flow, the made-up school, and the suites. |
| `docs/` | Changelog, the in-school check (TESTING), decisions, the audit report and the overnight audit log. |

## Tests

The tests need a build with a made-up flow link. Don't give these files to anyone.

```
node build.js out/current --fake-flow
node build.js out/baseline-41.26 src/parts-41.26 --fake-flow
cd harness
npm install jsdom@24 fake-indexeddb@6 playwright-core axe-core
./run_all.sh                                    # saving, scope, calculations, data checks, GCSE, fault runs
node compat.js                                  # data saved by V41.26 loads identically
node browser.js ../out/current ../out/browser   # needs Chrome at /usr/bin/google-chrome
```

Options:
- `LABELLED=1` makes the fake flow answer out of order, as it does with concurrency on.
- `STOPERR=1` makes the fake flow stop at its first error.
- `TRACKER_DIR` tests another build.

## Rules the code keeps

- No new, renamed or removed SharePoint lists or columns.
- The flow contract stays as it is: `{key, calls:[{i,method,uri,body}]}` in, an array of answers out.
- Everything saved by V41.x loads and shows identically.
- Staff entry never writes outside the teacher's own pupils and subjects.
- No new external libraries or network calls.
- Tests use made-up names only.
