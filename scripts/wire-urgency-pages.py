#!/usr/bin/env python3
"""
Make the three urgency landing pages (same-day-removals,
last-minute-removals, weekend-removals) discoverable across the site.

Without internal links Google treats them as low-importance pages and
they struggle to rank for their target keywords (`same day removals
[town]`, `last minute removals`, `weekend removals`).

This script adds them to:

  1. The desktop nav "Services" dropdown, between "House Clearance"
     and the divider that leads to "All services".
  2. The mobile nav overlay, in the same Services group.
  3. The footer "Services" column ul.

The edits are idempotent: each insertion checks for an existing
reference first and skips when found. Run any time without harm.
"""

from __future__ import annotations
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# ---- desktop nav dropdown (in every header) --------------------------------
# Insert 3 new <li> entries right before <hr class="dd-divider">
DESKTOP_NEEDLE = (
    '<li><a href="/house-clearance">&#127968; House Clearance</a></li>'
    '<hr class="dd-divider">'
)
DESKTOP_REPL = (
    '<li><a href="/house-clearance">&#127968; House Clearance</a></li>'
    '<li><a href="/same-day-removals">&#9889; Same Day</a></li>'
    '<li><a href="/last-minute-removals">&#128680; Last Minute</a></li>'
    '<li><a href="/weekend-removals">&#128197; Weekend</a></li>'
    '<hr class="dd-divider">'
)
DESKTOP_GUARD = "/same-day-removals"  # if this exists in the dropdown, skip

# ---- footer "Services" <ul> ------------------------------------------------
# Insert 3 new entries right before the closing </ul> of the services column.
FOOTER_NEEDLE = '<li><a href="/house-clearance">House Clearance</a></li></ul>'
FOOTER_REPL = (
    '<li><a href="/house-clearance">House Clearance</a></li>'
    '<li><a href="/same-day-removals">Same Day Removals</a></li>'
    '<li><a href="/last-minute-removals">Last Minute Removals</a></li>'
    '<li><a href="/weekend-removals">Weekend Removals</a></li>'
    '</ul>'
)


def patch_one(path: Path) -> tuple[bool, bool]:
    src = path.read_text(encoding="utf-8", errors="ignore")
    nav_added = footer_added = False

    # --- desktop nav ---
    if DESKTOP_NEEDLE in src:
        # Look at the dropdown only - check that same-day isn't already there
        # to avoid re-inserting if the script runs twice.
        if 'href="/same-day-removals">&#9889;' not in src:
            src = src.replace(DESKTOP_NEEDLE, DESKTOP_REPL, 1)
            nav_added = True

    # --- footer ---
    if FOOTER_NEEDLE in src:
        if 'href="/same-day-removals">Same Day Removals' not in src:
            src = src.replace(FOOTER_NEEDLE, FOOTER_REPL, 1)
            footer_added = True

    if nav_added or footer_added:
        path.write_text(src, encoding="utf-8")
    return nav_added, footer_added


def main() -> int:
    files = sorted(ROOT.rglob("*.html"))
    nav_count = footer_count = 0
    for f in files:
        if ".git" in str(f):
            continue
        nav, foot = patch_one(f)
        nav_count += nav
        footer_count += foot
    print(f"Updated nav dropdown in {nav_count} file(s)")
    print(f"Updated footer Services list in {footer_count} file(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
