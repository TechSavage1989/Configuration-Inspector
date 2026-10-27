"""Verify the reviewed public fixture set before a release can be published."""
from pathlib import Path
import hashlib
import ipaddress
import json
import re
import subprocess

root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / 'tests/public-fixtures.json').read_text())
tracked = [name for name in subprocess.check_output(['git', 'ls-files', '-z'], cwd=root).decode().split('\0') if name]
fixtures = {name for name in tracked if name.startswith('tests/fixtures/')}
assert fixtures == set(manifest['files']), 'Review new or removed fixtures and update the public fixture manifest.'
assert not any(name.endswith(('.backup', '.exp', '.p12', '.pfx', '.zip', '.exe')) for name in tracked), 'Do not publish imported backups or built binaries in source.'
assert not any(name.startswith('validation/') for name in tracked), 'Historical validation data is not public source.'
patterns = [r'-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----', r'\bAKIA[A-Z0-9]{16}\b', r'\bgh[pousr]_[A-Za-z0-9]{30,}\b', r'\bgithub_pat_[A-Za-z0-9_]{40,}\b', r'\bxox[baprs]-[A-Za-z0-9-]{20,}']
text_count = 0
for name in tracked:
    data = (root / name).read_bytes()
    try:
        text = data.decode('utf-8')
    except UnicodeDecodeError:
        assert name in ['webview/WebView2Loader.dll', 'webview/icon.ico', 'webview/icon.png'], 'Unexpected binary source file: ' + name
        continue
    text_count += 1
    for pattern in patterns:
        assert not re.search(pattern, text), 'A private key or credential token signature requires review in ' + name
for name, entry in manifest['files'].items():
    data = (root / name).read_bytes()
    assert hashlib.sha256(data).hexdigest() == entry['sha256'], 'Fixture changed since public-data review: ' + name
    text = data.decode('utf-8')
    for value in re.findall(r'(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])', text):
        try:
            address = ipaddress.ip_address(value)
        except ValueError:
            continue
        assert not address.is_global or address.is_multicast or value in {'1.1.1.1', '8.8.8.8', '9.9.9.9'}, 'Unexpected public fixture address: ' + name
for name, subject in [('review-certificate.pem', 'test.example.test'), ('review-certificate-future.pem', 'future.example.test')]:
    description = subprocess.check_output(['openssl', 'x509', '-in', str(root / 'tests/fixtures' / name), '-noout', '-subject', '-issuer']).decode()
    assert description.count(subject) == 2, 'Certificate must have its public example subject and self-signed issuer.'
print(f'Public source audit passed: {len(tracked)} files, {text_count} text files, {len(fixtures)} reviewed fixtures, no private-key or credential-token signatures, no imported binary backups.')
