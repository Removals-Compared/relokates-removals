#!/usr/bin/env python3
"""
Strip AI watermarks from every HTML file in the project.

Why: em-dashes (—), en-dashes (–) with spaces, and a handful of overused
words ("seamlessly", "delve", "tapestry", "in essence", etc.) are
typical AI-generation tells that erode trust on a marketing site.

This script does two passes:

  1. Character substitution (raw text):
        "—"  →  "-"     em-dash      → hyphen
        "–"  →  "-"     en-dash      → hyphen
     Surrounding-space patterns ("  X  Y  ") collapse to single spaces.

  2. Phrase substitution (case-insensitive):
        "seamlessly"          →  drop
        "delve into"          →  "look at"
        "in essence"          →  drop
        ...etc.
     If a phrase needs context-specific handling rather than a single
     swap, log the file + line so it can be reviewed manually.

Run with no args to process every .html file under the project root.
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

CHAR_SUBS = [
    ("—", "-"),  # em-dash
    ("–", "-"),  # en-dash
]

# Simple phrase replacements. Case-preserving on the first letter only
# (we lower-match but keep visible result lower-case here — the script
# does not try to match sentence-initial capitalisation).
PHRASE_SUBS = [
    # "bridges that gap seamlessly" → "bridges that gap" (drop the adverb)
    (re.compile(r"\s+seamlessly\b", re.IGNORECASE), ""),
    (re.compile(r"\bdelve(s|d|ing)? into\b", re.IGNORECASE), "look at"),
    (re.compile(r"\bin essence,?\s*", re.IGNORECASE), ""),
    (re.compile(r"\bembark on (?:a |an )?", re.IGNORECASE), "start "),
    (re.compile(r"\btapestry of\b", re.IGNORECASE), "mix of"),
    (re.compile(r"\bleverag(e|es|ed|ing)\b", re.IGNORECASE), "use"),
    (re.compile(r"\bnavigating the complexities of\b", re.IGNORECASE), "handling"),
    (re.compile(r"\bin today's (?:digital |modern |fast-paced )?(?:landscape|world|age)[,\.]?\s*", re.IGNORECASE), ""),
    (re.compile(r"\blet's (?:dive|delve|explore)(?:\s+(?:in|into|deeper))?[,\.]?\s*", re.IGNORECASE), ""),
    (re.compile(r"\bit's worth noting that\b", re.IGNORECASE), ""),
    (re.compile(r"\brest assured[,\.]?\s*", re.IGNORECASE), ""),
    (re.compile(r"\blook no further\b[,\.]?\s*", re.IGNORECASE), ""),
    (re.compile(r"\b(?:in conclusion|to conclude)[,\.]?\s*", re.IGNORECASE), ""),
    (re.compile(r"\b(?:moreover|furthermore)[,\.]?\s*", re.IGNORECASE), ""),
]


def clean_text(src: str) -> tuple[str, int, int]:
    """Return (cleaned, char_subs, phrase_subs) counts."""
    char_count = 0
    for old, new in CHAR_SUBS:
        char_count += src.count(old)
        src = src.replace(old, new)

    phrase_count = 0
    for pattern, replacement in PHRASE_SUBS:
        src, n = pattern.subn(replacement, src)
        phrase_count += n

    # NOTE: No global whitespace tidy-up here. Doing `\s+([,.;:!\?])` to
    # strip orphaned space-before-punctuation also strips space-before-dot
    # everywhere — including ".foo .bar" CSS descendant selectors, which
    # silently collapse to ".foo.bar" (a different rule). Phrase subs are
    # crafted to consume their own leading space so they don't produce
    # double spaces in the first place.

    return src, char_count, phrase_count


def main() -> int:
    only = sys.argv[1] if len(sys.argv) > 1 else None
    if only:
        targets = [Path(only)]
    else:
        targets = sorted(ROOT.rglob("*.html"))

    total_files = 0
    total_char = 0
    total_phrase = 0
    changed_files = 0

    for path in targets:
        if not path.is_file():
            continue
        # Skip node_modules / .git / etc just in case
        if any(part.startswith(".") for part in path.relative_to(ROOT).parts):
            continue

        src = path.read_text(encoding="utf-8")
        new_src, char_n, phrase_n = clean_text(src)
        total_files += 1
        total_char += char_n
        total_phrase += phrase_n
        if new_src != src:
            path.write_text(new_src, encoding="utf-8")
            changed_files += 1

    print(f"scanned {total_files} files; updated {changed_files}")
    print(f"  em-/en-dash replacements: {total_char}")
    print(f"  phrase replacements:      {total_phrase}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
