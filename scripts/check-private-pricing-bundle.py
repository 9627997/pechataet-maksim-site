#!/usr/bin/env python3
"""Read Github Actions Secret only into an isolated runner directory.

No commercial data is written to stdout, Git logs or deployment artifact.
"""
import base64
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import sys
import tarfile

EXPECTED_SHA = '2e838edbc3e4709080f43d1ddf348e1b484a03d1e11fe32e1c2ab1e7aa287b11'
EXPECTED_FILES = frozenset({
    'ASSORTMENT_PRIVATE.json',
    'AVAILABILITY/AVAILABILITY_ALL_BLOCKED.json',
    'AVAILABILITY/PmAvailabilityGate.php',
    'AVAILABILITY/REGISTRIES/MATERIAL.json',
    'AVAILABILITY/REGISTRIES/PRODUCT.json',
    'AVAILABILITY/REGISTRIES/RC9_3_PREVIEW_MAP_233_PRIVATE.json',
    'AVAILABILITY/REGISTRIES/TECHNOLOGY.json',
    'AVAILABILITY/REGISTRIES/VARIANT_LINKS.json',
    'BigNat.php',
    'ExactPricing.php',
    'OFFERS.json',
    'OFFERS_ALL_BLOCKED.json',
    'PmCalcPreview.php',
    'PmOrderRounding.php',
    'PmStudioOrderContract.php',
    'SILICONE_STAGING_PRIVATE.json',
    'SNAPSHOT_ASSORTMENT_PRIVATE.json',
    'config.php',
})


def require(condition, message):
    if not condition:
        raise SystemExit('BLOCK: ' + message)


def main():
    require(len(sys.argv) == 2, 'usage: python3 script.py PRIVATE_OUTPUT_DIR')
    dest = Path(sys.argv[1])
    require(not dest.exists(), 'private output destination already exists')
    encoded = os.environ.get('PM_CALC_PRIVATE_BUNDLE_XZ_B64', '')
    require(bool(encoded), 'GitHub secret PM_CALC_PRIVATE_BUNDLE_XZ_B64 is missing')
    require(len(encoded) < 48 * 1024, 'secret too large')
    try:
        bundle = base64.b64decode(encoded, validate=True)
    except (ValueError, base64.binascii.Error):
        raise SystemExit('BLOCK: invalid private bundle encoding') from None
    require(hashlib.sha256(bundle).hexdigest() == EXPECTED_SHA, 'private bundle SHA256 mismatch')

    with tarfile.open(fileobj=io.BytesIO(bundle), mode='r:xz') as tar:
        members = tar.getmembers()
        names = {m.name for m in members}
        require(len(members) == len(EXPECTED_FILES) and names == EXPECTED_FILES,
                'private bundle allowlist mismatch')
        file_data = {}
        for item in members:
            path = PurePosixPath(item.name)
            require(item.isfile() and not item.issym() and not item.islnk(),
                    'non-regular private file in package')
            require(len(path.parts) >= 1 and '..' not in path.parts and not path.is_absolute(),
                    'private file path is unsafe')
            require(item.size < 1024 * 1024, 'private file exceeds size cap')
            data = tar.extractfile(item).read()
            require(len(data) == item.size, 'truncated private file')
            file_data[item.name] = data

    cfg = file_data['config.php'].decode('utf8')
    require(re.search(r"'preview_enabled'\s*=>\s*false", cfg),
            'private preview must remain disabled in release bundle')
    require(re.search(r"'mode'\s*=>\s*'preliminary_only'", cfg),
            'private bundle mode mismatch')
    for name in ('ASSORTMENT_PRIVATE.json', 'SILICONE_STAGING_PRIVATE.json'):
        control = json.loads(file_data[name])
        for flag in ('published', 'public_quote_enabled', 'physical_print_tests_verified'):
            require(control.get(flag) is False, 'private publication gate must remain closed')
    availability = json.loads(file_data['AVAILABILITY/AVAILABILITY_ALL_BLOCKED.json'])
    require(isinstance(availability, dict), 'blocked availability registry unreadable')

    os.umask(0o077)
    dest.mkdir(mode=0o700, parents=False)
    for name, data in file_data.items():
        path = dest.joinpath(*PurePosixPath(name).parts)
        path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        with path.open('xb') as out:
            out.write(data)
        path.chmod(0o600)
    print('PASS: private bundle fingerprint, file allowlist and closed publication gates')


if __name__ == '__main__':
    main()
