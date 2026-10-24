"""Keep executable metadata and the visible UI on the same release version."""
from pathlib import Path
import argparse
import json
import re

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
version = (root / 'VERSION').read_text().strip()
assert re.fullmatch(r'(0|[1-9][0-9]{0,4})\.(0|[1-9][0-9]{0,4})\.(0|[1-9][0-9]{0,4})', version)
assert all(int(v) <= 65535 for v in version.split('.'))
header = '#pragma once\n#define CI_VERSION "' + version + '"\n#define CI_VERSION_W L"' + version + '"\n#define CI_VERSION_RESOURCE ' + version.replace('.', ',') + ',0\n'
if args.check:
    assert (root / 'webview/version.h').read_text() == header, 'Run python scripts/version.py after changing VERSION.'
    assert 'version="' + version + '.0"' in (root / 'webview/app.manifest').read_text()
    assert "current:'" + version + "'" in (root / 'webview/updates.js').read_text()
    assert 'Config Inspector ' + version in (root / 'webview/index.html').read_text()
else:
    old = re.search(r'#define CI_VERSION "([^"]+)"', (root / 'webview/version.h').read_text()).group(1)
    for file in ['webview/index.html', 'webview/app.manifest', 'webview/app.cpp', 'webview/updates.js']:
        path = root / file
        path.write_text(path.read_text().replace(old, version))
    (root / 'webview/version.h').write_text(header)
    for name in ['package.json', 'package-lock.json']:
        data = json.loads((root / name).read_text())
        data['version'] = version
        if 'packages' in data:
            data['packages']['']['version'] = version
        (root / name).write_text(json.dumps(data, indent=2) + '\n')
print('Release version ' + version)
