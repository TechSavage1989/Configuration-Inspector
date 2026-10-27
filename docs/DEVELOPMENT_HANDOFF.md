# Configuration Inspector development handoff

## 5.17.3 published and verified

Release: https://github.com/TechSavage1989/Configuration-Inspector/releases/tag/v5.17.3
Release ID: `425059009`; published 2026-10-27.
Published source/tag: `3c93d17339003563fca4fe75a3551077d66b9990`.
Source tree: `cdd6b45df363848b6d0e8a60414ebe0abbed9f76`.
Final review run `40453919484` and main release run `40454176002` passed all jobs.
The user's final six-part prompt and explicit push/main/publication approval were
reconciled before preparing this release from baseline `08d2cdb`.

Validation: 5,336 Node checks, 753 comparison browser checks, 40 updater browser
checks, 43 native Updater scheduling checks, 28 Windows replacement/rollback checks,
91 C++ protocol/menu-gate checks, native catalog policy, 3 repository-layout guards,
version/embed consistency and public-source audit (170 files, 168 text, 66 reviewed
fixtures). The native scheduling suite executes the real Updater with isolated
clock/feed/preferences; it is not an interactive WebView2 menu or network test.

The initial review `40453507370` passed updater/Windows checks but found one small
original-field edge case: an empty-state illustration overflowed a short panel and
incorrectly left the map active despite having no field rows. The focused fix gives
empty maps zero navigation range and hides the viewport indicator, while leaving
the actual results message scrollable. The regression was retained, not weakened;
final review and main runs passed all six comparison scenarios. Final screenshots
for object, original-field and text maps plus aligned input controls were inspected.

All four public downloads match GitHub asset sizes/digests; EXE/HTML/icon also
match SHA256SUMS. The executable's top-level PE version is 5.17.3.0, AMD64 Windows
GUI. HTML/icon match the tested source after newline normalization. The latest
feed passes the production C++ release parser and the tag points to tested source.
5.17.2 assets remain unchanged. No force push or repository access change occurred.

- EXE SHA-256: `7a978a856dbc7c41abeba0f611ed15e04824d895d4f4dea7f36941636e5f6c8c`
- HTML SHA-256: `5bc1557eda2580af3ffe98d9a2e967d2eca0e4db567942f9fd9545dd02b61bd3`
- Icon SHA-256: `0b7616221b64418c3f48f5a405f56dc54248aab0e5c44ba69a7dae76e874f1d5`
- SHA256SUMS SHA-256: `bbb0ba54b3de95235961956d8140075227b688ed700a665640d03a5268ea9129`

Unrun: full interactive native WebView2 and updating a real installed application.
This final documentation-only record does not rebuild the published application.

### Implementation and continuation

- Confirmed Help bug: native command 11 searched for a nonexistent update-settings
  DOM button. It now sends a typed native message, with a gate retaining/coalescing
  requests until the UI handshake. The UI opens/focuses the update section and
  checks, including repeated, busy and error cases. Keep the exact-message tests.
- The user's exact missed-automatic-notice cause was not observed on their desktop.
  Prior six-hour polling/global Later delay could explain it, but do not claim a
  proven machine-specific cause. The public feed was healthy throughout.
- Automatic checks run about 15 seconds after UI readiness and every five minutes
  while open. Disabled preferences remain disabled. Later applies to the displayed
  release for 24 hours; newer releases and expired reminders are not hidden by it.
  Legacy unscoped delays cannot identify a version and do not hide newer releases.
  Preserve download/install consent, integrity checks, encryption and rollback.
- `UpdateServices` injects only clock, release-feed and preference boundaries for
  the real native scheduler tests, without developer registry or network effects.
  `tests/updater-scheduler-tests.cpp` is required by `scripts/build-windows.cmd`.
- All original fields uses a measured current-filtered-page row map. All three
  maps accept track/marker/viewport press-and-drag with capture, cleanup and click
  suppression. Text track/marker movement anchors to the actual post-jump row;
  keep the 1px continuity and cross-page/tiny-tail regressions.
- Text masking remains parent-owned in its results toolbar, not above inputs.
  Loader placement and the center swap design are shared across all three modes.
