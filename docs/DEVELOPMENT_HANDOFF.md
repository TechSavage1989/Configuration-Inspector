# Configuration Inspector development handoff

## 5.17.0 comparison workspace

Started from main `07bb9fb6b58f81d34977859d1b74750e24d34a2a` (5.16.0).
The user authorized the expanded comparison build and publication on 2026-10-27.

- Comparison views retain the existing scrollable `#content` layout instead of
  the clipping fixed-table class. Field tables retain their own bounded scroller.
- `webview/comparison.js` is the bounded line-diff engine: unique anchors, bounded
  Myers gaps, explicit approximate positional fallback, line numbers and hunks.
  It preserves all accepted input and reports rejection/normalization notices.
- `webview/comparison_ui.js` owns independent local text inputs, 500-row rendering,
  synchronized panes, difference navigation, file/paste dialogs and validated
  input-only updater snapshots. Never persist the calculated diff or raw input
  in browser storage. Accepted direct text is included only in the existing
  encrypted desktop update handoff.
- `SWCore.compareRecords` preserves default behavior; opt-in unchanged/value rows
  support paired object properties and filters without guessing duplicate names.
- `webview/embed_features.py` embeds both new modules into the single-file HTML.
  Preserve that embedding and native resource paths when editing source.
- Existing matching, redaction, parser/source exports, root allowlist, public-data
  audit, updater checks, old tags and release assets must remain intact.

Validation is against synthetic/public examples only. Local Chromium could not
start because executor IPC sockets were blocked; its escalation failed during
sandbox setup. Browser and Windows validation must therefore come from the exact
review-branch commit's hosted workflow before promotion. No interactive native
WebView2 validation is implied by the Windows fixture/build checks.

Run `npm test`, `npm run test:browser`, version/embedding consistency, public-source
and repository-layout guards, both Linux C++ checks and the existing Windows
build/updater suite. Browser diagnostics include synthetic success screenshots.
Promote only after all jobs pass and latest main is checked for concurrent work.
The publish job is restricted to a push to main; do not replace prior versions.
