<p align="center">
  <img src="webview/icon.svg" width="112" alt="Configuration Inspector icon">
</p>

<h1 align="center">Configuration Inspector</h1>
<p align="center">Explore saved network configurations, follow object relationships and compare snapshots locally.</p>

<p align="center">
  <a href="https://github.com/TechSavage1989/Configuration-Inspector/releases/latest">Download</a> ·
  <a href="#getting-started">Get started</a> ·
  <a href="#features">Features</a> ·
  <a href="#screenshots">Screenshots</a> ·
  <a href="#updates-and-settings">Updates</a> ·
  <a href="#development">Development</a>
</p>

<p align="center">
  <img src="docs/images/hero.png" alt="Configuration Inspector main window" width="900">
</p>

## Features

- **Find useful settings:** browse recognized configuration sections and follow related objects without losing access to original source.
- **Understand interfaces and topology:** inspect physical layouts, VLANs, interface groups and device information where the export provides enough detail.
- **See a whole site:** open several configurations and compare their NTP, DNS, syslog, SNMP, local users and spanning-tree settings, VLAN names, shared subnets and duplicate IP addresses on one page.
- **Add live network data:** open Auvik site or device reports (.xlsx or .csv) and show command output (routes, interface status, LLDP / CDP neighbors, MAC and ARP tables). The app draws a **site map** of firewalls and switches with the ports that connect them, and adds link state, neighbors and the devices seen on each port to the matching configuration.
- **Compare snapshots:** inspect matched objects and their properties side by side, or compare configuration text/files with aligned lines and synchronized scrolling. Copy a plain-language **change summary** for a ticket or change record.
- **Review findings and export:** inspect configuration review results, including unused objects, undefined or unused VLANs, access ports in VLAN 1 and trunks that carry every VLAN, and create reports for further analysis. A printable **client report** summarizes every open configuration: devices, port usage, VLANs, IP addresses and findings.

Imported configurations are analyzed **locally**. Optional device-specification downloads request public hardware definitions without sending configuration contents.

## Screenshots

### Find useful settings

<table>
  <tr><td width="50%"><b>Configuration sections with related records</b><br><img src="docs/images/configuration-sections.png" alt="Configuration sections with related records" width="440"></td><td width="50%"><b>Object details with source and copy actions</b><br><img src="docs/images/object-details.png" alt="Object details with source and copy actions" width="440"></td></tr>
</table>

### Interfaces and topology

<table>
  <tr><td width="50%"><b>Interfaces at a glance with stack member port layouts</b><br><img src="docs/images/interfaces-at-a-glance.png" alt="Interfaces at a glance with stack member port layouts" width="440"></td><td width="50%"><b>Interface table with VLAN membership</b><br><img src="docs/images/interface-table.png" alt="Interface table with VLAN membership" width="440"></td></tr>
  <tr><td width="50%"><b>Compact network map</b><br><img src="docs/images/network-map.png" alt="Compact network map" width="440"></td><td width="50%"></td></tr>
</table>

### Global configuration search

**Search results across fields, objects and source**

<img src="docs/images/global-search.png" alt="Search results across fields, objects and source" width="900">

### Site map and live data

<table>
  <tr><td width="50%"><b>Site map built from an Auvik site export</b><br><img src="docs/images/site-map.png" alt="Site map with a firewall, core switch and access switches" width="440"></td><td width="50%"><b>Live link state and neighbors on the interface table</b><br><img src="docs/images/live-interfaces.png" alt="Interface table with live link state and connected devices" width="440"></td></tr>
</table>

### Site overview

**Common settings, VLANs and addressing across every open configuration**

<img src="docs/images/site-overview.png" alt="Site overview comparing settings across three switches" width="900">

### Compare snapshots

<table>
  <tr><td width="50%"><b>Side-by-side configuration object comparison</b><br><img src="docs/images/compare-configurations.png" alt="Side-by-side configuration object comparison" width="440"></td><td width="50%"><b>Aligned text comparison with change map</b><br><img src="docs/images/compare-text.png" alt="Aligned text comparison with change map" width="440"></td></tr>
  <tr><td width="50%"><b>Plain-language change summary</b><br><img src="docs/images/change-summary.png" alt="Plain-language change summary" width="440"></td><td width="50%"></td></tr>
