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
- Microsoft Visio is stricter than LibreOffice (error 271 on open): document settings are
  elements, FaceName uses `Panose`, Font cells name a declared face, a shape's cells come
  before its sections, cell names must be real Visio cells, and ZIP dates must be valid.
  `tests/diagram-tests.cjs` checks these; LibreOffice also refuses invalid cell values such
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
