"""Synthetic packaging and additive-publication regressions; no network writes."""
import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

import backfill_portable as publish
import checksums
import package_portable as portable


class PackageFixture(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.exe = self.root / portable.EXE
        self.exe.write_bytes(b'MZ' + b'SYNTHETIC_BUILD_ONLY' * 4000)

    def build(self, directory='dist'):
        return portable.build(self.exe, self.root / directory, '5.18.0')


class PortableTests(PackageFixture):
    def test_entries_hash_crc_identity_and_reproducibility(self):
        a = self.build('a')
        b = self.build('b')
        self.assertEqual(a.read_bytes(), b.read_bytes())
        with zipfile.ZipFile(a) as z:
            self.assertEqual(sorted(z.namelist()), sorted(portable.ENTRIES))
            self.assertIsNone(z.testzip())
            self.assertEqual(z.read(portable.EXE), self.exe.read_bytes())
            self.assertIn(b'5.18.0', z.read('README.txt'))
            self.assertNotIn(b'@VERSION@', z.read('README.txt'))
            self.assertIn(b'NOT bundled', z.read('README.txt'))
        self.assertEqual((a.parent / portable.SIDECAR).read_bytes(), portable.manifest({portable.ZIP: a.read_bytes()}))

    def test_no_config_or_working_directory_files_packaged(self):
        (self.root / 'client-backup.conf').write_text('SYNTHETIC_DO_NOT_PACKAGE')
        archive = self.build()
        with zipfile.ZipFile(archive) as z:
            self.assertNotIn('client-backup.conf', z.namelist())

    def test_reject_invalid_version_and_non_executable(self):
        for version in ('../5.18.0', '5.18.0-beta', '05.18.0'):
            with self.assertRaises(ValueError):
                portable.build(self.exe, self.root / 'out', version)
        self.exe.write_bytes(b'not an executable')
        with self.assertRaises(ValueError):
            self.build()

    def test_reject_changed_executable(self):
        a = self.build()
        self.exe.write_bytes(self.exe.read_bytes() + b'x')
        with self.assertRaisesRegex(ValueError, 'differs'):
            portable.verify(a, self.exe)

    def test_reject_extra_or_duplicate_members(self):
        for name in ('../private.conf', portable.EXE):
            a = self.build()
            import warnings
            with warnings.catch_warnings():
                warnings.simplefilter('ignore', UserWarning)
                with zipfile.ZipFile(a, 'a') as z:
                    z.writestr(name, b'unexpected')
            with self.assertRaisesRegex(ValueError, 'entries'):
                portable.verify(a, self.exe)

    def test_reject_wrong_manifest(self):
        a = self.build()
        with zipfile.ZipFile(a) as z:
            data = {n: z.read(n) for n in z.namelist()}
        data['README.txt'] += b'changed'
        with zipfile.ZipFile(a, 'w') as z:
            for name, value in data.items():
                z.writestr(name, value)
        with self.assertRaisesRegex(ValueError, 'manifest'):
            portable.verify(a, self.exe)

    def test_release_checksums_explicit_allowlist(self):
        out = self.root / 'dist'
        self.build()
        for name in (portable.EXE, 'Config_Inspector.html', 'Config_Inspector_Icon.svg'):
            (out / name).write_bytes(self.exe.read_bytes() if name == portable.EXE else b'public')
        checksums.write_checksums(out)
        self.assertEqual(len((out / 'SHA256SUMS').read_text().splitlines()), 5)
        (out / 'private.conf').write_text('SYNTHETIC_DO_NOT_PUBLISH')
        with self.assertRaisesRegex(ValueError, 'Unexpected'):
            checksums.write_checksums(out)


class BackfillTests(PackageFixture):
    def setUp(self):
        super().setUp()
        self.data = {portable.EXE: self.exe.read_bytes(), 'SHA256SUMS': portable.manifest({portable.EXE: self.exe.read_bytes()}),
                     'Config_Inspector.html': b'HTML_UNCHANGED', 'Config_Inspector_Icon.svg': b'ICON_UNCHANGED'}
        self.feed = {'id': 123, 'tag_name': 'v5.18.0', 'draft': False, 'prerelease': False, 'assets': []}
        self.uploads = []
        for name, data in self.data.items():
            self.feed['assets'].append(self.asset(name, data))
        self.original = copy.deepcopy(self.feed['assets'])

    def asset(self, name, data):
        return {'id': len(self.feed['assets']) + 1, 'name': name, 'size': len(data),
                'digest': 'sha256:' + hashlib.sha256(data).hexdigest(),
                'browser_download_url': f'https://github.com/{publish.REPOSITORY}/releases/download/v5.18.0/{name}'}

    def gh(self, *args):
        if args[0] == 'api':
            return json.dumps(self.feed)
        self.assertNotIn('--clobber', args)
        self.assertEqual(args[0], 'release')
        self.assertEqual(args[2], 'v5.18.0')
        self.assertEqual(args[args.index('--repo') + 1], publish.REPOSITORY)
        if args[1] == 'download':
            name = args[args.index('--pattern') + 1]
            (Path(args[args.index('--dir') + 1]) / name).write_bytes(self.data[name])
        elif args[1] == 'upload':
            path = Path(args[3])
            self.assertNotIn(path.name, self.data)
            self.data[path.name] = path.read_bytes()
            self.feed['assets'].append(self.asset(path.name, self.data[path.name]))
            self.uploads.append(path.name)
        else:
            self.fail('Unexpected gh command')
        return ''

    def run_backfill(self):
        with patch.object(publish, 'gh', self.gh):
            publish.backfill('5.18.0')

    def test_additive_then_idempotent_preserves_all_originals(self):
        self.run_backfill()
        self.assertEqual(self.uploads, [portable.ZIP, portable.SIDECAR])
        self.assertEqual(self.feed['assets'][:4], self.original)
        self.run_backfill()
        self.assertEqual(len(self.uploads), 2)

    def test_resume_partial_zip_upload(self):
        self.run_backfill()
        self.feed['assets'] = [a for a in self.feed['assets'] if a['name'] != portable.SIDECAR]
        del self.data[portable.SIDECAR]
        self.uploads.clear()
        self.run_backfill()
        self.assertEqual(self.uploads, [portable.SIDECAR])

    def test_conflicting_existing_zip_fails_without_upload(self):
        self.data[portable.ZIP] = b'not a zip'
        self.feed['assets'].append(self.asset(portable.ZIP, self.data[portable.ZIP]))
        with self.assertRaises(zipfile.BadZipFile):
            self.run_backfill()
        self.assertEqual(self.uploads, [])

    def test_bad_metadata_or_manifest_fails_without_upload(self):
        self.feed['assets'][0]['digest'] = 'sha256:' + '0' * 64
        with self.assertRaisesRegex(ValueError, 'differs'):
            self.run_backfill()
        self.assertEqual(self.uploads, [])
        self.feed['assets'][0] = self.original[0]
        self.data['SHA256SUMS'] = b'wrong manifest'
        self.feed['assets'][1] = self.asset('SHA256SUMS', self.data['SHA256SUMS'])
        with self.assertRaisesRegex(ValueError, 'checksum'):
            self.run_backfill()
        self.assertEqual(self.uploads, [])

    def test_sidecar_conflict_fails_without_upload(self):
        self.data[portable.SIDECAR] = b'wrong checksum'
        self.feed['assets'].append(self.asset(portable.SIDECAR, self.data[portable.SIDECAR]))
        with self.assertRaisesRegex(ValueError, 'refusing replacement'):
            self.run_backfill()
        self.assertEqual(self.uploads, [])


if __name__ == '__main__':
    unittest.main()
