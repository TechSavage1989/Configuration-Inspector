# Repository maintenance

Read README.md and docs/PUBLIC_SOURCE_AUDIT.md before changing source or fixtures.

Keep the root limited to the explicit allowlist in scripts/test_repository_layout.py.
Put new guides and handoffs in docs/, automation in scripts/, and regression checks
in tests/. Preserve webview/ build and embedded-resource paths.
Update all consumers and tests together for intentional path moves; preserve archive
entry names, complete editable source, licenses and historical release notes.
Do not commit build output, private configuration backups or client reports.

Run python3 -m unittest discover -s scripts -p "test_*.py" -v and the complete
existing CI checks before promotion. New root entries require an intentional review
of the allowlist and a reason in the change description; never relax it to a glob.
Rebase older feature branches on current main and rerun checks after integration.
Organization changes do not authorize version bumps, releases, tag/asset replacement
or repository access changes.

Owner's standing instruction (2026-11-04): the owner does not use GitHub directly.
For user-visible changes, agents open the pull request, merge it once all checks
are green, and release it (bump `VERSION`, add `docs/releases/VERSION.md`, merge to
`main`) without asking, then verify the published assets. Never replace an
existing release or its assets. Preserve the polished README layout.

Owner's standing instructions (2026-11-07): never ask permission for routine work; merge when all
checks are green and release without waiting. Make anything the owner must see impossible to miss,
as a bold line at the top of the message: **🚀 PUBLISHED: Config Inspector X.Y.Z is live** when a
release is out (with the link and what to check), and **⚠️ ACTION NEEDED: ...** whenever input,
a decision or a test on the owner's own machine (for example opening an export in Visio) is needed.

## Gotchas

- The Network diagram is TURNED OFF in releases (owner decision, 5.69.0: not working as intended yet). Keep its code
  and tests whole: `DIAGRAM_ON` in index.html hides the sidebar item and sends the `diagram` view to the Site map;
  `?labs=diagram` (or "diagram" in localStorage `config-inspector-labs`) turns it on, and the diagram browser tests
  load the page that way. Its user documentation lives in `docs/network-diagram.md`, not the README, until it is
  turned back on (v5.68.0 is the last release with it on). The diagram gotchas below still apply to that code.
- Site overview link checks (`SWSiteOverview.linkChecks(models, links, {key, isSwitch})` in site_overview.js) compare
  both ends of each link from `siteMapModel()` whose devices are both open: native VLAN, tagged VLANs (an end that
  allows all is skipped), trunk/LAG on one end, LAG member counts, and the spanning-tree root by configured priority
  (AOS-Switch steps 0-15 are multiplied by 4096). A member port inherits its aggregate's VLANs when it lists none.
- CLI dialects with Cisco-like interface names (Arista EOS, Huawei VRP) must be
  detected in `detectSwitchCLI` before the Cisco pattern, or they are labeled
  Cisco. A new vendor id must also be added to every vendor list in
  `webview/index.html`, `features.js`, `network.js` and `review.js`; grep for
  `aruba-instant-on|cisco` to find them.
- `tests/mikrotik-tests.cjs` compares every fixture with the 5.13.0 baseline;
  only fixtures that now detect as a dialect added later may skip that vendor
  check.
- The GitHub releases API allows 60 unauthenticated requests per hour per IP,
  shared by every copy on a network. Keep automatic update polling infrequent.
- Pages that stack several panels must be excluded from the `list-view` layout
  (the view list in `renderContent`), or every panel collapses to one screen.
- The detailed network map renderer already has a `collapsed` variable in scope;
  shadowing it breaks every import. Browser tests catch this, `npm test` does not.
- Network diagrams (`webview/diagram.js`) must stay editable in Visio: write plain shapes,
  except vendor stencils the user imports (`webview/stencils.js`), which are written as
  masters with instances; check generated .vsdx files open in LibreOffice. Never commit
  vendor stencils or their artwork: build test stencils in the test (`tests/stencil-tests.cjs`).
- Diagrams must try to fit a letter sheet (owner request): `diagram()` picks the row width
  whose measured size needs the least shrinking (`fitLetter`), and every download goes
  through `onLetter()` (Visio pages, SVG and printable HTML are 11 x 8.5 in or 8.5 x 11 in).
