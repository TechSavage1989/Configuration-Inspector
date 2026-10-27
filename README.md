<p align="center">
  <img src="webview/icon.svg" width="112" alt="Configuration Inspector icon">
</p>

<h1 align="center">Configuration Inspector</h1>
<p align="center">Explore saved network configurations, follow object relationships and compare snapshots locally.</p>

<p align="center">
  <a href="https://github.com/TechSavage1989/Configuration-Inspector/releases/latest">Download</a> ·
  <a href="#getting-started">Get started</a> ·
  <a href="#features">Features</a> ·
  <a href="#updates-and-settings">Updates</a> ·
  <a href="#development">Development</a>
</p>

## Features

- **Find useful settings:** browse recognized configuration sections and follow related objects without losing access to original source.
- **Understand interfaces and topology:** inspect physical layouts, VLANs, interface groups and device information where the export provides enough detail.
- **Compare snapshots:** inspect matched objects and their properties side by side, or compare configuration text/files with aligned lines and synchronized scrolling.
- **Review findings and export:** inspect configuration review results and create reports for further analysis.

Imported configurations are analyzed **locally**. Optional device-specification downloads request public hardware definitions without sending configuration contents.

## Download

Get **`Config_Inspector.exe`** for Windows x64 from [the latest release](https://github.com/TechSavage1989/Configuration-Inspector/releases/latest). The release also includes **`Config_Inspector.html`** for browser-based use.

## Requirements

| Requirement | Details |
| --- | --- |
| Desktop | Windows x64 with Microsoft Edge WebView2 Evergreen Runtime |
| Installation | One portable executable; use a writable local application folder for updates |
| Inputs | Saved configurations in supported formats; recognition varies by vendor, syntax and export |
| Online access | Required for update checks and optional public hardware definitions, not local configuration analysis |

> **Treat exports as evidence, not live telemetry.** Unsupported syntax remains available in original source and is not interpreted as effective configuration. Missing hardware details or runtime state must not be assumed. Review findings against the device and its vendor documentation before making changes.

For feature coverage and limitations, see [network features](webview/NETWORK_FEATURES.txt), [security features](webview/SECURITY_FEATURES.txt), [hardware layouts](webview/HARDWARE_LAYOUTS.txt) and [device specifications](webview/DEVICE_SPECIFICATIONS.txt).

## Getting started

1. Open [the latest release](https://github.com/TechSavage1989/Configuration-Inspector/releases/latest) and download **`Config_Inspector.exe`** for Windows x64.
2. Put it in a writable local folder and launch it. **Microsoft Edge WebView2 Evergreen Runtime** must already be installed; no companion application files are needed.
3. Open or drag in a saved network configuration. Use the sidebar to explore the recognized sections, interfaces and linked objects.
4. Inspect the original source when a field needs context. Load another configuration when you want to compare snapshots, then export the results you need to keep.

Prefer a browser-based edition? The same release includes **`Config_Inspector.html`**. It uses browser-managed storage and links to downloads; executable installation and restart are desktop-only capabilities.

## How to use

Use the sidebar to move between recognized configuration views, follow object links for context, and compare snapshots before exporting your findings. Consult original source for unsupported or ambiguous settings; this app does not apply changes to devices.

## Compare configurations

Open **Compare configs** in the sidebar and select one of the two primary modes:

- **Config objects:** choose the left/current and right/comparison configurations
  using files or pasted settings. Review paired objects and original fields;
  filter by added, removed, changed or unchanged state, category and search.
  Matching uses supported vendor, context, type and name. Renames remain
  additions/removals and ambiguous duplicate identities are not guessed.
- **Config text / files:** compare loaded configuration source or independent
  UTF-8 files/pasted text. Aligned line numbers, change highlights, synchronized
  scrolling and Previous/Next difference (also F7 / Shift+F7) help review changes.
  Large comparisons render 500 aligned rows per page; navigation crosses pages.
  Bounded alignment may use a clearly labeled approximate fallback.

Both modes are **read-only**. The double-arrow **Swap sides** button between the
inputs swaps their contents and names; the same control remains between the
compact identity summaries when inputs are hidden. It is keyboard accessible and
works with a single loaded side.
Both modes keep their controls visible while results scroll within the window.
Use **Hide inputs** to reclaim review space without losing either configuration;
the compact summary keeps Current/Comparison identities and filenames visible.
Both sides always support replace, paste and clear. **Use imported** selects any
compatible configuration already open in the workspace, without reopening or
reparsing its file. It is available on both sides in all three views, including
the compact summary when inputs are hidden. Loaded-source masking is preserved;
the picker displays only filenames and configuration identity metadata.
Object results are grouped by
actual categories; expanded original-setting tables scroll independently and
continue into the result list at their boundary.

The text mode's vertical **change map** shows added, removed and changed lines
across the entire aligned comparison, with an outline for the visible area. Click
the map to jump both panes, or focus it and use arrows, Page Up/Down and Home/End.
Press and drag anywhere on the map—track, marker or viewport outline—to scroll
both panes, including across 500-row pages; release or cancel the pointer to stop.
Click/keyboard navigation and ordinary synchronized scrolling remain available.

Config Objects has a **Sections** sidebar and a geometry-based change map. Click a
section to jump within the results; the active section follows scrolling. The
object map reflects real card heights and expanded details, with colors for added,
removed, changed and unchanged objects. Click markers, press and drag anywhere on
the map, or use keyboard navigation. Object sections can be collapsed from their
headings; that choice is retained while switching modes or filters. Collapsed sections show
labeled, per-state counts at the actual heading rather than pretending hidden
cards occupy scroll space. A section bookmark or collapsed map marker expands
the section before navigating. Unchanged objects use neutral markers when the
active filters include them. Both bookmarks and maps describe **this results page
only** and refresh with filters, pagination, resizing or input changes.

The **All original fields** mode also has a change map based on the actual visible
field rows and their added/removed/changed state. Its map is limited to the current
filtered results page and supports click, press-and-drag anywhere and keyboard
navigation. All three modes share the same loader position and centered Swap sides
button. The text mode’s loaded-source secrets control stays in the results toolbar;
it does not shift the loaders or change direct-text acknowledgment rules.

Direct text inputs are limited to 5 MB each and require acknowledgment before
displaying unmasked contents.
Loaded sources follow the sensitive-value setting; masking can hide secret-only
text differences, while object comparison still reports the change. CRLF/LF line
endings compare equivalently; a missing final newline remains visible. These are
comparison tools, not an editor, merge tool or full Notepad++ plugin replacement.

## Updates and settings

### Storage and privacy

Open **App settings** from the sidebar or native File menu to choose the desktop data folder and manage stored app data. The default desktop location is **`%LOCALAPPDATA%\ConfigInspectorWebView`**, outside the executable folder; changing the location takes effect on the next launch.

- Imported configuration files remain in their original locations.
- Device-specification downloads can be disabled in **Device information**; cached definitions remain available offline.
- **Delete stored data** also removes update caches, backups and update preferences. It does not delete configuration files or exports. Read the [storage guide](webview/APP_STORAGE.txt) before clearing data you may need for recovery.
- Never commit private configuration exports or credentials to this repository.

### Updating the app

Open **App settings → App updates**. Choose **Download update**, then **Review install and restart** and confirm installation after saving your work.

Automatic checks run after startup and every five minutes while the app is open. They can be disabled; **Later** hides that release’s notice for 24 hours without hiding a newer release. **Help → Check for updates** opens the update controls and checks immediately. Nothing downloads or restarts automatically.

Updates come from this repository's stable GitHub Releases. The downloaded executable must match the release's SHA-256 digest, size, product identity, architecture and version. These builds are **not Authenticode signed**: hashes detect corruption and mismatched files, not a compromised publisher.

During an update, loaded configurations and the comparison are encrypted using Windows DPAPI for the current account and restored after restart. The temporary workspace handoff is removed after successful restoration; interrupted transactions may retain the encrypted file. A previous executable is kept for recovery.

Close additional copies of the same executable before installing and keep the application folder writable. A failed download leaves the current executable unchanged. Update checks do not send configuration contents or require GitHub credentials.

See [UPDATING.md](docs/UPDATING.md) for installation, rollback, storage and trust details.

## Development

<details>
<summary>Build, checks and release safeguards</summary>

Source, vendor importers, public example fixtures, tests and the editable [application icon](webview/icon.svg) are included. Use **Node.js 20 or later** and **Python 3**.

Run parser, model and presentation regressions:

```sh
npm ci
npm test
```

Run browser update-interface checks:

```sh
npx playwright install chromium
npm run test:browser
```

On Windows, install Visual Studio Build Tools with the **C++ desktop workload and Windows SDK**, then run:

```bat
scripts\build-windows.cmd
```

This produces `dist/Config_Inspector.exe` and runs Windows update replacement/rollback tests. Linux cross-compilation uses [webview/build.sh](webview/build.sh) with MinGW-w64. The standalone C++ protocol suite builds from `tests/update-protocol-tests.cpp` with C++17.

For an authorized application release:

1. Change `VERSION`, then run `python scripts/version.py` and `python webview/embed_features.py`.
2. Add release notes in `docs/releases/VERSION.md` using the actual version number and commit the changes to `main`.
3. The [build workflow](.github/workflows/build-release.yml) runs regression, browser and Windows installation tests, then publishes only after checks pass.

Keep the public download name `Config_Inspector.exe`. Installation preserves the user's chosen filename and folder. Existing published versions are not overwritten; documentation-only updates must not bump `VERSION`. GitHub source archives provide versioned source downloads. No separate publishing credential or update service is needed.

Third-party WebView2 and public device-catalog notices are included in [webview](webview/). Native updater fixtures do not replace interactive WebView2 testing on Windows.

</details>
