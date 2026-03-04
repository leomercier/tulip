#!/usr/bin/env python3
"""
Validates that the rendered cloud-init template is clean ASCII and valid YAML.
Run: python packages/cloud-init/validate.py
"""
import sys, subprocess, pathlib, re

root = pathlib.Path(__file__).parent.parent.parent

# Build the package if needed
src = root / "packages/cloud-init/lib/index.js"
if not src.exists():
    subprocess.run(["pnpm", "--filter", "@tulip/cloud-init", "build"], check=True, cwd=root)

# Render via a tiny Node script
render_script = """
const { renderCloudInit } = require('./packages/cloud-init/lib/index.js');
const yaml = renderCloudInit({
  CONTROL_PLANE_BASE_URL: 'https://example.tulip.md',
  BOOTSTRAP_TOKEN: 'a'.repeat(64),
  ORG_ID: 'test-org',
  INSTANCE_ID: 'tulip-testtest',
  OPENCLAW_IMAGE: 'ghcr.io/test/openclaw:latest',
});
process.stdout.write(yaml);
"""

result = subprocess.run(
    ["node", "-e", render_script],
    capture_output=True,
    cwd=root,
)
if result.returncode != 0:
    print("ERROR: renderCloudInit() failed:", result.stderr.decode(), file=sys.stderr)
    sys.exit(1)

rendered = result.stdout

# 1. Check for non-ASCII bytes
non_ascii = [(i, b) for i, b in enumerate(rendered) if b > 127]
if non_ascii:
    print(f"FAIL: {len(non_ascii)} non-ASCII byte(s) found:", file=sys.stderr)
    for pos, byte in non_ascii[:5]:
        ctx = rendered[max(0, pos-20):pos+20]
        print(f"  offset {pos}: 0x{byte:02x}  context: {ctx!r}", file=sys.stderr)
    sys.exit(1)

# 2. Check for known bad punctuation patterns
text = rendered.decode("ascii")
bad = re.findall(r'[\u2013\u2014\u2018\u2019\u201c\u201d\u2026]', text)
if bad:
    print(f"FAIL: non-ASCII punctuation in rendered output: {bad}", file=sys.stderr)
    sys.exit(1)

# 3. Validate as YAML
try:
    import yaml
    yaml.safe_load(text)
except ImportError:
    print("SKIP: pyyaml not installed; skipping YAML parse check")
except yaml.YAMLError as e:
    print(f"FAIL: YAML parse error: {e}", file=sys.stderr)
    sys.exit(1)

print("OK: template is clean ASCII and valid YAML")