- Native details/summary object sections retain collapsed category state across
  filters/modes, including cleanup before a queued toggle. Open cards use actual
  geometry; collapsed sections use clearly labeled per-kind counts at their real
  heading, including neutral unchanged items under matching filters. Selecting a
  bookmark or aggregate expands and remeasures before navigating to its target.
  Aggregates stay actionable when collapsed content fits beneath a full-height
  viewport. Never invent hidden-card scroll positions or unreachable page entries.
- Only `.technical-details .comparison-scroll` is capped at 300px. Do not broaden
  that rule to category details wrappers and create extra property-table scroll
  traps. Preserve the fixed-height workspace and established wheel-boundary handoff.
- Empty maps have no comparison range even if a placeholder message overflows.
  Preserve the actual message's natural scrolling and the atomic geometry snapshot
  guard introduced in 5.17.2. Clean up map listeners/capture/observers on rerender.

Local Chromium remains unavailable under the established sandbox restriction;
do not retry the restricted route. Hosted browser/Windows checks provide the
runtime coverage recorded above. Preserve root organization, embedding paths,
parsers, original sources, masking and updater safeguards; no private inputs or
reference screenshots are committed.

## 5.17.2 published and verified

Release: https://github.com/TechSavage1989/Configuration-Inspector/releases/tag/v5.17.2
Release ID: `425031919`; published 2026-10-27.
Published source/tag: `a9935f3db4edce68da394905cce7bbcbc340d044`.
Source tree: `987f00fb372403e3cef70819fa778952a73f58bd`.
Final review run `40449086357` and main release run `40449260946` passed all jobs.

Validation: 5,233 Node checks, 463 comparison browser checks, 26 updater browser
checks, 28 Windows updater fixture checks, 83 protocol checks, native catalog
policy, public-source/version/embed audits and 3 repository-layout guards.
Browser cases cover normal/small windows, measured variable-height object maps,
active bookmarks, both map drags outside bounds and across text pages, pointer
release/cancel, subsequent navigation, source/filter/swap/resize and empty states.
The final synthetic object-map/sidebar and compact text screenshots were inspected.

The initial review passed, but the first main run caught an intermittent object
map refresh race after details expansion and correctly withheld publication.
A focused regression reproduced scroll delivery before geometry remeasurement;
the fix publishes the new extent only after marker geometry is consistent.
Final review and main runs passed without weakening the geometry assertion.

All four public downloads match GitHub asset digests; EXE/HTML/icon also match
SHA256SUMS. The executable reports top-level PE version 5.17.2.0, AMD64 Windows
GUI. HTML/icon match the reviewed source after Windows newline normalization.
The latest-release feed and tag resolve to the tested source. 5.17.1 assets remain
unchanged. No force push or repository access change was used.

- EXE SHA-256: `b82a329ee6a63601143120ea0a1a393a84e00de354e40aa7d84c6ab988f34bf4`
- HTML SHA-256: `4486a864100d40780001a51d835c9d69f61108b8faa9b34d0a3b65994d8baf2a`
- Icon SHA-256: `0b7616221b64418c3f48f5a405f56dc54248aab0e5c44ba69a7dae76e874f1d5`
- SHA256SUMS SHA-256: `c4565110866b52834db94feaa68eef5896651ea42a17201c81c3d5924dfe1c55`

Full interactive native WebView2 and updating a real installed application were
not performed. This final handoff-only record does not rebuild the release.

### Implementation and continuation

Based on verified main `3a1b53f8916ea829c436178a9fb5354173caa0c3`.
The user supplied the navigation brief and explicitly approved implementation and
publication on 2026-10-27. No private input/screenshot content is committed.

- The centered double-arrow Swap sides action lives in expanded input cards and
  collapsed identity summaries; CSS exposes only one at a time. Keep its keyboard
  label and hover/focus tooltip, and preserve partial/empty-side behavior.
- `webview/comparison_navigation.js` measures only currently rendered object cards
  and groups. Its section bookmarks and map are explicitly current-page scope.
  Variable geometry is refreshed after details expansion, resize and replacement;
  clean up its observers and handlers before replacing comparison DOM.