</table>

### Review findings and export

<table>
  <tr><td width="50%"><b>Configuration review findings</b><br><img src="docs/images/config-review.png" alt="Configuration review findings" width="440"></td><td width="50%"><b>Convert and export with redaction</b><br><img src="docs/images/convert-and-export.png" alt="Convert and export with redaction" width="440"></td></tr>
  <tr><td width="50%"><b>Printable client report</b><br><img src="docs/images/client-report.png" alt="Printable client report" width="440"></td><td width="50%"></td></tr>
</table>

## Download

Get **`Config_Inspector_Portable.zip`** for Windows x64 from [the latest release](https://github.com/TechSavage1989/Configuration-Inspector/releases/latest). Extract it and run **`Config_Inspector.exe`**. The ZIP includes launch instructions and third-party notices; Microsoft Edge WebView2 Evergreen Runtime must already be installed. The raw **`Config_Inspector.exe`** and browser-based **`Config_Inspector.html`** downloads remain available.

Use **`Config_Inspector_Portable.zip.sha256`** to check the archive hash. Future releases also list it in **`SHA256SUMS`**. The ZIP added to 5.18.0 contains that release’s exact existing executable; its original downloads and checksum file are unchanged.

## Requirements

| Requirement | Details |
| --- | --- |
| Desktop | Windows x64 with Microsoft Edge WebView2 Evergreen Runtime |
| Installation | One portable executable; use a writable local application folder for updates |
| Inputs | Saved configurations in supported formats; recognition varies by vendor, syntax and export |
| Online access | Required for update checks and optional public hardware definitions, not local configuration analysis |

> **Treat exports as evidence, not live telemetry.** Unsupported syntax remains available in original source and is not interpreted as effective configuration. Missing hardware details or runtime state must not be assumed. Review findings against the device and its vendor documentation before making changes.

Arista EOS and Huawei VRP configuration text is recognized under its own vendor name; Huawei VRP coverage is narrower than the Cisco-style CLI adapters. For feature coverage and limitations, see [network features](webview/NETWORK_FEATURES.txt), [security features](webview/SECURITY_FEATURES.txt), [hardware layouts](webview/HARDWARE_LAYOUTS.txt) and [device specifications](webview/DEVICE_SPECIFICATIONS.txt).

## Getting started

1. Open [the latest release](https://github.com/TechSavage1989/Configuration-Inspector/releases/latest) and download **`Config_Inspector_Portable.zip`** for Windows x64.
2. Extract all files into a writable local folder and launch **`Config_Inspector.exe`** from there (not inside the ZIP viewer). **Microsoft Edge WebView2 Evergreen Runtime** must already be installed; no companion application files are needed.
3. Open or drag in a saved network configuration. Use the sidebar to explore the recognized sections, interfaces and linked objects.
4. Inspect the original source when a field needs context. Load another configuration when you want to compare snapshots, then export the results you need to keep.

Prefer a browser-based edition? The same release includes **`Config_Inspector.html`**. It uses browser-managed storage and links to downloads; executable installation and restart are desktop-only capabilities.

## How to use

The **Overview** opens with a **Device summary**: hostname, vendor and OS, model or stack, firmware, serial number, management address, default gateway, DNS, NTP, syslog, time zone and domain, with port usage, VLAN, route or rule and finding counts. The top review findings, interfaces at a glance and policy summary follow. Original export fields and file details sit in collapsed sections on **Device information**. On any section page, **View source** on the file line shows the original configuration lines for that section. Long port lists are shortened to ranges such as `Gi1/0/1-20`, and the full list appears on hover.

Interfaces at a glance shows all interfaces by default, including unused ports and logical interfaces. Use **Hide unused** within a group to condense it, and **Show unused** to restore the full view. Loading a configuration starts with all interfaces visible.

Reopen a recent configuration from **Recent files** on the start screen (desktop app, Microsoft Edge and Google Chrome). In **Convert & export**, **Client report** creates one printable HTML document for every open configuration; open it and choose **Print or save as PDF**. The sidebar groups pages into **Workspace** (overview, device information, review, site overview and comparison), the configuration areas found in the export, and **Source & export**. Click a section heading to collapse it; the choice is remembered, and the section holding the current page always stays open. Hover over an item for a short description.

In the **Network map**, click a group heading to collapse or expand it, or use **Collapse all** and **Expand all**, in both the detailed and compact maps.

Use the sidebar to move between recognized configuration views, follow object links for context, and compare snapshots before exporting your findings. Consult original source for unsupported or ambiguous settings; this app does not apply changes to devices.

## Global configuration search

Use the top search box, **/** or **Ctrl/Cmd+K** to search the active configuration
across original fields, parsed objects, native sections, displayed source text
and configuration-derived findings. Results identify their source and context;
**Open object**, **Original field**, **Raw text** and other destination buttons
reveal the corresponding location. **Back to search results** restores the query,
options, selected result and scroll position. **Return to previous view** restores
the previous workspace, including comparison inputs and filters.

Expand **Search options** for All/Any terms, Match case, Whole word and section,
source or context filters. Examples: `uplink "branch office"`, `dns -disabled`,
and `"10.0.0.1" -"backup route"`. Exclusions always reject a matching location;
All/Any combines positive terms within one field, object, finding or source line,
not unrelated locations. Whole word uses Unicode letter/number/underscore
boundaries; punctuation is literal. Regex is intentionally not enabled.

Every non-overlapping occurrence is retained, including repeated matches in one
location. Use the result's Previous/Next controls to inspect each occurrence;
40 matching locations render per page, with no silent result cap. Counts include
**separately labeled representations**, not deduplicated underlying source
statements: an object, original field and source line may represent the same
setting. Source line numbers refer to the safe displayed configuration text;
normalization or missing snapshot source is explained in coverage notes. Raw
source covers all contexts and is labeled accordingly, rather than assigned to
a context without proven source mapping. Unknown
content is searchable where it is retained by the importer and permitted by the
existing masking rules. The app does not infer omitted device state.

Search is local and read-only. Hidden sensitive values are redacted before
indexing, matching and counting; revealing them still requires the existing
visibility control. Indexes/results are invalidated on replacement or masking
changes. Large searches yield to the UI and superseded work is canceled.

## Site overview

Open two or more configurations from the same site (**Add files**) and choose **Site overview** in the sidebar. It compares only what the exports contain:

- **Settings consistency:** NTP and DNS servers, DNS domain, syslog and SNMP destinations, SNMP location, local user accounts, time zone and spanning-tree mode. Values that differ from the most common one are highlighted; "Not in export" means the setting is absent from that file.
- **VLANs across devices:** where each VLAN exists, its name and port count on each device, and VLANs whose names differ.
- **Duplicate IP addresses** configured on more than one device, and **shared subnets** that interfaces on different devices belong to.
- **Descriptions naming another device**, such as `Uplink to CORE-SW1`. Running configurations do not include live CDP/LLDP neighbor tables, so the page does not claim physical links. Add neighbor data (below) to see the real links on the **Site map**.

## Supplementary data and the site map

Configurations say how a device is set up; monitoring exports and command output say what was actually connected and up. Open them with **Add files**, drag them in, or paste command output into **Paste**:

- **Auvik site export** (.xlsx): every device with its type, model, addresses, serial and software, every interface with its link state and neighbor, routes, end-of-support dates and known vulnerabilities.
- **Auvik device report** (.xlsx): one device's interfaces, neighbors, MAC table (FDB), ARP table, routes, networks and CPU / memory. Individual Auvik tables saved as **.csv** work too, as does any CSV with local port, neighbor and neighbor port columns.
- **Show command output** (.txt, .log or pasted): `show ip route` (IOS, IOS-XE, NX-OS, AOS-CX, FortiGate `get router info routing-table`, Linux `ip route`), `show interfaces status`, `show ip interface brief`, `show interfaces description`, `show interfaces`, `show lldp neighbors` (brief and detail, including Arista, AOS-CX and AOS-S formats), `show cdp neighbors` (brief and detail), `show mac address-table` and `show ip arp`. Several commands can be in one file; the hostname in the prompt (`SW1#`) tells the app which device they belong to.

Data is matched to an open configuration by hostname, or by an interface address. Output without a hostname applies to the configuration that is open; you can change the match under **Applies to** on the **Supplementary data** page.

- **Site map** (sidebar, once any file contains links): firewalls at the top, then switches by how far they are from the edge. Each line is labeled with the ports at both ends; ×2 marks parallel links. Access points and other endpoints are counted on the switch they connect to; tick **Show access points** to draw them. Click a device for its connections, double-click a device marked **Config** to open its configuration, and use **Find a device** or the zoom menu on large sites.
- **Live data on configuration pages:** the **Overview** device summary shows links up, neighbors and CPU / memory; ports at a glance get a green dot for links that are up and an outline for links that are down; the **Interfaces** table adds **Link**, **Connected to**, **Speed**, **Devices seen** and **Errors** columns; and the interface details show everything collected for that port, including MAC addresses with the IP addresses found in any imported ARP table.
- **Supplementary data** page: imported files and what was recognized in each, the matching configuration's neighbors, interface state, routing table and ARP table, and for site exports the devices past their last support date, known vulnerabilities and every network device.

Supplementary data describes the network when it was collected. It is never merged into a configuration or an export, is kept in memory only, and is cleared with **Clear workspace**. Older `.xls` workbooks are not supported; save them as .xlsx or CSV.

## Compare configurations

Open **Compare configs** in the sidebar and select a mode. **Migration validation** is for device replacements and vendor changes: put the original configuration on the left and the new one on the right, and it lists everything that is different, missing or only on the new device. The two everyday modes are:

- **Config objects:** choose the left/current and right/comparison configurations
  using files or pasted settings. Review paired objects and original fields;
  filter by added, removed, changed or unchanged state, category and search.
  Matching uses supported vendor, context, type and name. Renames remain
  additions/removals and ambiguous duplicate identities are not guessed. When
  exactly one removed and one added object of the same type and context have
  identical settings apart from the name, both cards show a **Possible rename**
  hint naming the other object; counts and filters are unchanged.
- **Config text / files:** compare loaded configuration source or independent
  UTF-8 files/pasted text. Aligned line numbers, change highlights, synchronized
  scrolling and Previous/Next difference (also F7 / Shift+F7) help review changes.
  Large comparisons render 500 aligned rows per page; navigation crosses pages.
  Bounded alignment may use a clearly labeled approximate fallback.

In **Config objects**, **Change summary** lists every change in plain language (for example `Untagged VLANs: 10 → 30` or `Tagged VLANs: removed 100`), grouped by category, with sensitive values always masked. Copy it or download it as text for a ticket or change record.

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
- **Recent files** on the start screen remember only each file's name, device name, vendor and location, never its contents. Reopening reads the file again from its folder. Remove entries, use **Clear list**, or delete stored data to forget them.
- Device-specification downloads can be disabled in **Device information**; cached definitions remain available offline.
- **Delete stored data** also removes update caches, backups and update preferences. It does not delete configuration files or exports. Read the [storage guide](webview/APP_STORAGE.txt) before clearing data you may need for recovery.
- Never commit private configuration exports or credentials to this repository.

### Updating the app

Open **App settings → App updates**. Choose **Download update**, then **Review and restart** and confirm installation after saving your work.

Automatic checks start as soon as the interface is ready and run every six hours while the app is open, pausing for the delay GitHub reports if it limits requests. They can be disabled; **Later** hides that release’s notice for 24 hours without hiding a newer release. **Help → Check for updates** opens the update controls and checks immediately. Nothing downloads or restarts automatically.

Updates come from this repository's stable GitHub Releases. The downloaded executable must match the release's SHA-256 digest, size, product identity, architecture and version. These builds are **not Authenticode signed**: hashes detect corruption and mismatched files, not a compromised publisher.

During an update, loaded configurations and the comparison are encrypted using Windows DPAPI for the current account and restored after restart. The temporary workspace handoff is removed after successful restoration; interrupted transactions may retain the encrypted file. A previous executable is kept for recovery.

Close additional copies of the same executable before installing and keep the application folder writable. A failed download leaves the current executable unchanged. Update checks do not send configuration contents or require GitHub credentials.

See [UPDATING.md](docs/UPDATING.md) for installation, rollback, storage and trust details.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| The app does not open or shows an empty window | Install the **Microsoft Edge WebView2 Evergreen Runtime**, then extract the ZIP to a local folder and run **`Config_Inspector.exe`** from there, not from inside the ZIP viewer. |
| Windows warns about an unrecognized app | The builds are not Authenticode signed. Check the download against **`Config_Inspector_Portable.zip.sha256`** or **`SHA256SUMS`** from the same release before running it. |
| A setting is missing from the structured views | Unsupported or ambiguous syntax is kept in original source rather than interpreted. Use **global search** with **Raw text**, or open the object's original source. |
| *"The application folder is not writable"* | Move the executable to a folder your account can write to, then use **App settings → App updates** again. |
| *"Close other copies of this app before installing the update"* | Close every other window running the same executable, then choose **Review and restart** again. |
| *"GitHub has temporarily limited update requests"* | Several copies on the same network share GitHub's request allowance. Automatic checks pause for the delay GitHub reports and then resume; **Help → Check for updates** can be retried later. |
| The updated version does not start | The previous executable is restored automatically if the new one does not finish opening within 90 seconds. For manual recovery, see [Installation and recovery](docs/UPDATING.md#installation-and-recovery). |
| Supplementary data does not appear on a configuration | The hostname in the export or prompt must match the configuration's hostname (the domain is ignored), or one of its interface addresses must match. Otherwise choose the configuration under **Applies to** on the **Supplementary data** page. |
| Hardware details are missing or out of date | Specification downloads use exact model matches and can be disabled in **Device information**; cached definitions work offline. Refresh them there, or see [device specifications](webview/DEVICE_SPECIFICATIONS.txt). |

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
npm ci --ignore-scripts
scripts\build-windows.cmd
```

This produces `dist/Config_Inspector.exe`, `dist/Config_Inspector_Portable.zip`, its `.sha256` sidecar and the existing HTML/icon/checksum downloads, and runs Windows update replacement/rollback tests. The ZIP uses an explicit file allowlist and is CRC/hash checked against the exact executable; no local data or build-directory glob is packaged. Linux cross-compilation uses [webview/build.sh](webview/build.sh) with MinGW-w64. The standalone C++ protocol suite builds from `tests/update-protocol-tests.cpp` with C++17.

For an authorized application release:

1. Change `VERSION`, then run `python scripts/version.py` and `python webview/embed_features.py`.
2. Add release notes in `docs/releases/VERSION.md` using the actual version number and commit the changes to `main`.
3. The [build workflow](.github/workflows/build-release.yml) runs regression, browser and Windows installation tests, then publishes only after checks pass.

Keep the public download name `Config_Inspector.exe`. Installation preserves the user's chosen filename and folder. Existing published versions are not overwritten; documentation-only updates must not bump `VERSION`. For an existing version, the publish job only adds missing portable ZIP/sidecar assets from its downloaded, digest-verified published EXE, never the rebuilt CI binary. It refuses conflicting assets and never replaces `SHA256SUMS`. GitHub source archives provide versioned source downloads. No separate publishing credential or update service is needed.

The supplied editable SVG is the [canonical application icon](docs/ICONS.md); pinned build tooling derives the PNG/Windows ICO and verifies the embedded browser/native artwork for future releases.

Third-party WebView2 and public device-catalog notices are included in [webview](webview/). Native updater fixtures do not replace interactive WebView2 testing on Windows.

</details>