- `.vss` stencils (Visio 2003-2010, OLE compound files) are read natively by `readVSS()` in
  `stencils.js` (format notes from libvisio); masters get synthesized master XML for
  Visio export. Test with the fictional builder `vss()` in `tests/stencil-writer.cjs`.
- Microsoft Visio is stricter than LibreOffice (error 271 on open): document settings are
  elements, FaceName uses `Panose`, Font cells name a declared face, a shape's cells come
  before its sections, cell names must be real Visio cells, and ZIP dates must be valid.
  The document must end with a `DocumentSheet` ("TheDoc") after `StyleSheets`, or Visio
  reports error 271 while LibreOffice opens it fine. Keep the package in the form of NetworkDiagramStudio's
  current writer (Visio opens those on the owner's machine): content types first, `visio/windows.xml`,
  `docProps/custom.xml` RecalcDocument, LineWeight with `U="PT"` and a point formula, absolute
  geometry rows, page rels only for masters used; outputs must pass its `check-visio-package.py`. `tests/diagram-tests.cjs` checks these; LibreOffice also refuses invalid cell values such
  as `FillForegnd="none"` (write a cell only when it has a real value).
- Neighbor ports from monitoring exports can be wrong; `correctLinkPort()` in index.html
  swaps in the port that the far end's description names when link state agrees.
- Device names and IPv4 addresses in tables and detail rows become `.entity-link`
  buttons after each render (`linkifyEntities`); exclude new large text views in
  `ENTITY_SKIP` or the skipped view list if they should stay plain.
- Diagram routing rules (owner request), checked by `routing()` in `tests/diagram-tests.cjs`:
  links end on port centers, entering top-row ports from above and bottom-row ports from
  below through the device's label band; they go around devices and never share a
  collinear stretch (crossings hop). The router (`Router` in `diagram.js`) works on a 9 px
  grid: keep device, port and endpoint geometry on that grid or stubs miss their nodes.
  A relaxed route (`strict:false`) means the layout ran out of room; widen the channel
  or corridor that is short instead of accepting the overlap.
- Diagram faceplates come from the verified hardware profiles in `webview/hardware.js` (the
  same layouts and model choice as Interfaces at a glance): `diagramHardware()` in index.html
  passes `node.hw` ({members, portOf}) and `Device.fromProfile` draws each bank with its
  connector (RJ45 taller than wide, SFP/QSFP cages) and real port numbers. Add new models to
  hardware.js, not to the diagram; `tests/diagram-tests.cjs` draws every profile. The
  `CATALOG` in diagram.js is only the fallback for models without a profile.
- Device drawings are shared with NetworkDiagramStudio (owner request: one set of designs for both apps).
  `webview/nds_faceplates.js` is GENERATED by `python3 scripts/sync-nds-faceplates.py <NDS checkout>` from
  NDS's `src/web` (faceplate library and renderer); never edit it by hand: change drawings in NDS and run the
  script again (`--check` compares). `ndsArt()` in diagram.js uses an NDS panel for a plate (switch, stack
  member, chassis module) only when every port of the profile resolves to an NDS jack (`ndsResolve`) and the
  drawing's rows give each port its own routing column (`artRows`: upper/lower jack of each column, at most two
  per column); otherwise the classic drawing stays. Panels keep NDS's proportions (`artW` = height x ratio;
  72 px tall, 60 px under a module card's title) and are written as plain rect/text shapes (Visio stays
  editable). Ports sit at NDS jacks (`slot.ex` exact, `slot.dx` on the grid); `artPoint` gives plate-relative
  points to the stack and chassis planners. Used ports get a link-colour ring or their module over the jack,
  port maps a numbered role square (`drawArt`). Imported vendor stencils still win.
