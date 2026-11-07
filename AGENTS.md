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
  `linkId`). Undo/redo (`pushUndo`, `swapEdit`) covers both diagram and site edits.
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
  bottom-row port; `tests/diagram-tests.cjs` checks it with routing rules.
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