- Text-map dragging preserves the map/pointer owner across aligned-row page
  changes. Retain capture, cancellation, click suppression, synchronized panes,
  bounded rendering and ordinary map/keyboard/difference navigation.
- The navigation UI sits beside results, preserving the fixed-height workspace,
  input collapse height gain, object groups and fractional-boundary wheel handoff.
- Preserve parsers, original source, secret masking, settings, updater snapshots,
  release gates, root allowlist and single-file feature embedding paths.

Keep map measurements atomic: scroll may arrive before toggle/ResizeObserver.
Do not expose a new total extent with stale marker positions; retain the settled
snapshot and schedule measurement first. Keep the focused timing regression.
Local Chromium remains unavailable under the established sandbox restriction;
hosted browser/Windows checks above provide runtime coverage. Do not retry the
restricted local route. Preserve source organization and release safeguards.

## Previous 5.17.1 publication (verified)

Release: https://github.com/TechSavage1989/Configuration-Inspector/releases/tag/v5.17.1
Release ID: `425015916`; published 2026-10-27.
Published source/tag: `5a14d5aeb7d45f091c4fd642b2ccb48259e39627`.
Source tree: `fb34d6caeb8056713d1f7d9f538a00736eefb1e1`.
Review run `40445812462` and main release run `40446279218` passed all jobs.

Coverage: 5,097 Node checks, 242 comparison browser checks, 26 updater browser
checks, 28 Windows updater checks (real fixture-process replacement and rollback),
83 native protocol checks, native catalog policy, public-source, version/embed and
3 repository-layout guards. Browser checks cover 1440x960, 1000x650 and 800x600.
The first two review runs isolated a Chromium fractional nested-scroll boundary;
settled-gesture diagnostics reproduced it, and the scoped boundary handoff fixed
it without weakening assertions. A stale-context replacement edge case also has
regression coverage. No unrelated application regression required a scope change.

Downloaded public EXE/HTML/icon/SHA256SUMS match GitHub asset digests. All payloads
match SHA256SUMS. The EXE top-level PE resource is 5.17.1.0, AMD64 Windows GUI;
HTML/icon match the reviewed source after Windows newline normalization. The
latest-release feed and tag resolve to the tested source. 5.17.0 release/assets
remain unchanged. Repository access was not changed; no force push was used.

- EXE SHA-256: `2b0700b77d4962d743b7c2f8b56b3431c2a4f95a73df4f0025560664dff7b53c`
- HTML SHA-256: `849dc17527254d9ff7cc35eab41052925313cb16a2f96f14baafbbbc9ec82a0f`
- Icon SHA-256: `0b7616221b64418c3f48f5a405f56dc54248aab0e5c44ba69a7dae76e874f1d5`
- SHA256SUMS SHA-256: `55b64a4699fc591f97714bc0e6f8fb9adea277083bb3beb2fb3164b4c566ef76`

Final object and compact text/minimap screenshots were downloaded from hosted
browser diagnostics and visually inspected. Full interactive native WebView2 and
an update of a real installed app were not performed. This final handoff-only
commit does not change/rebuild the published runtime.

### Implementation and continuation

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
- `mountObjectComparisonScroll` forwards vertical wheel input only at a nested
  table boundary (2px tolerance); interior, horizontal and zoom gestures remain
  native. Keep the real-browser boundary regression and its geometry diagnostics.
- Replacing/swapping current input preserves valid filters, but clears a context
  that is absent from the new model so the visible selector and filter agree.
- Browser coverage includes normal/small windows, card/gap wheel targets, genuine
  nested scroll boundary chaining, input lifecycle, collapsed identity/height,
  mode/filter retention and map position/navigation/resize. Diagnostics contain
  synthetic screenshots and machine-readable geometry only.

Local browser execution remains unavailable due to the established sandbox
limitation; hosted browser/Windows results above provide runtime coverage.
Keep all root organization guards, build/embed paths, parsers, updater safeguards
and source retention intact. The final 5.17.1 promotion received explicit user
approval to advance main and publish after review checks passed.

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
