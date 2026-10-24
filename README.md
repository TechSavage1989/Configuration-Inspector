# Configuration Inspector

Config Inspector opens saved network configurations, organizes useful settings, links related objects, draws interfaces and topology, compares snapshots and reports configuration review findings.

[Download the latest desktop release](https://github.com/TechSavage1989/Configuration-Inspector/releases/latest)

The Windows x64 edition is one portable executable with its interface and icon embedded. It uses the installed Microsoft Edge WebView2 Evergreen Runtime. Imported configurations are analyzed locally. The optional device specification downloader requests public hardware definitions without sending configuration contents.

## Updates

Open App settings, then App updates. The desktop edition checks after startup and every six hours. Choose Download update, then Review install and restart. Automatic checks can be disabled. Later hides the notice for 24 hours.

Updates use this repository's stable GitHub Releases. The downloaded executable must match the release's GitHub SHA-256 digest, size, product identity, architecture and version. A failed download leaves the current executable unchanged. Update checks do not send configuration contents or require GitHub credentials.

During an update, loaded configurations and the comparison are encrypted with Windows DPAPI for the current Windows account, restored after restart and removed from the temporary handoff file. A previous executable is retained for recovery. Installation requires a writable local application folder and closed additional copies of the same executable. The HTML edition provides download links; installation is a desktop capability.

See [UPDATING.md](UPDATING.md) for recovery, storage and trust details.

## Development

This repository is the source of development builds and desktop updates. Source, vendor importers, public example fixtures, tests and the editable icon are included. Private configuration exports and credentials must never be committed.

Use Node.js 20 or later and Python 3. On Windows, install Visual Studio Build Tools with the C++ desktop workload and Windows SDK, then run scripts/build-windows.cmd. This produces dist/Config_Inspector.exe and runs the Windows update replacement and rollback tests. Linux cross-compilation is also supported by webview/build.sh with MinGW-w64.

Run npm ci and npm test for parser, model and presentation regressions. Run npx playwright install chromium and npm run test:browser for the update interface. The standalone C++ protocol suite builds with g++ -std=c++17 tests/update-protocol-tests.cpp.

To publish an update:

1. Change VERSION, run python scripts/version.py and python webview/embed_features.py.
2. Add release notes in releases/VERSION.md and commit the changes to main.
3. GitHub Actions runs the regression, browser and Windows installation tests, builds the executable and publishes the new version only after all checks pass.

Release executable names remain Config_Inspector.exe. Installation preserves the filename and folder chosen by the user. Existing published versions are never overwritten by the workflow; bump VERSION for each update. Standard GitHub source archives provide versioned source downloads. No separate publishing credential or update service is required.

Third party WebView2 and public device catalog license notices are included in webview. The editable application icon is webview/icon.svg.
