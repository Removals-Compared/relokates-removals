#!/usr/bin/env python3
"""
refresh-date-modified.py

Walks every HTML file with a Speakable WebPage JSON-LD block (added by the
GEO Tier 1+2 sweep) and updates the `dateModified` field to the date of
the most recent git commit that touched that file -- *excluding* commits
listed in BOILERPLATE_COMMITS below.

Why exclude commits?
  When we add a sitewide tag or footer line via a script, every file in
  the repo gets touched in one commit. That makes every page report the
  same dateModified, which is a tell. By excluding those boilerplate
  commits, dateModified reflects the last *meaningful content edit* of
  the page, which is honest and gives a realistic spread of dates.

Re-run this script:
  - After any sitewide boilerplate sweep -- add the new commit hash to
    BOILERPLATE_COMMITS before re-running
  - Periodically (e.g. monthly) to refresh as individual pages get edited

Usage:
  python3 scripts/refresh-date-modified.py
"""

import os
import re
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Commits that touched many files but did not change visible content.
# Add new sweep hashes here when they happen.
BOILERPLATE_COMMITS = {
    "bfddd39",  # geo: scale AI optimisation to all 719 pages
    "d30d0dd",  # geo: AI search optimisation (Tier 1 + Tier 2)
}

# Match the dateModified inside the Speakable WebPage JSON-LD we inject.
DATE_PATTERN = re.compile(r'("@type":"WebPage","dateModified":")(\d{4}-\d{2}-\d{2})(")')


def last_meaningful_date(path: str) -> str | None:
    """
    Return YYYY-MM-DD of the most recent commit that touched `path`,
    ignoring any commit listed in BOILERPLATE_COMMITS. Returns None if
    no commits remain (file is untracked or only ever touched by
    boilerplate sweeps, in which case we leave its date alone).
    """
    rel = os.path.relpath(path, REPO)
    # Ask git for up to 50 recent commits on this file with hash + date.
    result = subprocess.run(
        ["git", "log", "--format=%h %cs", "-n", "50", "--", rel],
        cwd=REPO,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return None
    for line in result.stdout.splitlines():
        parts = line.strip().split(maxsplit=1)
        if len(parts) != 2:
            continue
        commit_hash, date_str = parts
        if commit_hash[:7] not in BOILERPLATE_COMMITS:
            return date_str
    return None


def main() -> int:
    touched = 0
    skipped_no_history = 0
    skipped_unchanged = 0

    for root, _, files in os.walk(REPO):
        # Skip git internals, node_modules, admin, etc.
        if "/.git" in root or "/node_modules" in root or "/admin" in root:
            continue
        for fn in files:
            if not fn.endswith(".html"):
                continue
            path = os.path.join(root, fn)
            with open(path, "r", encoding="utf-8") as f:
                src = f.read()
            if 'SpeakableSpecification' not in src:
                continue

            new_date = last_meaningful_date(path)
            if new_date is None:
                skipped_no_history += 1
                continue

            new_src, n = DATE_PATTERN.subn(
                lambda m: m.group(1) + new_date + m.group(3),
                src,
                count=1,
            )
            if n == 0 or new_src == src:
                skipped_unchanged += 1
                continue
            with open(path, "w", encoding="utf-8") as f:
                f.write(new_src)
            touched += 1

    print(f"Updated: {touched}")
    print(f"Unchanged (date already correct): {skipped_unchanged}")
    print(f"Skipped (no meaningful commit history): {skipped_no_history}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
