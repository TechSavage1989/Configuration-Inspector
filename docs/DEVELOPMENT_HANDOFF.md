# Configuration Inspector development handoff

## 5.45.0 — compact bands, full-render row choice, neighbor port correction

- Per-device label bands `d.bt`/`d.bb` (rows use the maximum): `bandFor()` lays port labels flat
  (36 px band) when neighbors leave room, else rotated in a band sized to the longest label.
  `geo()` carries `flat`/`band` to the label drawing. `BAND` remains for box style.
- `diagram()` shortlists row widths by measured size, then renders the best three in full and
  keeps the largest `fitLetter(page).raw`.
- `splitDiagram()`: the first page is the full-depth diagram with `apGroup:true` (never a
  depth-1 overview that drops devices). `window.DIAGRAM_READABLE` overrides the 0.7 threshold
  for tests and is part of the page cache key.
- `liveFor()` applies `correctLinkPort()` to live neighbors (`n.reported`, `n.correction`); both
  Neighbors tables show "(reported …)".

## 5.44.0 — details above and below devices, tall access points

- Plates have no side label column: `dev.h = HEAD + plateH + FOOT` (18 + 72 or stencil height + 18);
  ports, `imgTop` and slot `py` include `HEAD`. `drawHeader()` writes the name and model/address
  in the widest span no link stub crosses (`gapsOf`/`freeSpan`); `Device.fit()` calls
  `fitHeader()` after terminals are known to choose `nameSide` and widen only if needed.
- Port map clones draw with `noLabel` at `y - HEAD` and advance by `plateH`.
- Wireless pages pass `tallAps` (view): `EP_H` 108 and access points drawn as icon plus three
  lines (name, port and speed, address and AP port), with a white hit area for dragging.

## 5.43.0 — Visio 271 fixed, readable pages

- Visio error 271: `documentXML()` was missing `<DocumentSheet NameU="TheDoc">` after
  `StyleSheets` (Visio-saved files and NetworkDiagramStudio both write it). Also removed
  `DefaultGuideStyle="0"`, text now starts `<cp IX="0"/><pp IX="0"/>`, ZIP entries set the
  UTF-8 name flag. `tests/diagram-tests.cjs` checks the DocumentSheet.
- `fitLetter` fits the area shared by A4 and letter (11 x 8.27 in) while pages stay letter.
- `splitDiagram()` in index.html (`READABLE = 0.7`): an oversized downstream diagram becomes a
  depth-1 overview plus one continuation page per branch with its own children.
- Port labels on links are 12 px bold (`BAND` 72).

## 5.42.0 — per-link types, full endpoint names, cage clusters

- `diagram()` builds `view` field by field: pass new options through it (`linkStyles` was missing,
  so legend edits did nothing).
- Per-link kinds: `edits.lineKinds[lineKey] = {label, color}` becomes kind `custom:<label>`
  (shared legend entry); set in `showLinkStyle(kind, lineKey)` with the "This link only" choice.
- `EP_W`/`EP_PITCH` are reset per render and widened to the longest endpoint name; rows stay
  over the device body (`d.w` minus the last plate's label) or at least within the device.
- Port map faceplates draw with `noLabel` (no repeated name/model/address box).
- `fitPorts` takes raw points from `SWStencils.portPoints()` and lets a group cover more stencil
  columns than it has (clusters split at the widest gaps; skip 0.5, extra column 0.12, a
  cluster wider than 1.5 pitches +1). `tests/stencil-tests.cjs` reproduces the 6100 layout
  (five SFP points per row) that 5.41.0 placed three columns left.
- Synthesized .vss masters get deterministic `UniqueID`/`BaseID` (`guid()` in stencils.js).
- Visio error 271 is still reported by the owner; package structure, rels, content types, style
  ids, master references and cell names all validate. Diagnostic variants (no stencils,
  FortiGate only, AP only) were sent to the owner to isolate the part Visio rejects.

## 5.41.0 — link kinds, wireless editing, port fitting

- Link kinds (`linkKind`, `KINDS`, `LINK_MEDIA` in diagram.js): media from `l.aMedia/bMedia`
  (evidence `media`, set beside `aSpeed` in `diagramInput`) via `mediaOf()`, else the port's
  connector (`slot().fiber`) or name; key `media-speed` (e.g. `sr-10000`). `kindStyle(key, view)`
  applies `view.linkStyles` (localStorage `config-inspector-link-styles`, `showLinkStyle()`);
  lines and legend entries carry `data-kind`. `LINK_TYPES` stays for legacy keys only.
- Strict re-route crossing cost is 20000, so any crossing-free route wins.
- Wireless pages are editable: `editKeyOf`/`editPageOf`/`editableTab` pick the edited page; its
  edits are stored under `["wireless", site, switchKey]` and passed to `docPages` as
  `wirelessEdits` (and `linkStyles`).
- `fitTexts(page)` grows a group's box (and accent bar) to fit edited or long labels; labels are
  edited in a textarea dialog (`showLabelEdit`).
- Endpoint rows stay within the device width where they fit (backward and forward pass).
- `fitPorts(groups, cand)`: when `bankLayout` cannot map one to one, stencil points (`edgePorts`
  via `st.edges()`) become columns split into blocks; a DP maps device columns to stencil columns
  in order (skip cost 1, a group start off a block start costs 3), ignoring rack-ear columns.
- Port points editor: fixed 1000-unit drawing fitted to the box (`spGeom`), viewBox zoom/pan
  (`spZoom`, wheel, middle button, Space+drag), marker size constant on screen (`e.upp`).
- Fix: the aggregate-port filter in `diagramDocs` matched FortiGate `port1` (`/^po/`).

## 5.40.0 — fewer crossings, hardware packs

- Routing: `CROSS` is 30 in the first pass. Every line that still crosses is routed again
  against all others (`Router.rebuild(paths, skip)`) with `router.cross = CROSS_STRICT` (400)
  and kept when `Router.score()` shows fewer crossings (owner request: avoid crossings whenever
  any route does), or as many with fewer bends. A strict cost in the first pass made early lines
  take long detours that blocked later ones, so it is used only in the second pass.
- Style follows the owner's reference drawing (a client site's core page, kept outside the repository): `LINK_TYPES` colors (fiber red,
  copper and WAN yellow, AP green), line widths 2/2.5, `legendColumn()` at the left (`LEGEND_W`,
  devices start at `LEFT`; the router blocks the column), endpoint boxes with an accent bar,
  the green AP group box, and numbered role squares on stencil port maps (`portNumber`).
