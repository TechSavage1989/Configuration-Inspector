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
- **Generate network diagrams:** draw any part of the network from the imported neighbor data and open configurations — the selected configuration's device and everything below it, a device and its connections, or the whole site — with switches and firewalls drawn as their real front panels (port positions, connector types and numbers from verified hardware layouts), each device's name above its faceplate and its model and address below it, access points and phones beside the ports they use, color-coded links that never overlap, VLANs and a legend. Documentation pages follow the diagram: a port map, wireless connections, VLANs and routing, and trunk VLANs. Click a device to draw from it down, choose which devices to include, and download every page as one editable Visio (.vsdx) file or printable pages.
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
  <tr><td width="50%"><b>Compact interface map</b><br><img src="docs/images/network-map.png" alt="Compact interface map" width="440"></td><td width="50%"></td></tr>
</table>

### Global configuration search

When supplementary data is open, the search also finds devices, live interfaces, neighbors, ARP entries, MAC table entries, routes and networks by name, IP address or MAC address (any notation, such as `00:00:5e:00:53:01` or `0000.5e00.5301`). Results are grouped by type, and a row of tabs above the results (**All**, **Parsed objects**, **Original fields**, **Configuration text**, **Supplementary data** and others) filters them. Matches offer **Details**, **Show on site map**, **Open configuration** or **Open interface**. With only supplementary data open, the search box still works on it.

**Search results across fields, objects and source**

<img src="docs/images/global-search.png" alt="Search results across fields, objects and source" width="900">

### Site map and live data

<table>
  <tr><td width="50%"><b>Site map built from an Auvik site export</b><br><img src="docs/images/site-map.png" alt="Site map with a firewall, core switch and access switches" width="440"></td><td width="50%"><b>Live link state and neighbors on the interface table</b><br><img src="docs/images/live-interfaces.png" alt="Interface table with live link state and connected devices" width="440"></td></tr>
</table>

### Network diagrams

<b>A core switch and everything below it, drawn for Visio</b><br>
<img src="docs/images/network-diagram.png" alt="Network diagram from a firewall and core switch down to three access switches, with access points and a printer, links colored by type and the connection types in a column at the left" width="900">

<b>Documentation pages after the diagram: the port map with ports colored by role</b><br>
<img src="docs/images/network-diagram-pages.png" alt="Port map page with an access switch front panel, numbered ports colored by role and a port assignment table" width="900">

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

In the **Interface map**, every group (port types, VLAN interfaces, zones, connected devices) and every interface with subinterfaces starts collapsed, so the map opens as a short overview. Click a group heading to expand or collapse it, or use **Expand all** and **Collapse all**, in both the detailed and compact maps. Searching or filtering by zone opens the groups that contain matches.

Headers stay at the top while you scroll: page tabs, each panel's title with its search, filter and sort controls, and table column headings.

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

Open two or more configurations from the same site (**Add files**) and choose **Site overview** in the sidebar. A row of tabs at the top (**Settings**, **VLANs**, **Duplicate addresses**, **Shared subnets**, **Device mentions**, each with its count) shows one section at a time; the page scrolls as one and the tabs and column headings stay at the top. It compares only what the exports contain:

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

- **Site map** (sidebar, once any file contains links): firewalls at the top, then switches by how far they are from the edge. Each line is labeled with the ports at both ends; ×2 marks parallel links. Access points and other endpoints are counted on the switch they connect to; tick **Show access points** to draw them. The map fills the window. Click a device for its connections, or a line between two devices for that connection (both ports, link state, speed, description and MAC address at each end), in a side panel that scrolls on its own, double-click a device marked **Config** to open its configuration, and use **Find a device** on large sites. Scroll the mouse wheel over the map to zoom around the pointer, use the **−**, **+**, **Fit** and **100%** buttons, and drag the map to move it. Wide maps scroll sideways inside the map; scrolling up and down moves the page.
- **Live data on configuration pages:** the **Overview** device summary shows links up, neighbors and CPU / memory; ports at a glance get a green dot for links that are up and an outline for links that are down; the **Interfaces** table adds **Link**, **Connected to**, **Speed**, **Devices seen** and **Errors** columns; and the interface details show everything collected for that port, including MAC addresses with the IP addresses found in any imported ARP table.
- **In the matching sections:** **Routing** adds **Routing table (live)** and **ARP table (live)** tabs, **Switching** adds **Neighbors (live)** and **MAC address table (live)**, and **System & management** adds **Monitoring data (live)**. The **Interface map** shows a live link dot and the neighbor on each interface, plus a **Connected devices (live)** group; map search also finds neighbor names.
- **Linked names and addresses:** device names and addresses in tables, side panels and details (Site overview, duplicate addresses, supplementary data and more) open that device's configuration (at the named interface) when it is open, or its imported details otherwise.
- **Neighbor details:** click a neighbor anywhere it is listed to see its hostname, type, model or platform, IP and MAC addresses, capabilities, serial number and software, and each link to the open configuration with both ports, link state and the remote port's MAC address.
- **Supplementary data** page: a row of tabs at the top. **Files** lists imported files, what was recognized in each and which configuration each applies to (**Applies to**). The other tabs each show one table for the open configuration: **Neighbors**, **Interface state**, **Routing table**, **ARP table** and **Networks**. Site exports add **Network devices**, **Past last support date** and **Known vulnerabilities**. Each table has a filter and shows 100 rows at a time with **Show more**, and the page scrolls as one, with no scroll areas inside it; the tab row stays at the top while you scroll.

