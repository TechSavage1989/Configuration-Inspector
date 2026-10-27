"""Checksums for the explicit public release assets (never arbitrary dist files)."""
from pathlib import Path
from package_portable import EXE, ZIP, SIDECAR, manifest

ASSETS = (EXE, 'Config_Inspector.html', 'Config_Inspector_Icon.svg', ZIP, SIDECAR)


def write_checksums(root):
    root = Path(root)
    unexpected = {p.name for p in root.iterdir()} - set(ASSETS) - {'SHA256SUMS'}
    if unexpected:
        raise ValueError('Unexpected release output: ' + ', '.join(sorted(unexpected)))
    files = {name: (root / name).read_bytes() for name in ASSETS}
    if not all(files.values()):
        raise ValueError('Empty release output')
    (root / 'SHA256SUMS').write_bytes(manifest(files))


if __name__ == '__main__':
    write_checksums(Path(__file__).resolve().parents[1] / 'dist')
