# Configuration Inspector development handoff

## 5.17.1 review candidate

Based on verified main `6a742c2829c2cf499c7b50ed52bb990742169208` after 5.17.0.
The user explicitly authorized continuing the attached six-part comparison brief,
adding the text change map, and pushing/publishing the final build on 2026-10-27.
The two supplied loader screenshots were inspected locally; no private screenshot
or configuration content was copied into the public repository.

- `#content.comparison-view` is a bounded flex workspace. Only object results,
  original-field results, text panes or empty-state content scroll vertically.
  Comparison-only chrome is compact; other workspace layouts are unchanged.
- Shared input cards/summary styles serve text and object modes. Collapse removes
  the input area from layout, preserves state and returns height to results.
  Clearing the comparison's current slot does not delete the open configuration.
- Object grouping uses supported record categories and DNS/DHCP sections, sorted
  before pagination. Never invent empty categories or guess object identity.
- Text minimap renders at most 160 bins × 3 change kinds, not a DOM node per line.
  Scroll/resize updates its viewport; click/keyboard jumps cross 500-row pages.
  Disconnect ResizeObserver via `SWTextComparison.unmount` before replacing DOM.
- Browser coverage includes normal/small windows, card/gap wheel targets, genuine
  nested scroll boundary chaining, input lifecycle, collapsed identity/height,
  mode/filter retention and map position/navigation/resize. Diagnostics contain
  synthetic screenshots and machine-readable geometry only.

Local validation passed: 5,079 Node checks, 3 repository-layout checks, public-source
and version/embedding guards, 83 protocol checks and native catalog policy.
Browser/Windows validation and publication are pending hosted review-branch CI.
Local browser execution
remains unavailable due to the established sandbox limitation; do not retry that
restricted route. Full interactive native WebView2 and a real installed upgrade
are not claimed. Keep all root organization guards and build/embed paths intact.

## Previous 5.17.0 publication (verified)

Version **5.17.0** is published at
https://github.com/TechSavage1989/Configuration-Inspector/releases/tag/v5.17.0
Release ID: `424983026`.
Published source/tag: `ea5a9eef62e0a2411278540bd1ec47574f0316d1`.
Source tree: `b2d07c67d5afa6831dc5d05187d469071f0c0bb9`.

Review-branch run `40440132990` and main release run `40440328882` passed.
Coverage includes 5,015 Node checks, 3 repository-layout checks, public-source and
version/embedding guards, 83 protocol checks, native catalog policy, 83 comparison
browser checks, 26 updater browser checks and 28 Windows updater checks including
real fixture-process replacement and failed-startup rollback. The initial browser
run stopped on an ambiguous test Close-button selector; only that selector changed
before the successful complete rerun. No application regression was found there.

Public EXE, HTML, icon and SHA256SUMS downloads were verified against GitHub's
asset digests; the three payloads also match SHA256SUMS. HTML/icon bytes match the
reviewed source with Windows CRLF line endings. The executable's top-level PE
resource reports Config Inspector 5.17.0.0, AMD64, Windows GUI. The latest-release
feed and tag resolve to the tested source. Existing 5.16.0 release/assets remain
unchanged. Repository access was not changed.

- EXE SHA-256: `7a73e4e2249222250d5d1dce7b075d8e82599ca884b1197cceef9caa62b462a3`
- HTML SHA-256: `da7afd5cd06f83ea349a0f7333b0ff23c964249e315066494cd43afd144f7ca7`
- Icon SHA-256: `0b7616221b64418c3f48f5a405f56dc54248aab0e5c44ba69a7dae76e874f1d5`
- SHA256SUMS SHA-256: `d92f36bdfd7128211db6a6ce1ce9323138aaf596d12f58bd41a0a3152476c152`

Browser tests exercised 1440x960, 1000x650 and 800x600 layouts with synthetic data.
Success screenshots are retained in the browser-diagnostics artifact; manual
artifact viewing was unavailable because the cloud browser was signed out of
GitHub. Full interactive native WebView2 operation and a real installed 5.16.0
application update were not performed; do not substitute fixture tests for those
claims. This final documentation record does not change the released runtime.

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
sandbox setup. Browser and Windows validation came from the exact
review-branch commit's hosted workflow before promotion. No interactive native
WebView2 validation is implied by the Windows fixture/build checks.

Run `npm test`, `npm run test:browser`, version/embedding consistency, public-source
and repository-layout guards, both Linux C++ checks and the existing Windows
build/updater suite. Browser diagnostics include synthetic success screenshots.
For future releases, promote only after all jobs pass and latest main is checked
for concurrent work.
The publish job is restricted to a push to main; do not replace prior versions.
