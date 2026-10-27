Configuration Inspector @VERSION@ - portable Windows x64 application

1. Extract ALL files from this ZIP to a writable local folder.
2. Run Config_Inspector.exe from that folder, not from inside the ZIP viewer.
3. Microsoft Edge WebView2 Evergreen Runtime must already be installed.
   If it is missing, obtain it from Microsoft:
   https://developer.microsoft.com/microsoft-edge/webview2/

The HTML interface and WebView2 loader are embedded in the executable; no
companion DLL or HTML file is required. The full WebView2 runtime is NOT bundled.
The enclosed third-party license and notice files should remain with this copy.

Portable means no application installer is required. Settings/browser profile,
extracted loader and update cache default to:
  %LOCALAPPDATA%\ConfigInspectorWebView
Use App settings to inspect/change the data folder. Data is not automatically
stored beside the EXE. Imported configurations stay in their original locations.
No configurations, credentials or user settings are included in this package.

Updates use the separate official Config_Inspector.exe release asset, not this
ZIP. Keep the application folder writable. Installation requires your final
Install and restart action; your chosen executable filename is preserved.
These builds are not Authenticode signed. Do not bypass organizational policy.

SHA256SUMS inside the ZIP verifies its enclosed files. The release's
Config_Inspector_Portable.zip.sha256 verifies the ZIP itself. For example:
  Get-FileHash .\Config_Inspector_Portable.zip -Algorithm SHA256
Compare that value with the .sha256 download. Hashes detect corruption, not a
compromised publisher. Prefer downloads from the official repository:
https://github.com/TechSavage1989/Configuration-Inspector/releases/latest

The browser-only HTML edition and editable source are separate downloads.
Third-party notices: WebView2-LICENSE.txt, WebView2-NOTICE.txt and
NETBOX_CC0_LICENSE.txt (public device-catalog definitions).