- The browser context menu is suppressed outside text fields (`onDoc('contextmenu')`).
- README diagram screenshots were recaptured from the fictional `demoSite()` plus EXAMPLE-ACCESS1
  configuration (tests/xlsx-writer.cjs).
- Hardware packs (index.html `saveHardwarePack`/`importHardwarePack`, format
  `config-inspector-hardware-pack`, schema 1): the masters in use (fields as `read()` gives
  them, Uint8Arrays as `{$b64}`, `_`-prefixed caches dropped), `points` per `masterKey` and
  `choices` per device key. Import stores each file as `<file> (hardware pack)` in the stencil
  store with `pack:true` and the parsed form (no bytes); masters keep their original `file`, so
  `masterKey` and saved choices still match. `packDecode` drops prototype keys.
- Port point editor: `spSnap`/`spSwap` undo history, the `[data-sp-pick]` list and
  `[data-sp-x]`/`[data-sp-y]` percent fields; Ctrl+arrows nudge 0.1 px.
- Ideas taken from NetworkDiagramStudio (sibling app): hardware packs, the port list with
  numeric positions, undo in the port editor.

## 5.39.0 — editor selection, route snapping, stencil port points

- Editor (index.html): `editDrag.kind` is `move`, `box` (selection box on empty space,
  `state.diagramBoxed` swallows the click after it), `port` (moves the stencil ring
  `rect[data-port]` live), `corner` (`routeCornerMove`) or `line` (`routeSegMove`). Both snap
  to coordinates of the same route within `editTol()` (8 screen px) and `routeTidy()` merges
  collinear stretches; Ctrl+click adds (`routeWithBend`) or removes (`routeWithout`) points.
  A press near a thin link takes it; a corner is taken only within a third of its stretches.
- `renderKeepingView()` re-renders after edits keeping scroll; the auto-fit key is
  `cur.baseKey` (without edits), so edits never refit. Middle-button drag pans.
- Hops are no longer skipped between lines of the same bundle (`groups`).
- Stencil port points: `stencilPointsAll()` (localStorage `config-inspector-stencil-points`,
  per `masterKey`, keyed `group|index` as fractions of the artwork) reach `Device.place()`
  through `stencil.points`; `SWDiagram.stencilPorts(node,ports)` lists the points for the
  editor (`openStencilPoints`, `drawStencilPoints`, `SP_MARGIN` canvas margin).
  `state.stencilPointsVersion` is part of the `diagramInput()` cache key.
- `stencils.js`: bitmap blits (76/77) follow `BLEND[rop]` (SRCCOPY, SRCAND multiply,
  SRCPAINT lighten, SRCINVERT difference); other raster operations count as unsupported.
- `#toast` is a manual popover (top layer), so messages show over open dialogs.
- `.site-link-row[hidden]` is forced hidden (`display:flex` used to beat `[hidden]`, so the
  stencil device search and the diagram device list did not filter).
- Theme: `#theme-choice` is a toggle button (`applyTheme` sets its label and aria-pressed);
  App settings keeps its own theme select.
- `tests/updater-windows-tests.cpp` waits for the workspace to be deleted after the restore
  marker (the probe writes the marker first), which made the Windows job fail at random.
- Screenshots: `docs/images/hero.png` was recaptured with the fictional Example-3650 stack
  from `tests/cisco-3650-tests.cjs`. The other README screenshots still show the old Theme
  drop-down in the top bar; recapture them with fictional data when their pages are next updated.

## 5.38.1 — EMF clipping

- `emfSVG()` emits through `emit()`, which wraps drawing in the clip path in force
  (`SelectClipPath` 67, `IntersectClipRect` 30, reset by `ExtSelectClipRgn` 75 with RGN_COPY
  and no region; saved with SaveDC/RestoreDC). Clip ids are unique per picture (`emfSeq`).
  BitBlt without a bitmap paints only for PATCOPY, WHITENESS and BLACKNESS.

## 5.38.0 — diagrams from configurations, manual links, stencil picker

- `siteMapAvailable()` is true with configurations alone. `configLinks()` infers links from
  port descriptions naming another device and from default gateways (port toward the other
  device: described port, subinterface parent, or the trunk carrying the VLAN). WAN circuits
  come from WAN-role or WAN-zone interfaces (Show > WAN circuits, `view.wan`, link type `wan`).
- `siteEdits()`/`saveSiteEdits()` (localStorage `config-inspector-site-edits`, per site name):
  hand-added devices and links and removed link ids; dialogs `showAddLink`, `showAddDevice`,
  `showSiteLinks`. `pushUndo`/`swapEdit` give Ctrl+Z / Ctrl+Shift+Z across all edits.
