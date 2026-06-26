#!/usr/bin/env python3
"""
Normalise town-page <title> tags to <=60 chars with a uniform suffix.

  <title>Removals {Town} | ...anything...</title>
   ->  <title>Removals {Town} | Fixed Price | Free Quote</title>

Only the <title> tag is touched (og:title / twitter:title use different
"Removal Company in ..." text and are left intact). Idempotent.
"""
import re
import glob

SUFFIX = "Fixed Price | Free Quote"
# Capture the town: everything after "Removals " up to the first " | ".
TITLE_RE = re.compile(r"<title>Removals (.+?) \| .*?</title>")


def main():
    files = sorted(glob.glob("removals/*.html"))
    changed = 0
    over60 = 0
    skipped = []
    maxlen = 0
    for fp in files:
        s = open(fp, encoding="utf-8").read()
        m = TITLE_RE.search(s)
        if not m:
            skipped.append(fp)
            continue
        town = m.group(1).strip()
        new_title = f"<title>Removals {town} | {SUFFIX}</title>"
        plain = f"Removals {town} | {SUFFIX}"
        maxlen = max(maxlen, len(plain))
        if len(plain) > 60:
            over60 += 1
            print(f"  WARN >60 ({len(plain)}): {plain}")
        if m.group(0) != new_title:
            s = s.replace(m.group(0), new_title, 1)
            open(fp, "w", encoding="utf-8").write(s)
            changed += 1
    print(f"files: {len(files)}, changed: {changed}, skipped(no match): {len(skipped)}")
    print(f"new max title length: {maxlen}, titles still >60: {over60}")
    if skipped:
        for x in skipped[:10]:
            print("  skipped:", x)


if __name__ == "__main__":
    main()
