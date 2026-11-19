#!/usr/bin/env python3
"""Check shell syntax of literal GitHub Actions steps before production deploy."""

from pathlib import Path
import subprocess

WORKFLOWS = (
    Path('.github/workflows/deploy-reg-ru.yml'),
    Path('.github/workflows/studio-tests.yml'),
)

for workflow in WORKFLOWS:
    lines = workflow.read_text(encoding='utf-8').splitlines()
    checked = 0
    for number, line in enumerate(lines, 1):
        indent = len(line) - len(line.lstrip(' '))
        if line.strip() != 'run: |':
            continue
        script_lines = []
        for body_line in lines[number:]:
            body_indent = len(body_line) - len(body_line.lstrip(' '))
            if body_line.strip() and body_indent <= indent:
                break
            script_lines.append(body_line[indent + 2:] if body_line.strip() else '')
        script = '\n'.join(script_lines) + '\n'
        result = subprocess.run(
            ['bash', '-n'], input=script, text=True, capture_output=True, check=False
        )
        if result.returncode != 0:
            raise SystemExit(
                f'{workflow}:{number}: invalid Bash syntax in Actions run block: '
                f'{result.stderr.strip()}'
            )
        checked += 1
    if checked == 0:
        raise SystemExit(f'{workflow}: no literal shell steps checked')
    print(f'{workflow}: {checked} inline Bash scripts parsed OK')
