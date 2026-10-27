# Canonical application icon

`webview/icon.svg` is the editable source of truth. The user-supplied
Config Inspector Icon(1).svg was retained byte-for-byte for 5.18.1 (SHA-256
`e9c16716ab14a7936c009e42cd935e1c66b7715ee503d51576c893b035947549`).
No visual redesign, raster tracing or generated replacement artwork was used.

After an authorized SVG replacement:

```sh
npm ci --ignore-scripts
node scripts/build-icons.cjs
python3 webview/embed_features.py
node scripts/build-icons.cjs --check
npm test
```

The pinned build-only `@resvg/resvg-js` renderer creates `webview/icon.png`
(512px) and `webview/icon.ico` with 16, 20, 24, 32, 40, 48, 64, 128 and 256px
32-bit alpha frames. `webview/icon-assets.json` records source/output hashes.
System fonts and external resources are not used. Canonical text line endings
are LF; this avoids different embedded SVG bytes on Windows checkouts.

The HTML embed step derives both the sidebar image and the single favicon from
that SVG. The README uses the same source. `app.rc` embeds the generated ICO;
the native window selects suitable small/large frames. Windows Explorer reads
the compiled icon resource. Windows and Linux builds reject stale derived icons.
The Windows build verifies all resource-frame bytes and Windows image loading at
each supported size. Browser checks verify actual image loading and source data.

The release SVG is copied with canonical LF bytes. The portable ZIP contains the
EXE with embedded artwork; it needs no external icon/HTML file. Existing release
binaries are not replaced for icon changes: bump the patch version and publish
a new tested release. Windows may cache old icons for an existing file path;
this is distinct from the verified resource bytes in the new executable.
