# Desktop updates

## Update flow

App settings contains automatic checks, a manual check, download progress, release notes and a final Install and restart action. Checks occur about 15 seconds after the interface is ready and every five minutes thereafter while the app is open. Temporary failures retry after 30 seconds, two minutes and then increasing intervals up to six hours. Help → Check for updates opens the update section and starts a manual check; it also works when no settings dialog is open. Requests made while the interface is loading are delivered once it is ready. A manual check bypasses the 24-hour Later reminder delay without changing the automatic-check preference. Later applies only to the version shown, so a subsequent newer release can still appear. Old, unscoped reminder delays cannot identify a release and are not carried forward to hide a newer one. Nothing is automatically downloaded or restarted.

The update feed is https://api.github.com/repos/TechSavage1989/Configuration-Inspector/releases/latest. Only stable vMAJOR.MINOR.PATCH releases with Config_Inspector.exe are accepted. Config_Inspector_Portable.zip and its checksum are manual-download conveniences and are never selected by the updater. Asset URLs must point to this repository and tag. Redirects are restricted to GitHub's HTTPS download hosts. Windows validates TLS certificates. GitHub credentials are never requested, stored or sent by the app.

The executable's byte count and SHA-256 must match GitHub's release asset metadata. Its PE architecture must be Windows x64 and its product and file version must match Config Inspector and the advertised version. SHA-256 detects corruption and mismatched artifacts. It does not protect against a compromised GitHub publisher. These builds are not Authenticode signed. SHA256SUMS is supplied for independent download checks.

## Installation and recovery

The existing executable is copied to a helper under the selected app data folder. The helper verifies its own identity, the running app, the staged executable and a random transaction token. It opens the original process handle before acknowledging readiness. The original window stays open if that handshake fails.

After the original process exits, the helper copies the verified update beside the target and uses Windows ReplaceFile to replace it while retaining the old executable. This also supports an app data folder on another local drive. The executable's original filename and working directory are retained. Installation does not request elevation or install services or scheduled tasks. Move the app to a writable folder if its installation folder cannot be updated.

The new window restores the encrypted workspace before signalling successful startup. If the process exits or does not finish opening within 90 seconds, the helper attempts to restore and reopen the previous executable with the workspace. If permissions, locks or storage failures prevent recovery, the old executable and transaction information are retained for manual recovery. A downloaded update never replaces a running app without the final install action.

Open App settings to find the current app data folder. Updates are stored in Updates/INSTALLATION-ID within it. Each installation has a separate cache based on its executable path. The previous.exe file and previous.json retain the immediately previous executable and original installation path. Close all app copies before copying previous.exe back to that path. Do not run it from inside the cache folder. If transfer of the backup failed, result.txt identifies the situation and a .config-inspector-previous-TOKEN.exe backup remains beside the application. Preserve settings and backup files until recovery is complete.

Transactions retain their plan, helper and result.txt for troubleshooting. Successful restoration deletes workspace.bin. It is encrypted with Windows DPAPI and can only be restored under the same Windows account. Interrupted transactions can retain the encrypted file. Delete stored data in App settings removes update caches, backups and update preferences as well as the normal app profile. Configuration files and exports are never deleted by that action. Update activity blocks changes to the app data folder until the operation finishes.

## Scope and verification

This updater is Windows x64 only. The HTML edition links to releases. The desktop executable remains a single distributable file; the update helper and WebView2 loader are extracted to app data when needed. The installed WebView2 runtime remains a system requirement.

Tests cover strict feed parsing, URL restrictions, versions, digest validation, file identity, DPAPI encryption, multi-vendor workspace roundtrips, browser controls and native menu messages, the real native Updater startup/poll/retry/snooze state machine with isolated clock/feed/preferences, native process replacement with custom Unicode filenames, retained previous builds, and rollback when the new process fails at startup. Native installer tests use small fixture executables so replacement and rollback can run on a Windows CI runner without a live device configuration. Native WebView2 interaction should also be checked on a desktop for each substantial host change.
