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
or repository access changes. Preserve the polished README layout.

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
