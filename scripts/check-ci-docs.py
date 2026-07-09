#!/usr/bin/env python3
"""CI docs consistency checks — .env.example coverage + AGENTS.md/CLAUDE.md counts."""
import re
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parent.parent
errors = 0

# ── 1. .env.example coverage ──────────────────────────────────────────────
code_vars = set()
for py in sorted(root.rglob("virtual_team/*.py")):
    for m in re.finditer(r'os\.environ\.get\(["\']([A-Z_]+)', py.read_text()):
        code_vars.add(m.group(1))

env_example = set()
for line in root.joinpath(".env.example").read_text().splitlines():
    m = re.match(r"^([A-Z_]+)=", line)
    if m:
        env_example.add(m.group(1))

missing = sorted(code_vars - env_example)
if missing:
    print("❌ Variables missing from .env.example:", " ".join(missing))
    errors += 1
else:
    print("✅ All env vars covered in .env.example")

# ── 2. AGENTS.md counts ──────────────────────────────────────────────────
agents = root.joinpath("AGENTS.md").read_text()

# Routers
actual = len([f for f in sorted(root.joinpath("virtual_team/routers").glob("*.py")) if f.name != "__init__.py"])
expected = int(re.search(r"routers/ \((\d+)", agents).group(1))
if actual != expected:
    print(f"❌ Routers: AGENTS.md says {expected}, actual {actual}")
    errors += 1
else:
    print(f"✅ Routers: {actual}")

# Repository
actual = len([f for f in sorted(root.joinpath("virtual_team/repository").glob("*.py")) if f.name != "__init__.py"])
expected = int(re.search(r"repository/ \((\d+)", agents).group(1))
if actual != expected:
    print(f"❌ Repository: AGENTS.md says {expected}, actual {actual}")
    errors += 1
else:
    print(f"✅ Repository: {actual}")

# ── 3. CLAUDE.md workstation modules ─────────────────────────────────────
claude = root.joinpath("CLAUDE.md").read_text()
modules = [
    d for d in root.joinpath("frontend/src/components/agentstudio/workstation").iterdir()
    if d.is_dir() and d.name != "shared"
]
actual = len(modules)
expected = int(re.search(r"工作台 (\d+)", claude).group(1))
if actual != expected:
    print(f"❌ Workstation: CLAUDE.md says {expected}, actual {actual}")
    errors += 1
else:
    print(f"✅ Workstation modules: {actual}")

# ── Report ────────────────────────────────────────────────────────────────
if errors:
    print(f"❌ {errors} doc inconsistency(ies) found — update AGENTS.md / CLAUDE.md")
    sys.exit(1)
print("✅ All docs consistent with codebase")