- Editor: `edits.portPos` (port point offsets, dragged by a link's end), link context menu
  (`routeWithBend`, `routeWithout`), every crossing hops (horizontal over vertical).
- Stencils: `showStencilPicker()` (file list, shapes of the file, search across files,
  suggestions by `score`), multi-device apply; port maps get `o.stencils` unless drawn
  faceplates are chosen; EMF BitBlt/StretchBlt/AlphaBlend/SetDIBitsToDevice drawn, gradient
  and EMF+ only pictures marked `partial` and not used automatically.

## 5.37.0 — diagram editor

- `diagram(input,{edits})`: `edits.moves` (device offsets), `eps` (endpoint offsets, key
  `epKey`: AP key or `group:<switch>`), `ports` (`device|short(original port)` → port),
  `lines` (route by `lineKey`, used while its ends still meet the ports), `texts` (by
  `tkey` = group|original text), `maxRow` (the arrangement the edits were made on).
  `page.eps`/`page.devices` give positions for the alignment tools. Rows start on one left edge.
- index.html: `diagramEditKey`, `diagramEdits` (localStorage `config-inspector-diagram-edits`),
  `saveDiagramEdits`, `undoDiagramEdit`, `diagramEditBar`, pointer handlers registered with
  `onDoc` (the node harness has no addEventListener), `showLinkPorts`.

## 5.36.0 — faster launch and loading, firewall port maps, cleaner links

- Launch: `loadStencils()` starts on idle, reads one stored file at a time (`getAllKeys` then
  `get`), yields between files and stores the parsed stencil with the file (`parsedTag`).
- `evidencePort()` uses `portIndex` (device|interface map, rebuilt when the sets change).
- `SWStencils.match` prefilters by model-number runs (`masterRuns`, `mayMatch`).
- Routing: `BEND` is 20; terminals on stencils keep the exact port x (`slot.ex`, `onPort`)
  for their vertical stretch. Port maps: firewalls and routers alone, switches in pairs.

## 5.35.0 — stencil ports, wireless drawings, AP groups, page choices

- `layout.nodes` now carry `hw` as well (index.html `diagramInput`); before, the diagram itself
  drew catalog faceplates and only the documentation pages used hardware profiles.
- Stencils: `edgePorts()` and `bankLayout()` map known port groups onto a stencil's connection
  points; `Device.stencilPlate` builds `bankMap`. Matching reads NetZoom product properties,
  penalizes side/edge views, and prefers square (face-on) shapes for access points.
- `hardware.js`: FortiGate 120G order is HA/MGMT, 1-16, X1-X4, 17-24 (Fortinet stencil).
- Wireless pages draw `diagram()` per switch (others hidden, `noVlans`) before the table.
- `view.apGroup` condenses access points into one endpoint (`node.group`, `ports`).
- `docPages(input,{pages,portMapSkip})`; the **Choose pages** menu (`data-diagram-page`,
  `data-diagram-portmap`) sits in the page tab row.

## 5.34.1 — stencil dialog tabs

- `stencilTabs()` splits the stencil dialog into Devices and Stencil files panes
  (`state.stencilTab`, `data-stencil-tab`/`data-stencil-pane`), each with a search box
  (`.stencil-device-filter`, `.stencil-file-filter`, filtered in place without a re-render).

## 5.34.0 — real faceplates, documentation pages, diagram toolbar

- Faceplates: `diagramHardware(n)` (index.html) resolves a node's hardware profile from its
  configuration (stack members, Interfaces at a glance choice) or the model and part numbers in
  the supplementary data, and passes `node.hw = {members, portOf(name)}`. `Device.fromProfile`
  turns each bank into a group (`portPos`/`groupWidth`: pitch 18 px, 27 px for QSFP, 9 px gap
  every 12 ports); `Device.place` gives the slot; `drawPort` draws RJ45 jacks with a latch notch
  and SFP/QSFP cages. Catalog fallback: `upFirst`, `rows`, `mod`, `family`, uplink numbering
  `base` (49-52 on 48-port boards unless named on a module).
- Documentation pages: `docPages(input,o)` with `portMapPages`, `wirelessPages`, `routingPages`,
  `trunkPages`; `Flow`, `docTable`, `note`, `ranges` helpers; `number()` adds page numbers.
  `diagramDocs()` (index.html) builds `input.docs`; `diagramDocPages(offset)` caches the pages.
  The diagram page shows them as tabs (`state.diagramTab`); **Visio** downloads all pages,
  `vsdx-page` the page shown, printable HTML every page (named @page per orientation).
- Toolbar: `.diagram-bar` with `.diagram-pop` menus (`state.diagramPop`, one open at a time,
  `placePop` keeps them on screen), full screen (`state.diagramFull`, Esc).
- Stencils: `generationDiffers()`, rear-view penalty, paired names (90/91G, FG/FWF); the
  stencil dialog lists access points and uses a searchable `<datalist>` (`state.stencilLabels`).

## 5.33.0 — Visio compatibility, letter paper, stencil folders, document details

- Visio package fixes in `diagram.js` (`documentXML`, `charSection`, `shapeXML` order, ZIP
  dates); structure checks in `tests/diagram-tests.cjs`.
- `diagramMeta()` (title, subtitle, file, author, company; author/company in localStorage)
  feeds `diagram()` (`customTitle`, `company`, `footer`) and `vsdx(pages,title,meta)`.
- Device list: `filterDiagramDevices()`, `data-diagram-bulk`. Stencil folder input
  (`webkitdirectory`); `.vss` stencils read natively by `readVSS()` (CFB reader `cfbStream`,
  LZ77 `lz`, chunk headers `eachChunk`), only pre-2003 files are listed as unreadable.

- `render(input,{measure:true})` returns the laid-out size before routing; `diagram()` tries
  several `maxRow` values and keeps the best `fitLetter()` result. `onLetter(page)` scales
  every shape onto a letter page; `vsdx()` applies it to all pages, the SVG and printable
  downloads use it too. VLAN lists go below in columns when that fits paper better.
  `library()` returns several pages. The panel shows `paperChip()`.
- `stencilNotice()` invites importing stencils (or reports that none match);
  `.vsdx` files from **Add files** are read as stencil sources.
- `tests/stencil-writer.cjs` builds the fictional test stencil for node and browser tests.

## 5.32.0 — stencils, linked names, add/remove devices

- `webview/stencils.js` (embedded `vendor-stencils`, `window.SWStencils`): `read()` unzips a
  .vssx/.vsdx and returns masters (frame from their pictures, connection points, part
  number properties, media); `match()` scores masters against a device's model and part
  numbers (config identity from `deviceIdentityFor`); `ports()`/`layout()` cluster
  connection points into port blocks (odd on top) and map main/uplink ports when the
  blocks fit; `artwork()` renders PNG/JPEG/BMP and EMF (GDI records) to SVG markup.
- index.html keeps imported stencils in IndexedDB (`config-inspector-stencils`), per-device
  choices in localStorage, and passes `input.stencils` to `SWDiagram.diagram`. `diagram.js`
  draws stencil devices (`Device.stencil`, `image` shapes) and writes masters, media,
  page relationships and instances (children repeat scaled boxes and ForeignData).
- `linkifyEntities()` (MutationObserver on content, drawer and dialog) and `openEntity()`.
- `correctLinkPort()` fixes neighbor ports using descriptions and link state.
- Diagram: `state.diagram.added`/`hidden`, `scope({added})`; right-click removes a device.
- Site map: the side panel is sized before the map in `fitSiteMapToWindow`.

## 5.31.0 — scoped, routed network diagrams

- `diagram.js`: `scope(layout,options)` picks rows of devices (downstream of a focus,
  its connections, or the whole site; depth, upstream, hidden set); `render(input,view)`
  lays out faceplates (`Device`: groups/members from `parsePort` + `physicalPort` filtered
  inventory, `CATALOG` or 24/48+4 uplink inference) or boxes, places endpoints above/below
  by port row, routes every link with the grid `Router` (A* with bend/crossing costs,
  no shared edges, endpoint corridors reserved, relaxed fallback flagged `strict:false`),
  adds hops at crossings, trunks for shared ports and rotated port labels in the bands.
  `diagram(input,options)` titles a page; `build(input)` is the site book; `library()` is
  the device catalog page. Devices are SVG `<g data-diagram-node>` and Visio group shapes.
- index.html: `diagramInput()` (cached per evidence/workspace) adds speeds, VLANs and port
  inventories; `diagramOptions()` keeps `state.diagram` and follows the selected
  configuration; `diagramCurrent()` caches pages per option key. Zoom/pan reuse the site
  map handlers (`zoomKey(box)` keeps `state.diagramZoom` separate); a new diagram is fitted
  once via `data-autofit` in `fitSiteMapToWindow`.
- Icons: `VIEW_ICONS` gives every navigation page its own icon (`viewIcon()` in `navItem`
  and the overview stat cards); `tests/navigation-browser.cjs` checks they differ.

## 5.30.0 — network diagrams

- `webview/diagram.js` (embedded `network-diagram`, `window.SWDiagram`) builds page models
  (rect/text/line shapes in px) from `SWSiteMap.layout`: an overview, then building pages
  (`buildingPage`: upstream device, faceplate stack, AP cables into faceplate ports,
  VLANs, legend). Subtrees of up to 8 switches share a page; larger ones split per child.
  `svg(page)` renders; `vsdx(pages,title)` writes a minimal Visio package (stored ZIP,
  96 px = 1 in, font size px*0.75 pt). LibreOffice opens the output (`soffice --convert-to pdf`).
- index.html: view `diagram`, `diagramBuild()` adds port speeds and VLANs (config VLANs, else
  evidence VLANs); `exportDiagram()` downloads vsdx/svg/printable HTML. The title input
  updates only the preview (re-rendering on change broke focus handling).

## 5.29.1 — site map fits the window, clickable links

- `fitSiteMapToWindow()` (called from `pinHeaders`) sizes `.site-map-scroll` and the
  device panel to the remaining content height so `#content` never scrolls on the map.
- Edges carry `data-sitemap-edge="edge:<a>~<b>"` with a wide transparent `.edge-hit`
  path; `siteMapEdgeDetail()` lists each link with `evidencePort()` facts for both ends.

## 5.29.0 — supplementary search and map zoom

- `supplementarySearch(query)` matches evidence devices, interfaces, links, ARP, MAC,
  routes and networks (MAC by normalized hex) and groups them; `searchPageHTML()` adds the
  `data-gs-type` tab row and the grouped block to `SWSearchUI.render` output without
  changing search_ui.js (`state.search.supOnly` hides configuration results via CSS).
  `supplementaryOnlySearch()` serves the search box when no configuration is open.
- Site map: `.site-map-scroll` is a fixed-height viewport with `overflow:hidden`;
  `applySiteZoom()` resizes the SVG around the pointer (wheel, `data-sitemap-zoom`
  buttons), pointer drag pans and swallows the following click.

## 5.28.1 — tabbed site overview

- `sitePage()` renders a `.site-tabs` row (`data-site-tab`, `state.siteTab`) and one
  section; tables use `.evidence-wrap.site-wrap` (no inner scroll), so `pinHeaders()`
  pins the tabs, panel title and column headings.

## 5.28.0 — network map collapsed by default

- `state.mapOpen` holds opened map groups (`zone:`/`compact:` keys) and interface ids;
  `mapClosed(key)` treats everything else as collapsed. While searching or filtering,
  `state.mapSearchCollapsed` is used instead (groups open by default). `toggleMapItem`
  handles `data-map-collapse` and `data-map-toggle`. Connected devices (live) uses
  `zone:live-neighbors` / `compact:live-neighbors`.

## 5.27.5 — independently scrolling site map panel

- `.site-map-detail` is sticky with `overflow-y:auto`; `pinHeaders()` sets its
  `max-height` to the visible content height. Its `.panel-head` sticks inside it.

## 5.27.4 — consistent side panels

- `siteMapDetail()` renders `.side-panel-body` rows and `.site-link-row` connection rows
  (connections to drawn devices, then attached devices). `liveInterfacePanel()` uses the
  drawer's `.detail-summary`/`.detail-cell`.

## 5.27.3 — copyable live data

- `evidenceCell(c,i,label)` wraps plain values in `copyValue`; `{html,text}` cells get a
  compact copy icon (`copy:false` opts out). `evidenceRowsHTML` and `tableTSV` back the
  tables and the **Copy table** buttons (`data-copy-value`).

## 5.27.2 — pinned headers app-wide

- `renderContent()` now calls `renderContentView()` then `pinHeaders()`, which sets inline
  `position:sticky` and stacked `top` offsets (`data-pinned`) and unclips non-scrolling
  table wrappers (`data-unclipped`). List-view pages and Compare keep their own layout.
- `#content:not(.list-view) .panel{overflow:clip}` keeps rounded corners without
  creating a scroll container. Tests: supplementary, site overview and navigation suites.

## 5.27.1 — sticky supplementary tabs

- `.evidence-tabs` is `position:sticky;top:0` inside `#content` (the page scroller);
  keep ancestors free of `overflow` so it stays pinned. The browser test checks it.

## 5.27.0 — supplementary data in sections, map and neighbor details

- `evidenceSections()` builds the tables; `evidencePage()` renders a tab row
  (`data-evidence-tab`, `state.evidenceTab`) and one section through `evidenceSection()`
  with a filter (`#evidence-query`, `state.evidenceQuery`) and `data-evidence-more`
  paging (`state.evidenceLimit`, 100 rows). `.evidence-wrap` scrolls only sideways.
- `.site-map-scroll` scrolls only sideways; the device panel is sticky without its
  own scroll area.
- `liveTabs(id)` adds `live-*` tabs to `availableTabs` (Routing, Switching, System);
  `liveTabPanel` renders them, and `configurationCategories`/`hasView` count them so a
  section with only imported data still appears.
- Interface map (view `topology`): `liveMapLine(r)` on each row, `liveNeighborPanel()` as an extra zone
  panel. `showNeighbor(name, localPort)` opens the neighbor details modal; links carry
  `ip`, `platform`, `portDescription`, `chassis` and `capabilities` from evidence.js.

## 5.26.0 — supplementary data and site map

- `webview/evidence.js` (embedded `supplementary-data`, `window.SWEvidence`) reads XLSX
  (own ZIP reader using `DecompressionStream('deflate-raw')`, regex sheet XML), CSV and
  show-command text into one shape: `interfaces`, `links`, `devices`, `routes`, `arp`,
  `mac`, `networks`, `lifecycle`, `vulnerabilities`. Tables are recognized by header
  names (`RECOGNIZERS`), not sheet names; `Top ...` and `... Evidence` sheets are skipped.
  `fromText` returns null for configuration-like text so configs still import normally.
- `webview/site_map.js` (embedded `site-map`, `window.SWSiteMap`) assigns roles and tiers
  (firewalls first, BFS) and summarizes APs/endpoints on their switch.
- `index.html`: `evidenceSets` (in memory), `liveFor(model)` per-model join cached by
  `evidenceVersion()`, live table columns (`live:*` keys in `rowValue`), glance badge
  classes `live-up`/`live-down`, `liveInterfacePanel` in the drawer, views `sitemap` and
  `evidence`. `clearWorkspace(true)` keeps supplementary data when the last config closes.
- Tests: `tests/supplementary-tests.cjs`, `tests/supplementary-browser.cjs`, test data
  from `tests/xlsx-writer.cjs` (fictional). README images `site-map.png` and
  `live-interfaces.png` come from a fictional site export kept outside the repository.

## 5.25.0 — app-wide polish

- `deviceSummaryCard(dedicated)` (index.html, before `overview()`) builds the
  Overview/Device information summary from `deviceIdentity`, `SWHardware.inventory`
  and `SWSiteOverview.build([model]).settings`; `physicalPortUsage()` counts
  physical ports only. `dedicated` (Device information) omits the stat tiles.
- `overview()` renders device, findings, interfaces and policies sections (plus WAN
  when present); map, totals, essentials and notes were removed from the Overview.
- `sectionSourcePanel` renders only when toggled (`data-action="toggle-section-source"`
  on the notice line); views without a section source never show the button.
- `compactPortList()` turns 7+ comma-separated ports into short-name ranges in
  `column.wrap` cells (full list kept in `title`).
- Header import buttons show only without a model; `.workspace-add` holds Add files
  and Paste next to the open files.
- `tests/polish-browser.cjs` guards this layout.

## 5.24.0 — migration validation performance

- `webview/migration.js` previously recomputed facts for every candidate pair and
  expanded reference chains recursively (VLAN -> ports -> VLANs), which never
  finished on a 106-port stack. Facts are now computed once per record, referenced
  objects are described by their own facts (one level), and matching uses
  category/scope/signature and name indexes. 118 items analyze in ~8 ms.
- `migrationPanel()` caches the analysis (`state.migrationCache`), defaults to the
  Needs attention filter, pages 50 items and builds item bodies on `toggle`.

## 5.23.0 — navigation and map collapse

- Sidebar sections render through `navSection()`; collapsed keys are stored in
  localStorage `config-inspector-nav-collapsed` (cleared by Delete stored data).
  The section containing `aria-current="page"` is always open; Workspace is fixed.
- Map groups use `state.mapCollapsed` (keys `zone:<group>` and `compact:<group>`),
  toggled by `data-map-collapse`; `data-map-collapse-all` collapses or expands all.
- Avoid `var collapsed` inside the detailed map renderer: an outer `collapsed`
  Set already exists in that scope (shadowing it broke imports).
- README screenshots were all recaptured with a fictional DEMO-ACCESS-SW01 stack
  and a three-switch site set kept outside the repository.

## 5.22.0 — site overview

- `webview/site_overview.js` (embedded `site-overview`) compares workspace models:
  settings (summary fields plus feature facts such as "NTP servers"), VLANs,
  duplicate addresses and shared subnets per VRF, and descriptions that name
  another open device (whole-name, case-insensitive). No physical links are
  inferred because running configurations lack CDP/LLDP neighbor tables.
- `sitePage()` in `index.html`; the `site` view is excluded from the fixed-height
  `list-view` layout so its panels scroll normally. The nav item appears only
  with two or more open configurations.

## 5.21.0 — client report and change summary

- `webview/client_report.js` (embedded `client-report`) renders HTML from data the
  app collects in `clientReportDevice()`; port states reuse the Interfaces at a
  glance classification by temporarily activating each workspace model
  (`withModel`, which swaps `state.model`, `state.interfaceUsageCache` and
  `state.recordMap` and restores them). Secrets are never collected.
- `webview/change_summary.js` (embedded `change-summary`) turns
  `SWCore.compareRecords(..., redact=true)` into text. Renames are tracked by
  comparison item because record ids can repeat across the two sides.
- `var APP_VERSION` in `index.html` is updated by `scripts/version.py`.

## 5.20.0 — recent files and new review checks

- `webview/recent_files.js` (embedded as `recent-files`): File System Access handles
  in IndexedDB `config-inspector-recent-files`. Display metadata (`entries`) and
  handles (`handles`) are separate stores; listing never deserializes a handle.
  A `config-inspector-recent-pending` localStorage marker disables the feature on
  the next start if a reopen never finished. Contents are never stored.
- Headless Chromium in the Linux sandbox stops the page when a stored OPFS handle is
  read back from IndexedDB, so `tests/recent-files-browser.cjs` verifies real
  persistence and listing, and uses an injected `window.SWRecentFilesStore` for
  reopening. Real reopen of a stored handle is unverified in WebView2.
- Review checks `unused-object`, `vlan-undefined`, `vlan-unused`, `vlan-default`,
  `trunk-all-vlans` in `webview/review.js`. CLI VLAN records gained `declared`
  (persisted in snapshots) because range-declared VLANs only own the first line.

## 5.19.1 — interfaces at a glance fill their card

Port tiles grow up to 56px per column (was 34px) so faceplates fill the card
width; text, icon and height scale with them. Enlarge keeps a 34px minimum and
horizontal scrolling. `tests/cisco-3650-browser.cjs` checks fill at 1600px.
`docs/images/interfaces-at-a-glance.png` was recaptured with a fictional stack.
5.19.0 assets were downloaded and verified against GitHub digests,
`SHA256SUMS` and the portable ZIP contents.

## 5.19.0 — updater rate limits, rename hints, Arista EOS / Huawei VRP

Release explicitly authorized by the owner on 2026-11-04. Prepared on
`claude/amazing-meitner-ogir0h`, merged through pull request 4; the main
workflow publishes after its checks pass. Release notes:
`docs/releases/5.19.0.md`.

- Updater: automatic checks run at UI readiness and every six hours (was two
  minutes), send `If-None-Match` and reuse the verified feed on 304, and pause
  for `Retry-After`/`X-RateLimit-Reset` on 403/429 (1 minute..24 hours,
  default one hour). Pure helpers live in `update_protocol.h`.
- Object comparison: unique same-type removed/added pairs with identical
  settings apart from the name get a "Possible rename" hint; kinds and counts
  are unchanged.
- New CLI dialects `arista-eos` and `huawei-vrp` in the CLI switch adapter,
  detected before Cisco. Huawei is not wired into the feature/network/NAT
  modules (they parse Cisco-style syntax). Device-spec downloads do not map
  either manufacturer yet.
- README: Updates quick link and Troubleshooting section.

Checks run: 110 C++ protocol checks; 58 native scheduler checks compiled with
MinGW and run under Wine; full Windows app cross-compiled; all Node suites
(including 100 new vendor and 18 new rename checks); all four browser suites
(938 comparison, 110 search, 51 updater, Cisco 3650); public-source audit;
layout tests. Unrun: `updater-windows-tests.cpp` replacement/rollback and
interactive WebView2 on real Windows (CI's Windows job covers the former).

## 5.18.1 supplied canonical icon — published and verified

Release: https://github.com/TechSavage1989/Configuration-Inspector/releases/tag/v5.18.1
Release ID: `425855364`; published 2026-10-27 at 18:48:43 UTC.
Source/tag: `5d2056f5354981dffbe8cf4f93cda794f3bde80a`.
Tree: `d931549e259e462b9f517526b0112341d948c0d6`.
Final review `40562523629` and main release `40563121934` passed all jobs.
Baseline `7e7bd81463f6ac7c6baa8dcffcd4c59c54de7bf4` includes the verified
additive 5.18.0 portable ZIP. Publication was explicitly authorized.

The Library SVG was materialized and its actual rendered pixels inspected before
integration. `webview/icon.svg` preserves its 4,152 bytes and SHA-256
`e9c16716ab14a7936c009e42cd935e1c66b7715ee503d51576c893b035947549`.
See docs/ICONS.md for the canonical source/derivative pipeline. The pinned
build-only renderer generates 512px PNG and nine alpha ICO frames. Both Windows
and Linux builds reject stale artifacts. HTML embedding derives the sidebar
image and single favicon from the SVG; the competing legacy favicon is removed.
Native small/large window icon selection uses the matching resource frame.
The Windows release SVG uses canonical LF bytes, identical to the supplied file.

No parser/search/comparison/updater behavior changed. Other native/updater edits
are release-version literals only. Future releases produce the portable ZIP,
sidecar and complete checksums automatically. All six 5.18.0 asset IDs, sizes,
digests and URLs remain unchanged; no old binary or checksum file was replaced.

Passed: 5,925 Node checks (63 icon checks added), 15 packaging/layout tests,
933 comparison browser, 110 search browser and 44 updater/icon browser checks,
79 compiled Windows icon-resource/image-loading checks, 93 C++ protocol checks,
43 native scheduler and 28 Windows replacement/rollback checks, catalog policy,
version/embed consistency and public-source audit (192 files, 189 text,
66 reviewed fixtures). The actual 16–128px rendered frames and hosted browser
brand screenshot were inspected. Initial review `40562153828` passed browser
checks but exposed a missing <string> include in the new Windows test harness;
the one-line correction passed without weakening any assertion.

All six public downloads match GitHub size/digest metadata and SHA256SUMS.
The ZIP CRCs, allowlisted entries, internal checksums, sidecar and enclosed EXE
identity pass. The actual public EXE is AMD64 Windows GUI, PE version 5.18.1.0;
all nine compiled icon frames match the generated ICO bytes, and its embedded
HTML matches tested source. The public SVG is byte-for-byte the supplied artwork.
The production updater release parser accepts the latest feed and selects only
the raw EXE. The tag points to the tested commit.

- EXE SHA-256: `5f63b1d2f8ce99ed767ce0e4ddee114850445f27b2ffe75487045ad3c94c899e`
- HTML SHA-256: `260a8548c5822d0573ce64d9a20e9961ad248d64de232c764abfe655b44d32bc`
- SVG SHA-256: `e9c16716ab14a7936c009e42cd935e1c66b7715ee503d51576c893b035947549`
- ZIP SHA-256: `c770bf0e1dd355ef2e6b7aacddcc5c57cde2e0f40605787956a54fd60fb84c12`
- ZIP sidecar SHA-256: `a05f919396b21d8c820fdec292e3b8621b9b1b297ad97444386269ae106f719b`
- SHA256SUMS SHA-256: `76fd5290ba5e1f0094bf8026ab14cd95ff9a54420bda11d023da4c3703d048fc`

Unrun: interactive native WebView2/Explorer/taskbar appearance and upgrading a
real installed application. Native Windows tests do validate resource loading at
all nine sizes, but do not inspect a visible desktop or its icon cache. No force
push or access changes occurred. This final handoff is documentation-only and
does not rebuild the published application.

## Portable ZIP packaging — published and verified (5.18.0 additive assets)

Baseline main `951375efe595c0c38e74f2ce2a796c6653f9f8e6`, release 5.18.0.
No application/version/updater changes. `scripts/package_portable.py` builds the
explicit allowlisted ZIP (generic EXE, README, three third-party notices and inner
checksums) with stable metadata and verifies every CRC/hash and EXE identity.
The installed WebView2 runtime is still required; the loader/HTML are embedded.
`build-windows.cmd` creates it before the explicit release checksums.
For an already-published version, `backfill_portable.py` downloads the published
EXE and original manifest, verifies GitHub metadata, and uploads only missing ZIP
and sidecar assets, without --clobber or replacing any original asset.
Future new releases include ZIP and sidecar in SHA256SUMS.
Local checks passed: 12 packaging/publication regressions plus 3 layout guards,
5,862 Node checks, 93 C++ updater protocol checks, catalog policy, version/embed
consistency and public-source audit (185 files, 183 text, 66 reviewed fixtures).
Packaging source/main: `e446c75e47a5cedde98e5e5be52aacbec15b5f19`.
Review run `40559419736` and main run `40559860003` passed all jobs.
Hosted checks also passed 933 comparison, 110 search and 40 updater browser
checks, 43 native scheduler and 28 Windows replacement/rollback checks. The
Windows artifact ZIP was downloaded and its contents/CRCs/checksums/EXE identity
verified. The public backfill contains the original published EXE, not that
newly compiled CI executable. All four original release asset IDs, sizes, digests
and URLs remain unchanged; release/tag source stays `2d52ae4506e89e1ea230376db3de01ba37e181aa`.

Public ZIP: `Config_Inspector_Portable.zip` (664,418 bytes), SHA-256
`4068a6edfbc8db2803eccf6e857e79106fd07ecd8ee3eb44028b118828905269`.
Sidecar: `Config_Inspector_Portable.zip.sha256` (96 bytes), SHA-256
`f75a78be7c59e5a8060997d1389ecc320276000cf6e96d80c1e0e4f53507ff54`.
Both public downloads match metadata; archive CRCs, internal/sidecar hashes and
exact original EXE bytes were checked. The production updater release parser
still selects the unchanged raw EXE with the two additional assets present.
No app version bump, binary replacement, force push or access change occurred.
Interactive Explorer/extraction launch was not run in this cloud environment.

## 5.18.0 published and verified — global configuration search

Release: https://github.com/TechSavage1989/Configuration-Inspector/releases/tag/v5.18.0
Release ID: `425740536`; published 2026-10-27 at 16:53:29 UTC.
Published source/tag: `2d52ae4506e89e1ea230376db3de01ba37e181aa`.
Source tree: `182c7cf495b8eb179d596eae25031429d9f9e657`.
Final review `40544694615` and main release `40545078895` passed all jobs.
Baseline was main `b2bf918d1946d45a0f264bc9d3f11581359ec39e` / release 5.17.4.
The full 106-line user prompt was read and explicit build/publication approval
received before development. No force push or repository access change occurred.

### Design and continuation

- `global_search.js`: literal All/Any terms, quoted phrases, exclusions, case and
  Unicode whole-word options. Searches yield during 32 KiB scan windows, including
  dense/no-match text; cancellation rejects without publishing partial success.
  Query limits are explicit: 2,048 characters, 32 terms, 512 characters per term.
  All non-overlapping occurrences are retained, with no silent result cap.
- `search_documents.js`: indexes all model entries/records/native sections and
  configured findings plus safe displayed source. Numeric original-model indexes
  retain navigation when sensitive identifiers cannot be exposed. Secret values
  and metadata are scrubbed before matching/counting, including copied derived
  values. A single secret over 32 KiB or combined patterns over 128 KiB fails closed
  with explicit conservative-masking notes rather than an unbounded matcher.
- `search_ui.js`: 40 locations per rendered page, all per-location occurrences,
  grouping by category/object, alternate destinations and compact excerpts.
  Source/finding/parsed representations are clearly distinguished. Counts are not
  falsely described as deduplicated underlying source-statement counts.
- Controller session state is independent from local filters. Object, original
  field, native section, source line and finding destinations are revealed with
  matched context and a return path. The previous workspace snapshot includes
  comparison filters, mode, loaded identities and pane scroll positions. Model
  replacement, visibility changes and immediate new input invalidate stale work.
- Native details/summary search options capture live expansion before DOM
  replacement and ignore delayed toggle events from retired elements. Preserve
  this guard: initial review `40543768725` exposed options collapsing on rerender;
  its same failing browser scenarios passed after the focused fix, not a weakened
  test. Initial Windows, existing comparison and exact navigation tests passed.
- The existing comparison loaders, three modes, maps and updater implementation
  are preserved. Native/updater source changes are release-version literals only.

### Validation and coverage limits

Passed: 5,862 Node checks (203 engine, 152 document/redaction, 76 controller and
26 UI checks added), 110 global-search browser checks across four scenarios,
933 comparison browser checks, 40 updater browser checks, 91 C++ protocol checks,
native catalog policy, 43 native Updater scheduler checks, 28 Windows replacement/
rollback checks, 3 layout guards, version/embed consistency and public-source
audit (181 files, 179 text, 66 reviewed fixtures). Browser tests cover exact five
result-type destinations, back state, repeated occurrences, query options, privacy,
lifecycle/context changes and all comparison modes. Engine cases include 6,000
locations / 18,000 hits and 20,000 dense matches. Nine vendor families are covered
by document/model regressions; this is not exhaustive rendered navigation through
every vendor/category combination. Normal and 800x600 screenshots were inspected;
small-window results gain space when options collapse and no outer scroll appears.

Search is active-configuration only. Regex was optional and intentionally omitted;
no unsafe synchronous evaluator or external search service was introduced. Raw
source uses retained, safely displayed text; normalization or unavailable snapshot
source is disclosed. Source lines span all contexts unless proven otherwise; field
source links require verified preserved spans, never guessed field order. Existing
masking may withhold unparsed content. Conservative masking can also hide identical
non-secret text and is disclosed. The app does not infer omitted configuration.

All four public downloads match GitHub sizes/digests. EXE/HTML/icon match SHA256SUMS;
HTML/icon match tested source after newline normalization. The executable is AMD64
Windows GUI, top-level PE version 5.18.0.0. The latest feed passes the production
C++ release parser; the tag points to tested source. 5.17.4 assets remain unchanged.

- EXE SHA-256: `e6d1dfda082e11282b2bc59b4f560e8840b2b90e7046c6fa57ac791fda55d7c7`
- HTML SHA-256: `96295570e8e8976328a6c3f6a1e2661a48fac71d187a66b4cca9c9273c72b787`
- Icon SHA-256: `0b7616221b64418c3f48f5a405f56dc54248aab0e5c44ba69a7dae76e874f1d5`
- SHA256SUMS SHA-256: `8911d23994f517b57ea7c7bea5a7e653abe074ba8928cb4e59869e59f62cba74`

Unrun: full interactive native WebView2, upgrading a real installed application,
and a maximum-size 25 MB end-to-end desktop stress benchmark. The final handoff
is documentation-only and does not rebuild the published executable.

## 5.17.4 published and verified — imported configuration selection

Release: https://github.com/TechSavage1989/Configuration-Inspector/releases/tag/v5.17.4
Release ID: `425071673`; published 2026-10-27 at 05:38:48 UTC.
Published source/tag: `3267bfbc71c5e33859ff68c883434c9c22715488`.
Source tree: `860ef61e31193919aa055e8c240f6bcf513d619f`.
Review run `40456124638` and main release run `40456351393` passed all jobs
on the first attempt. Baseline main was `520f43145a0c41ac8b167be8006dc38c3b872c13`;
the user explicitly approved the correction, hosted checks, main and publication.

Use imported now serves both sides in all three comparison modes, expanded or
collapsed. It reuses imported model references without reopening or reparsing
files, keeps the other input and comparison state, and preserves secret masking.
The picker shows escaped filename/vendor/device identity metadata only. The old
right-only dropdown is removed to avoid duplicate selection controls. Parsed
comparisons retain the same-vendor guard; text can use different-vendor sources.
Replace/paste, clear, swap, maps, navigation and fixed-height scrolling remain.

Provenance: this was not a 5.17.3 deletion. Text mode bypassed the old right-only
selector in 5.17.0; 5.17.1 hid global current-config workspace tabs and placed the
remaining selector inside collapsible loaders. The explicit two-sided picker
restores the selection route without bringing back outer workspace scrolling.

Validation: 5,405 Node checks (69 new imported-selection checks), 933 comparison
browser checks across seven scenarios, 40 updater browser checks, 91 C++ protocol
checks, native catalog policy, 43 native Updater scheduler checks, 28 Windows
replacement/rollback checks, 3 repository-layout guards, version/embed consistency
and public-source audit (172 files, 170 text, 66 reviewed fixtures).
The browser scenario preloads three real parsed workspace models and exercises
both sides/all modes, collapsed/expanded and small-window controls, keyboard
selection, Cancel, filters, clear/reuse, swap, repeated selection, same-model
comparison, unrelated direct-text preservation and secret reveal/hide. Expanded
and all three collapsed-mode screenshots were inspected; no test was weakened.

All four public downloads match GitHub asset sizes/digests. EXE/HTML/icon also
match SHA256SUMS; HTML/icon match reviewed source after newline normalization.
The executable is AMD64 Windows GUI with top-level PE version 5.17.4.0. The tag
points to tested source and the latest feed passes the production C++ updater
parser. 5.17.3 assets remain unchanged. No force push or access change occurred.

- EXE SHA-256: `77c166c76dc9c0efa66608d2f300fbed3c7c8cd17ff985e92395310a60d83b77`
- HTML SHA-256: `9caa570c03625f52e26fdb4e31c163e0e3c9ef66b5064500f07deb9dd5d5264f`
- Icon SHA-256: `0b7616221b64418c3f48f5a405f56dc54248aab0e5c44ba69a7dae76e874f1d5`
- SHA256SUMS SHA-256: `4895683c856c34fb3b5d302562427bb96ec1601362a37aa374bcc2fd553a5570`

Unrun: full interactive native WebView2 and updating a real installed application.
This final documentation-only record does not rebuild the published application.

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