Values in these tables (MAC and IP addresses, ports, device names) can be copied by clicking them, and **Copy table** copies the rows shown with their column names for a spreadsheet or ticket.

- **Network diagram** (sidebar, once a configuration or a file with links is open): opens on the device of the selected configuration and everything below it, with the device above it for context. One toolbar holds everything:
  - **Device and below**, **Connections** or **Whole site**, the device and the number of levels.
  - **With configurations alone**, links come from what the configurations say about each other: a port described with another device's name, and a default gateway that is another device's address. Imported neighbor data adds and corrects links. When an export reports a link on a port that is down while the far end's description names another port of this device (such as a firewall's "ha" port for a link on "x3"), the diagram and the Neighbors tables use the described port and show the reported one beside it.
  - **Show**: the upstream device, WAN circuits (from the firewall's WAN interfaces), access points (optionally **grouped into one box per switch**, with their ports outlined on the switch) and other devices, and whether devices are drawn with stencils, drawn faceplates or boxes.
  - **Devices**: every device of the site, with a search box (name, model or address) and a filter (on or off the diagram, or by type). Untick one to remove it (or right-click it on the diagram), tick one from elsewhere to add it, or use **Add shown** / **Remove shown** for everything the search shows.
  - **Stencils**, **Document** (site name, title, subtitle, file name, **Prepared by** and **Organization**, used on the drawing, in the Visio document properties and in download names), **Visio** and more downloads, and **Full screen** (Esc to leave), which gives the diagram the whole window.
  - Click any device to draw the diagram from it down, and use the path under the toolbar to go back up. Scroll to zoom, drag to move, or use the zoom buttons and **Fit**.
  - **Edit** makes the drawing yours to correct (press **Done** to go back):
    - Drag devices and access points to move them; Shift-click, or drag a box on empty space, selects several. The middle mouse button moves the view while editing.
    - Drag a stretch or a corner of a link to move it. A stretch dragged onto the line of another stretch of the same link snaps to it and the two merge. **Ctrl+click** a link to add a point, or a corner to remove it.
    - Double-click a label to change it in a dialog, on as many lines as needed (empty hides it); its box grows to fit the text.
    - Double-click a link to choose the port each end uses.
    - Align the selected items on their left edges, centers or tops, or space them evenly. **Straighten access point links** moves access points over their ports.
    - **Undo** and **Reset layout** are there too.
    - **Add link**, **Add device** and **Links** fix what the files don't show: draw a cable, add a device without a configuration (a provider router, an unmanaged switch), and see where each link comes from (imported data, the configurations, or by hand) to remove the wrong ones.
    - Drag the end of a link to move its point on a port; the ring on the stencil moves with it. Right-click a link to add or remove a bend or reset its route.
    - Double-click a device drawn with a stencil (or use **Port points** under **Stencils**) to place its port points: the stencil with a point per port, selected by click, Shift-click or a box, moved by dragging or with the arrow keys, and lined up with **Same height**, **Same column**, **Space across** and **Space down**; a port can also be chosen from a list and placed by its position across and down (%), and **Undo**/**Redo** (Ctrl+Z / Ctrl+Shift+Z) step through the changes. Port points apply to every device drawn with that shape. The editor opens on the whole device; scroll to zoom, drag with the middle button or hold Space to pan, **Fit** to see it all again. Most stencils need no hand work: a device's port groups are matched to the stencil's connection points in order, group by group, ignoring rack-ear points and allowing for a missing point.
    - **Save hardware pack** (under **Stencils**) saves the shapes the site's devices use, with their port points and shape choices, to one file; **Import hardware pack** brings them to another computer without the original stencil files.
    - **Ctrl+Z** and **Ctrl+Shift+Z** (or **Undo** and **Redo**) step back and forward through every change.
    - **Wireless connections** pages are edited the same way, each with its own edits.
    - Edits are kept on this computer for each view of the site and go into every download. The zoom and scrolled position stay where they are after each change. Devices that start rows line up on one left edge by default.
  - **Pages:** tabs under the toolbar show the documentation pages that follow the diagram, built from the open configurations and supplementary data. Each is a letter page:
    - **Port map**: each firewall on a page of its own and switches two to a page: the front panel with ports colored by role (on a vendor stencil, a numbered square over each port) (wired data, access points, uplinks, trunks, default access, disabled) and filled when the link is up, and a table of the ports in each role with their VLANs and link details.
    - **Wireless connections**: each switch drawn with its access points wired to their own ports: a row above the switch for top-row ports and a row below for bottom-row ports, each access point's name, port and speed, and address stacked over or under its icon, then every access point with its switch port, model, address, speed and link state; links below 1 Gbps are listed.
    - **VLANs and routing**: VLANs with their addresses and devices, routed interfaces and routes, and any address used on two devices.
    - **Trunk VLANs**: native (N) and tagged (T) VLANs for each group of trunk, access point and uplink ports.
    - **Choose pages** (next to the tabs) turns each kind of page on or off and chooses which devices appear on the port map.
  - Faceplates use the verified front-panel layouts that **Interfaces at a glance** uses (Cisco Catalyst, Aruba CX and AOS-S, HPE, FortiGate, Juniper EX, SonicWall, Palo Alto and Sophos models), including a model you choose there: ports sit in their real groups and positions, with their real numbers (for example 49-52 at the left of an Aruba CX 6100), RJ45 jacks drawn taller than wide and SFP and QSFP cages as wider, darker cages. Other devices use a built-in catalog or their own interfaces, odd ports on top, in blocks of 12. Stack members are side by side. Linked ports are outlined in the link color and named in a band above or below the device.
  - Links are named and colored by cable or fiber type and speed, as in a typical site drawing: "10 Gbps SR fiber" (red), "10 Gbps LR fiber" (blue), "10 Gbps SFP+ DAC" (black), "1 Gbps copper" and "Local handoff" (yellow), "AP copper" (green); dashed when slower than 1 Gbps. The media comes from the port's reported media (`show interfaces status`) or else its connector (SFP cage or RJ45). The connection types are listed in a column at the left; double-click an entry (or right-click a link while editing) to change that type's color and name, which recolors its links and its legend entry together, or give one link its own type ("This link only") with its own legend entry. Endpoint boxes show full names and sit over the body of their switch; the port map shows each faceplate without repeating its label. Provider handoffs and other devices are pale boxes with a dark accent bar, and grouped access points a green summary box. A link reaches a top-row port from above and a bottom-row port from below, goes around devices, never runs on top of another link, and crosses another link only when no route avoids it (it then hops over it). Access points and other endpoints sit above and below their switch, within its width where they fit, to keep the page compact. A port reported with several neighbors becomes a trunk with a junction dot.
  - Access points and named devices sit above the switch when they use a top-row port and below it for a bottom-row port, with their port, name and address; others are counted.
  - **Stencils:** the app does not include vendor artwork, so devices are drawn as generic faceplates until you import your vendor Visio stencils (.vss or .vssx), or a Visio drawing that already uses them (.vsdx), with **Stencils** (or **Import stencils** on the notice) on the diagram page or with **Add files**. **Import a stencil folder** searches a folder and its subfolders. Older Visio stencils (.vss, Visio 2003 to 2010) are read directly, without Visio installed. Devices then use the front-view vendor shape that matches their part number or model (or the product number and description the stencil records, which can be newer than a shape's name), access points their face-on view; a shape for another generation of the series (an FG-120F for a FortiGate-120G) is not used automatically, because its ports differ. **Stencils** has two tabs: **Devices** and **Stencil files**, each with a search box. Choose a device's shape by picking a stencil file and then a shape in it, or search every file at once (model, part number, product or file name); suggestions come first. Tick several devices to give them one shape, the automatic choice or drawn faceplates. Port map pages use the same stencils. Artwork the app cannot draw in full (gradient or EMF+ only pictures) is not used automatically. Links land on the stencil's ports: for devices with a known front-panel layout, each group of ports is matched to the stencil's ports in order (including SFP cages marked at both edges); otherwise when its connection points fit the device's ports. Visio downloads contain the vendor shapes. Stencils stay in the app on this computer.
  - **Letter or A4 paper:** each diagram is arranged to fit a letter sheet and the area it shares with A4 (landscape or portrait, whichever needs less shrinking), so it prints whole on either, and the label next to its title shows the orientation and scale. Port numbers on links are large and bold, and lie flat beside their line where neighboring ports leave room, which keeps the drawing compact; the app tries several arrangements and keeps the one that prints largest. When a device-and-below diagram would shrink too far to read, the first page still shows every device below it (access points summarized per switch) and each branch continues on its own page ("<device> and below"). Visio, SVG and printable downloads are laid out on letter pages; a very large diagram is flagged when its text would be small (show fewer levels or devices, or use the site book).
  - Downloads: **Visio** with the diagram and every documentation page (each device is one group of plain shapes, so it moves as a unit and stays editable); in the menu next to it, **This page only (.vsdx)**, an **SVG image of this page**, **Printable pages** (every page, to print or save as PDF), **Site book (.vsdx)** with the whole site and one page for each switch with switches or access points below it, and **Device library (.vsdx)** with every catalog faceplate to copy into your own diagrams or drag into a stencil.

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

The **Dark** / **Light** button at the top of the window switches between the dark and light themes (the choice is remembered). Open **App settings** from the sidebar or native File menu to choose the desktop data folder and manage stored app data. The default desktop location is **`%LOCALAPPDATA%\ConfigInspectorWebView`**, outside the executable folder; changing the location takes effect on the next launch.

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
| Visio says the file cannot be opened (error 271) | Drawings exported before version 5.43.0 lack a part Visio requires. Update the app and download the drawing again. |
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
