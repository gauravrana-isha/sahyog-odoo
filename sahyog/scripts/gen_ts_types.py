#!/usr/bin/env python3
"""Generate the SPA capability TS type from api_contract.py (P2.3).

Single source of truth: sahyog/api_contract.py. Run after changing it:

    python3 sahyog/scripts/gen_ts_types.py          # write the .ts file
    python3 sahyog/scripts/gen_ts_types.py --check   # exit 1 if out of date (CI)

The generated file is committed so the SPA build has no codegen step.
"""

import os
import sys

# Import the pure-data contract WITHOUT triggering the Odoo package __init__.
_MODULE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, _MODULE_ROOT)
import api_contract  # noqa: E402

_OUT = os.path.join(
    _MODULE_ROOT, 'static', 'src', 'volunteer_app', 'src',
    'generated', 'capabilities.ts',
)

_HEADER = (
    '// AUTO-GENERATED from sahyog/api_contract.py — do not edit by hand.\n'
    '// Regenerate: python3 sahyog/scripts/gen_ts_types.py\n\n'
)


def render():
    lines = [_HEADER, 'export interface Capabilities {']
    for key in api_contract.ALL_CAPABILITIES:
        lines.append(f'  {key}: boolean;')
    lines.append('}')
    lines.append('')
    lines.append('export const CAPABILITY_KEYS = [')
    for key in api_contract.ALL_CAPABILITIES:
        lines.append(f"  '{key}',")
    lines.append('] as const;')
    return '\n'.join(lines) + '\n'


def main():
    content = render()
    check = '--check' in sys.argv
    if check:
        current = open(_OUT).read() if os.path.exists(_OUT) else ''
        if current != content:
            sys.stderr.write(
                'capabilities.ts is out of date — run '
                'python3 sahyog/scripts/gen_ts_types.py\n')
            sys.exit(1)
        print('capabilities.ts is up to date')
        return
    os.makedirs(os.path.dirname(_OUT), exist_ok=True)
    with open(_OUT, 'w') as fh:
        fh.write(content)
    print(f'wrote {_OUT}')


if __name__ == '__main__':
    main()