- A chassis NDS draws whole (5400R zl2 J9850A/J9851A and J9821A/J9822A, 5400zl J8697A/J8698A) is cut from NDS's
  own chassis panel (`ndsChassisLayout`): NDS sizes jacks to the whole chassis (`consistentSockets` uses the
  panel width), so a module drawn on its own gets half-size jacks; never draw chassis modules standalone. Each
  slot plate (`pl.crop`) gets the shapes inside its slot rectangle (NDS's slot geometry, module cards 72 px tall),
  the chassis body/side bar/model text (`d.grid.bg`) are drawn around them, and lanes widen the gutter between
  the module columns (left column) or the right edge (right column) via `chassisWiden`, never the modules.
  Port maps number a module's ports 1..n (slot letter stripped). The planner puts a module's steps on the side
  of its port row with more room (above the row on NDS modules) so they stay >= 6 px apart; rows compare with a
  2 px tolerance (`rows()` are rounded).
- Documentation pages (`docPages` in diagram.js: port map, wireless connections, VLANs and
  routing, trunk VLANs) are letter-sized (`p.doc`, drawn at full size by `fitLetter`) and built
  from `input.docs` (`diagramDocs` in index.html). Visio page names must be unique.
- `site_map.js` layout keeps its own copies of devices in `layout.nodes`; anything added to
  devices for the diagram (such as `hw`) must be set on `layout.nodes` too, or the diagram
  silently falls back to the catalog faceplate.
- Stencil port mapping for profiled devices uses `edgePorts`/`bankLayout` (stencils.js): ports
  are read per level of connection points (cages often sit lower than jacks and carry two
  points, one per edge). Stencil product properties (`NetZoomMfgProdNo`, `NetZoomMfgDesc`)
  outrank the shape name when matching.
- Keep work off the launch path: stored stencils load after the first paint, one file at a
  time, from their cached parsed form (`parsedTag` = app version) in IndexedDB; stencil
  matching prefilters shapes by model number (`mayMatch`); imported interfaces are looked
  up through `portIndex`, not by scanning every set. Large libraries (thousands of shapes)
  and monitoring exports otherwise freeze the window for seconds.
- Diagram hand edits are keyed by stable names (device keys, `epKey`, `lineKey`, `tkey`,
  `device|short(port)`); keep those names stable when changing render(), or saved edits stop
  applying. Listeners added in the main UI script before its first click listener must use
  `onDoc` (the node harness slices the script there and has no addEventListener).
- Site links come from `siteMapModel()`: imported links, then `configLinks()` (described
  ports, default gateways) where no imported link joins the pair, WAN circuits (`wan:` keys,
  role `circuit`), and `siteEdits()` (hand-added devices and links, removed link ids from
  `linkId`). Undo/redo (`pushUndo`, `swapEdit`) covers both diagram and site edits. Imported neighbours on
  logical interfaces (VLAN, VLANIF, IRB, BVI, loopback, tunnel: `LOGICAL`) are routing neighbours, not cables,
  and are dropped; a switch port reported against a firewall's data port and its HA/management port keeps the
  data port (owner's HA site).
- "Device and below" (`scope()` in diagram.js) takes every device cabled to a device from a lower tier, not
  only its tree children: a core cabled to both firewalls of an HA pair is below each (the tree files it under
  one, so the other firewall's diagram was empty). `tests/diagram-tests.cjs` checks an HA pair.
- Stencil matching never picks another generation of a series automatically (FG-120/121F for a
  FortiGate-120G has other ports; `generationDiffers` in stencils.js) and prefers front views
  over rear views.
- The diagram opens on the selected configuration's device; `state.diagram.focusModel`
  tracks which configuration that was, so choose a new focus whenever it changes.
- Supplementary data (`webview/evidence.js` parsing, `webview/site_map.js` layout) is
  joined with configurations in `index.html` (`liveFor`, `evidenceOwner`). Never commit
  real monitoring exports or command output: build test data with `tests/xlsx-writer.cjs`
  and documentation addresses (192.0.2.x, 10.x, 00:00:5e:00:53:xx MACs).
- Auvik uses placeholder port names ("Some Interface", "Wired Interface"); treat them as
  unknown ports, and keep `open` checks as `>=0` (`-1` means no open configuration).
- Pages that scroll as a whole must not contain vertical scroll areas (nested scrollbars
  trap the mouse wheel). Split long content into tabs or "Show more" instead; the
  supplementary and site overview browser tests check this. Exception:
  the Site map device panel is a sticky side column that scrolls by itself (owner request).
- Headers are pinned by `pinHeaders()` after every `renderContent()` on pages that scroll
  as a whole: page bars (`PAGE_BARS`), each panel's `.panel-head`/`.toolbar`, then `thead`.
  Panels there use `overflow:clip` (not `hidden`) so sticky works; don't add
  `overflow:hidden/auto` around new tables without a real scroll need. Node tests that
  copy `renderContent` must stub `pinHeaders`.
- Diagram editor gestures (`editDrag` kinds `move`, `box`, `port`, `corner`, `line`) snap to
  the same route and tidy it with `routeTidy()`; re-render edits with `renderKeepingView()`
  so the zoom and scroll stay, and keep the auto-fit key free of edits (`cur.baseKey`).
- Elements that use `display:flex` (such as `.site-link-row`) override the `hidden`
  attribute unless a `[hidden]` rule for them exists; check filters with `:visible`.
- The owner's reference drawing (a Visio core page with a left legend column, thin links colored
  by media, accent-bar boxes for handoffs, green AP summary boxes, and numbered role squares on
  port maps) sets the diagram style; keep new drawing work consistent with it. Links avoid
  crossings whenever any route does (strict re-route pass), even at the cost of more bends.
- Link types are kinds by media and speed (`linkKind`/`kindStyle` in diagram.js); never color a
  link from a fixed type list. Owner-edited colors and names (`view.linkStyles`) must reach both the
  lines and the legend. Text must fit its box (`fitTexts`); grow boxes rather than clipping edits.
- Stencil port points: exact group mapping (`bankLayout`) first, then `fitPorts` (in-order column
  matching); keep hand edits rare by improving these, not by adding per-model offsets.
- Hardware packs carry parsed stencil masters (not the stencil files); keep master fields JSON
  friendly (no Maps or DOM nodes) and keep `m.file` as the original file name so choices and
  port points (keyed by `masterKey`) apply to pack shapes.
- Hardware packs use NetworkDiagramStudio's format (owner request: one file for both apps):
  `{format:'NDS-hardware',schema:1,stencils:[{id,name,models,view,dataUrl,width,height,anchors}],optics}`
  with this app's masters, points and choices in `configInspector` (NDS ignores it). Anchors are
  port names to [x, y] fractions from the top left (`stencilAnchors`); NDS-only shapes import as
  picture masters (`SWStencils.fromImage`) placed by anchor name (`anchorAt`). Saved packs must pass
  NDS's `cleanStencil` checks (mirrored in `tests/supplementary-browser.cjs`). Never commit a real pack.
  Visio master IDs must be numbers: `masterParts` renumbers every master (NDS ids such as `art-...`
  left in masters.xml make Visio draw the instances empty while LibreOffice still shows them).
- Links use right angles and as few bends as possible (owner request): keep endpoint widths a
  multiple of 18 (`EP_W`) so centers stay on the grid; `tests/diagram-tests.cjs` allows at most
  two bends on access point links.
- Default diagram view (owner request): the selected device and configured devices below it plus
  WAN circuits; access points, other devices and unconfigured switches only via Show. Link type
  style (color, name, width, dash) is shared by legend and lines through `kindStyle`.
- The diagram runs from the WAN down (owner request): circuits sit above their device even on a
  bottom-row port; `tests/diagram-tests.cjs` checks it with routing rules. Circuits that do not fit side by
  side stack in rows (NDS style: `e.row`, `d.topRows`, `epY` adds the row; one box fewer per row than fit, for link
  room); a circuit row may use the widest device's width (`colW`), so circuits sit in one row whenever that fits
  (owner request: as little space as possible). Plain boxes are as wide as their text (`epLines` wraps a long name on
  two lines; `EP_W` from `textW` of the name and "port | address" lines). A circuit on a bottom-row port goes to the
  row end on its port's side (`e.end`, the port farther from the edge on the outer box, so the loops nest), and the
  device keeps one lane per loop beside it (`d.loopsL`/`d.loopsR`, outside the `wanShun` area). Circuit links pay
  extra outside the device's column (`router.wanShun`, cost for `router.free` nets) so they stay within the primary
  vertical stack. Only the links
  of circuits stacked higher may pass a lower circuit (the tests' "nothing above a circuit" rule).
  No line passes above a circuit when any route avoids it (`router.shun`), and circuit links may
  cross other links (`router.free`) rather than loop around them.
- Line hops are true arcs: a drawn line carries `arcs` ({point index: bow px}); SVG samples them
  (`linePoints`), Visio writes `ArcTo` rows whose `A` bows upward (`VBOW`, checked against LibreOffice
  renders). Scale `arcs` with the points (`onLetter`). Lines spread out through `router.near`
  (cost `NEAR` within `NEAR_R` cells of other lines); the A* estimate is weighted (`HW`) to keep that fast.
- Dropdowns are in-app (owner request): the `ui-pickers` script at the end of index.html opens a styled
  menu for every `<select>` and every `input[list]` (it moves `list` to `data-pick-list` so the native
  popup never shows) and floats one clear button over text boxes. Inside an open modal `<dialog>` both
  must live in that dialog (`host()`), or the dialog makes them inert. Tests may still `selectOption`.
- Port modules (owner request): cage ports in use draw the module from `moduleFor()` (link type cable
  and speed, or `linkStyles[kind].module`), listed in the legend's PORT MODULES; keep `MODULES` names in
  step with the Link type dialog's Port module choices.
  Stencil devices draw the module in each cage too (sized to the port pitch), and NDS pack optics
  (`ndsOptics`, `diagramModuleArt` -> `view.moduleArt`) replace the drawn module with their artwork.
- The updater UI (`updateCardBody`, `updateWhatsNew`, `updateTransfer` in index.html) renders release
  notes through `updateNotesHTML` (escaped first; bullets, headings, bold, code only).
- Diagrams must work with any network (owner request): `tests/diagram-variety-tests.cjs` draws eleven
  fictional designs (stacks, HA pairs, many circuits, no firewall, wide and deep trees, rings, 25-100G,
  unknown hardware and port names, NDS shapes) in every scope and style, and `diagram-vendors-browser.cjs`
  runs every vendor fixture through every page tab and download. Add a design there when a new layout
  problem turns up. Link kinds: an RJ45 end with no media is copper; AOC is its own kind (`aoc`).
- Access points and other endpoints stay within their device's left and right edges when they fit
  (owner request); shrink the row gap before letting a row run past, and center rows that cannot fit.
- Link editing follows NetworkDiagramStudio (owner request): `state.lineSel` {key, pt} selects a link and
  bend; `drawLineHandles` draws bend squares, port-end dots and + buttons (redrawn by
  `markDiagramSelection` after every render); `routeBump` adds bends, `routeRemoveBend` removes the
  shortest run that keeps right angles and port directions; `snapTargets`/`snapGuides` snap to other
  links and device edges (Alt off); `showBendPoints` edits points as numbers. Checked by
  `tests/diagram-lines-browser.cjs`.
- Stacks (owner request): a stack is ONE grid device, members in one column (`diagramHardware` gives `hw.grid`
  with `stack:true`; `diagram()` adds one for any hw with several profiled members and no grid). Never split
  a stack into member devices. No line runs across a member's face: a link leaves a top-row port upward and
  a bottom-row port downward into the gap on that side, runs along the gap (tracks 6 px apart) to the side of
  the stack, then along a side lane (two grid steps apart, room for port labels) to the stack's edge
  (`t.slot.gy`, `t.slot.lane`, `geo().via`). Only member 1's top-row and the last member's bottom-row links
  go straight out. Each gap of a stack is only as tall as its own lines need (at least 9 px;
  `d.grid.gaps[r]`, owner request: as small as possible; pads above the first and below the last member when
  needed), and `d.sideL`/`d.sideR`
  widen the stack's cell for its lanes. Track and lane order (from-above lines on upper tracks, lower origins
  on outer lanes going up) keeps the lines from crossing each other; `faces()` in
  `tests/diagram-variety-tests.cjs` checks it. Stack links (`stack:true`, kind `stack-vsf`, from `hw.links`:
  VSF link 2 to the next member's link 1, three or more close a ring) are `c.internal`: straight across the
  gap between neighbours, otherwise (`c.ring`) through their gaps and along a lane 4 px from the stack on the
  side with fewer links. Each member's number and model sit inside its role block. Box style keeps one box.
- Chassis leaders (owner request: clearly apart, none crossing): planned per module column and edge in render.
  A link from the last full module before its edge drops straight out; any other takes one step beside its port
  (`t.slot.gy`: between the port rows, or between its row and the module edge) to its own lane in the module's
  right margin (`t.slot.lane`, 18 px apart; module titles sit top-left, so never use the left margin for lanes
  that pass other modules). Steps are staircased (rightmost port nearest its row) and lanes ordered by the step's
  distance to the edge (nearest innermost), which keeps every step clear of other links. Ports move left inside
  their module when the margin is short; modules widen (`d.grid.cw`) only when that is not enough, and terminals
  are re-read from their ports afterwards. Names and model lines go between the lanes (`gapsOf` uses `lane`;
  `fit()` runs after the lanes and never widens a grid device; a model line with no room goes beside the name).
- Lines never lie on one another (owner request: parallel lines in perfect alignment are confusing): the
  router keeps routed stretches apart, and everything drawn outside it must too: chassis leader steps and lanes,
  stack gap tracks and side lanes are one per line. `tests/diagram-hardware-browser.cjs` checks every drawn route (`data-route`) for shared stretches and for
  crossings inside the chassis.
- Hardware from ports (owner request: no blank faceplates): `portsModel()` in hardware.js names the model
  when a configuration names none and only one model has its interface set (C9500-24Y4C/48Y4C,
  CRS326-24S+2Q+RM; `inv.inferred`), or gives a family layout (`uncertain`) when several share it
  (3560E 48-port, CX 6000/6100 12G). Add a signature there, never a guess from a partial port list.
  Cisco `TenGigabitEthernet0/N` looks up `teN` first (3560E X2 slots alias `te1`/`te2`).
- Modular chassis (5400R zl2 and others listing `module X type ...`): `diagramHardware` returns
  `hw.chassis` with one member per slot. For a known front panel (`SWHardware.chassis(model)`: MM1/MM2
  then slots two across) it also gives `hw.grid` and members carry `row`/`col`, empty slots and MM2 as
  blanks (`empty`). `fromProfile` lays a grid chassis out as ONE device (owner request: edge to edge as
  built): cards one width, 9 px apart (`dev.grid`, `plate.y`); `place()` adds `plate.y` and picks the
  nearer edge (`side`); leaders (`t.slot.lane`, `geo().via`) run across the face to that edge, moved into
  column gaps when a linked port or another leader is in the way (lanes on one edge >= 14 px apart for
  labels). Do not split a chassis into separate devices (the router would add channels between rows).
  Stack members carry `model` too, so mixed stacks name each member's own model.
- Links from configurations (`configLinks` in index.html): only the closest name matches count, LAG
  members are expanded on both ends (`members`, `lagOf`) and paired in port order, and a far end that
  names no device uses its uplink ports (`uplinks`) only when the counts match. Keep the "paired in
  port order" note in `why`; configurations cannot prove which cable joins which port.
- Port map pages draw the role legend through `Flow.onPage` (every page), not after the plates; the
  model goes right after the heading (`heading()` in portMapPages). Stacks are compact (a bar per member:
  "Member N | model | ports" from `summary()`); a grid chassis is drawn whole, scaled to fit the page. Trunk VLAN tables share one Flow
  with a heading per column group.
- Spacing (owner request: no open space): `diagram()` re-renders plate diagrams with `view.chanCap` from
  `chanCaps(page, dense)`, trying the levels the routes use (dense 1), halfway (0.5), then their span (0),
  and keeps the first that adds no relaxed route, hop, bend or length; caps come from the drawing without
  edits. A device side with no port labels gets a `G*2` band (`bandFor`). `NEAR_R` (3) keeps lines one or
  two tracks apart; a larger radius made lines bend to keep away from each other (owner: fewest bends).
- Neat channels (owner request: consistent spacing): after routing, the horizontal runs in each channel between
  device rows (`gaps`, edges included; only a line's port ends stay put) move to evenly spaced tracks, 18 px apart
  when there is room, centered, in the router's order (a monotone remap, so no crossing or overlap is added).
- No loops into the page header (owner request): the strip above the top row is `router.shun(...,2)`, paid
  only by lines whose stubs start below it (`router.hdrOk`). A crossing re-route is kept only when it is at
  most half as long again and adds at most two bends (`BEND` is 90).
- Fit to drawing (owner request, the app default as in Visio): `PAPERS.fit`; `fitLetter` returns the
  drawing's own size at scale 1 (raw still rates layouts against 17 x 11 in), `splitDiagram` never splits,
  doc pages stay letter-sized. index.html `applyPaper` defaults to `{key:'fit'}`; the library default
  stays letter. Printable sections and SVG take each page's own size (`@page pN`).
- Devices list: rows keep `.diagram-choose-row` and `data-diagram-device` (now on × / Add buttons with
  `data-device-act`) so search, filters and bulk buttons work; `[data-diagram-clear]` clears all but the
  focus. Page device keys of stack members and chassis cards end in `#id`; strip it when matching nodes.
- Paper sizes (owner request): `setPaper({key,orient})` in diagram.js sets the sheet (`PAPERS`), and
  `fitLetter`/`onLetter` fit every page to it (letter keeps the letter/A4 shared area and never scales up;
  larger sheets scale small drawings up to 2x via `paperInfo().maxScale`). `DOC_W`/`DOC_H` follow the
  sheet. index.html stores it in `config-inspector-paper` (`applyPaper` before every build; part of the
  cache key) and the printable HTML uses its size.
- Diagram editor drags go through `dragPoint()` (Shift locks to one axis); link type speed and cable
  type live in `kindStyle()` with the rest of the style, so legend and lines stay in step.
- Label bands are per device (`d.bt`/`d.bb`, from `bandFor`); never use the `BAND` constant for
  plate geometry. A split diagram's first page must keep every device below the focus.
- Neighbor port corrections (`correctLinkPort`) apply to the diagram and to `liveFor()` neighbors;
  keep both in step.
- Device details are stacked with the device (owner request): name above the faceplate, model
  and address below (`HEAD`/`FOOT` inside `dev.h`, `drawHeader`, `fitHeader`). Don't bring back
  a side label column; keep port `py` offsets including `HEAD`.
- Messages (`toast`) are a popover in the top layer so they show over dialogs; don't move
  `#toast` back into normal flow.
- Device sizes (owner request, like NDS's device scale): edits `scale[key]` and `scaleAll`. `render()` scales a
  device after its planners and `fit()` (`d.s`; unscaled values in `d.u` and each slot's `u`) and draws it unscaled
  through `unscaled()`, then `scaleShapes()`. Code that reads device-relative geometry after that step gets scaled
  values; drawing code gets unscaled ones. Linked ports stay at least a grid step apart (the size is clamped).
- Pages by hand (owner request): edits `pages[key]=n` (2, 3, ... with no gaps) and `pageRows[n]`; `diagram()` with
  `o.page` keeps that page's devices, and every link between pages ends at an off-page reference on both pages
  (role `offpage`: an endpoint on faceplates, an `off:<key>` box with `ref:true` on box pages). Those pages follow
  the main page in tabs and downloads and are edited with the same edits (each device is on one page).
- Editor selection (owner request): Shift/Ctrl-click adds on press and removes on release without a move, so a
  Shift-drag still moves the selection; Shift locks to the axis the first few pixels chose (`d.axis`). A click that
  selects must refresh the edit bar (`renderContentBar`).
- Port maps (owner request: the sheet layout of the owner's switchport diagram builder, but the app's own
  faceplates, never the builder's squares): `portMapPages` draws one sheet per device with `drawPlate` (NDS panels,
  NDS chassis, stencils, classic plates) and `fills` entries `{vlan:true,...}` that `vlanMark` draws on each jack:
  native VLAN fill (`vlanColors`, one colour per VLAN on every sheet), tagged dots, voice diamond, trunk outline
  (`TRUNK_COLORS`), black stack ports (`hw.links`). The port table lives on separate `inventoryPages` (page choice
  `inventory`). Sheets use `sheetPage`; `Flow.make` builds custom pages; `portPos` already includes the group's x.
- Ports the data does not name: a link with an empty port ends on its own point on the device edge (`slot.unknown`,
  label "port ?"), never on `dev.slot('')`. `siteMapModel` first fills an empty far port from the far device's
  interface alias that the near port's description names (one match only, not already used).
- Stack ring cables (internal, not straight drops) choose their sides together (`rings`, every assignment for up to
  10 cables) by the fewest crossings with each other and with side links; on a side the shorter span takes the inner
  lane. Watch `var` names in the stack planner: it shares one function scope (`n` is the member count).
- Shortest paths (owner request: no climbing over a device only to come back down): `diagram()` re-renders with
  `view.sides` (per `device|port>far` key) when a stack's or chassis' cheapest edge, judged from the drawn geometry
  (moves included), differs from the row-based one; `o.rowSides` turns it off for tests. The header strip is measured
  from the topmost drawn device, not row 0, so moved layouts keep the space above them usable.
- Doc page tabs: pages whose titles differ only by " (n)" or " (continued)" are one tab that scrolls through them
  (`docGroups`/`stackPages` in index.html; "Visio page" exports `shown.stack`); wireless pages keep numbered tabs.
- Port inventory rows group consecutive ports with identical settings ("1/1-49 (49)"); keep every cell single-line
  (an unknown admin state shows only the link counts), or the pages multiply again.
- Side exits (owner request: no loops over or under a stack moved beside the device it joins): `view.sides` may give a
  stack terminal 'left'/'right' (chosen with top/bottom by the shortest-path pass; chassis keep top/bottom). Such a
  terminal has `t.exit`, keeps `t.side` = its row's direction, gets a gap track (`gy`) but no side lane, and `geo()`
  starts its route beside the stack at the gap height heading out (`exitY`; the first routed run is moved from the
  grid row onto `exitY`, `sideEntry` puts its label beside the stack).
- Full-window layout (owner request): `main` has no max-width; the diagram view (`main.diagram-main`) hides the file
  notice and source row, keeps one row of page tabs (scrolling sideways), a slim title bar and an edit bar whose arrange
  and line bars sit inline, so the drawing gets most of the height.
- Side entry (owner request): after routing, a stack link whose route passes beside the stack at its member's gap height
  leaves the gap straight out sideways (or with one turn to a horizontal run of its route) instead of using the side lane
  to the top or bottom edge; kept only when shorter with no added crossing or overlap; `g.sideEntry` moves the port
  label beside the stack. Hand-moved links take their labels along (`follow` in the label pass).
- Layout choice with Fit to drawing: the smallest square (`max(w,h)`) plus 40 per hop, 40 per bend and 0.5 per px of
  link (`rate` in `diagram()`); fixed sheets keep the largest print. Tidy links (`o.tidy`/`edits.tidy`, the edit
  bar's button) routes in `view.routeOrder` 0-3 and keeps the cleanest drawing.
- No pointless jogs: a cleanup pass after the side entry removes a short step (<= 4 grid steps) between two runs going
  the same way, either orientation and every style, when that adds no crossing or overlap and the two changed
  stretches pass no device (`vClear`, `boxHit`); jogs that avoid a crossing stay. Chassis leader steps on one module
  never share a height (`byPl` pass), whatever edge their links leave by; zones join rows within 2 px.
- Unknown ports end on a dashed "?" jack drawn at the edge point. Port map sheets put Trunks / LAGs and Port
  descriptions under the VLAN key when they do not fit under the ports (`GX`/`GW`/`GP`); faceplates shrink for them
  only when neither place has room. Member bars are 13 px with 3 px between members.
- VLANs and routing lists each address once: VLAN interfaces in the VLANs table, routed ports in the port inventory
  (when it is on), the rest under "Other routed interfaces".
- Endpoint fans (owner request: no needless bends or crossings): after routing, a device's links to its row of
  endpoints are rebuilt as Z shapes in the band between them (`fan` pass after `straightenEnd`); the track order is a
  search over the pairwise cost `W` (line i nearer the device than line j), kept only when it adds no crossing, bend
  or overlap (`clash`, `bendsOf`, `clearRun`). Endpoint rows then shift a few grid steps (a small DP over the row) so no
  box's link lines up end to end with another link's port column; a box straight over its own port never moves.
  `tests/diagram-variety-tests.cjs` checks right angles on every line (an NDS chassis lane must be `snap`ped against
  its own plate's x, not the column's first plate) and AP fans on a middle stack member.
- Keep one design language: side panels use `.side-panel-body` with `.device-info-row`
  label/value rows, details drawers use `.detail-summary`/`.detail-cell`, and lists in
  narrow panels are rows (`.site-link-row`), never multi-column tables.
- `index.html` embeds the `webview/*.js` modules; run
  `python3 webview/embed_features.py` after editing them (CI fails on drift).

## Repository standards (all contributors and AI tools)

This repository follows the shared TechSavage1989 standard in [`docs/REPOSITORY_STANDARDS.md`](docs/REPOSITORY_STANDARDS.md), the same file in every app repository. Read it before changing anything. In short:

- **README:** centered header (real icon, one `<h1>`, tagline, quick links Download · Get started · Features · Screenshots · Updates · Development, hero image), then the standard section order. Update it in the same pull request as any user-visible change.
- **Screenshots:** real captures with fictional data in `docs/images/` (`hero.png` + kebab-case names). Recapture any screenshot a UI change makes stale, in the same pull request.
- **Layout:** compact root; respect the root allowlist and checks above. Never commit build output, binaries, archives, logs, caches or secrets.
- **Branches:** short-lived `feat/` `fix/` `docs/` `chore/` `release/` branches, one focused change per pull request, merge only on green checks, delete the branch after merging.
- **Instructions:** this file is the single source of project rules for every tool; `CLAUDE.md` imports it. Add new rules and gotchas here.

Where this file's project-specific rules differ from the shared standard, this file wins; an enforced check script wins over both.
