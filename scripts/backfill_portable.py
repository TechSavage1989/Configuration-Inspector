"""Add missing portable assets to an existing release; never replace any asset."""
import json
from pathlib import Path
import re
import subprocess
import tempfile
from package_portable import EXE, ZIP, SIDECAR, build, sha256, verify

REPOSITORY = 'TechSavage1989/Configuration-Inspector'


def gh(*args):
    return subprocess.check_output(['gh', *args], text=True)


def release(tag):
    data = json.loads(gh('api', f'repos/{REPOSITORY}/releases/tags/{tag}'))
    if data['tag_name'] != tag or data['draft'] or data['prerelease']:
        raise ValueError('Expected the existing stable release')
    names = [a['name'] for a in data['assets']]
    if len(names) != len(set(names)):
        raise ValueError('Duplicate release asset names')
    return data


def download(asset, tag, directory):
    name = asset['name']
    if name not in (EXE, ZIP, SIDECAR, 'SHA256SUMS'):
        raise ValueError('Unexpected download asset')
    if asset['browser_download_url'] != f'https://github.com/{REPOSITORY}/releases/download/{tag}/{name}':
        raise ValueError('Unexpected release download URL')
    digest = asset.get('digest', '')
    if not re.fullmatch(r'sha256:[0-9a-f]{64}', digest) or not 0 < asset['size'] <= 300_000_000:
        raise ValueError('Missing/invalid release size or digest')
    gh('release', 'download', tag, '--repo', REPOSITORY, '--pattern', name, '--dir', str(directory))
    path = directory / name
    data = path.read_bytes()
    if len(data) != asset['size'] or 'sha256:' + sha256(data) != digest:
        raise ValueError('Downloaded release asset differs from GitHub metadata')
    return path


def identity(asset):
    return {k: asset[k] for k in ('id', 'name', 'size', 'digest', 'browser_download_url')}


def backfill(version):
    if not re.fullmatch(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', version):
        raise ValueError('Expected a stable version')
    tag = 'v' + version
    before = release(tag)
    assets = {a['name']: a for a in before['assets']}
    with tempfile.TemporaryDirectory(prefix='config-portable-') as tmp:
        root = Path(tmp)
        exe = download(assets[EXE], tag, root)
        sums = download(assets['SHA256SUMS'], tag, root).read_text(encoding='ascii')
        if f'{sha256(exe.read_bytes())}  {EXE}' not in sums.splitlines():
            raise ValueError('Published executable checksum mismatch')
        if ZIP in assets:
            archive = download(assets[ZIP], tag, root)
            digest = verify(archive, exe)
        else:
            archive = build(exe, root, version)
            digest = sha256(archive.read_bytes())
        expected = f'{digest}  {ZIP}\n'.encode('ascii')
        if SIDECAR in assets:
            # build() writes a sidecar: remove only this temporary generated copy.
            (root / SIDECAR).unlink(missing_ok=True)
            if download(assets[SIDECAR], tag, root).read_bytes() != expected:
                raise ValueError('Existing portable checksum does not match; refusing replacement')
        else:
            (root / SIDECAR).write_bytes(expected)
        # No --clobber: a concurrent upload fails closed instead of replacing it.
        for name in (ZIP, SIDECAR):
            if name not in assets:
                gh('release', 'upload', tag, str(root / name), '--repo', REPOSITORY)
        after = release(tag)
        now = {a['name']: a for a in after['assets']}
        if before['id'] != after['id'] or any(identity(a) != identity(now[name]) for name, a in assets.items()):
            raise ValueError('An existing release asset changed during packaging')
        for name in (ZIP, SIDECAR):
            if now[name]['digest'] != 'sha256:' + sha256((root / name).read_bytes()):
                raise ValueError('Published portable asset digest mismatch')
        print(f'{tag}: portable ZIP verified; all existing release assets preserved')


if __name__ == '__main__':
    backfill((Path(__file__).resolve().parents[1] / 'VERSION').read_text().strip())
