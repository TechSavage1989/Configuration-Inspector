"""Build/verify the portable download from an explicit, configuration-free allowlist."""
import argparse
import hashlib
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
EXE = 'Config_Inspector.exe'
ZIP = 'Config_Inspector_Portable.zip'
SIDECAR = ZIP + '.sha256'
NOTICES = ('WebView2-LICENSE.txt', 'WebView2-NOTICE.txt', 'NETBOX_CC0_LICENSE.txt')
ENTRIES = (EXE, 'README.txt', *NOTICES, 'SHA256SUMS')


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def manifest(files):
    return ''.join(f'{sha256(data)}  {name}\n' for name, data in sorted(files.items())).encode('ascii')


def verify(archive, executable):
    """Reject extra/private files, unsafe paths, corrupt members or a different EXE."""
    with zipfile.ZipFile(archive) as z:
        if sorted(z.namelist()) != sorted(ENTRIES):
            raise ValueError('Unexpected portable ZIP entries')
        if z.testzip() is not None:
            raise ValueError('Portable ZIP CRC mismatch')
        files = {name: z.read(name) for name in ENTRIES if name != 'SHA256SUMS'}
        if files[EXE] != Path(executable).read_bytes():
            raise ValueError('Portable ZIP executable differs from the released executable')
        if z.read('SHA256SUMS') != manifest(files):
            raise ValueError('Portable ZIP manifest mismatch')
        if not all(files.values()):
            raise ValueError('Empty portable ZIP member')
    return sha256(Path(archive).read_bytes())


def build(executable, output, version):
    if not re.fullmatch(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', version):
        raise ValueError('Expected a stable version')
    executable, output = Path(executable), Path(output)
    binary = executable.read_bytes()
    if len(binary) < 65536 or binary[:2] != b'MZ':
        raise ValueError('Expected the built Windows executable')
    readme = (ROOT / 'docs/PORTABLE_README.txt').read_text(encoding='utf-8').replace('@VERSION@', version)
    files = {EXE: binary, 'README.txt': readme.encode('utf-8')}
    files.update({name: (ROOT / 'webview' / name).read_text(encoding='utf-8').encode('utf-8') for name in NOTICES})
    files['SHA256SUMS'] = manifest(files)
    output.mkdir(parents=True, exist_ok=True)
    archive = output / ZIP
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    digest = verify(archive, executable)
    (output / SIDECAR).write_bytes(f'{digest}  {ZIP}\n'.encode('ascii'))
    return archive


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--exe', type=Path, default=ROOT / 'dist' / EXE)
    p.add_argument('--output', type=Path, default=ROOT / 'dist')
    p.add_argument('--version', default=(ROOT / 'VERSION').read_text().strip())
    args = p.parse_args()
    print(build(args.exe, args.output, args.version))
