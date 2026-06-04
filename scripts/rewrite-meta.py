#!/usr/bin/env python3
"""
Rewrite <title> and <meta name="description"> tags across:
  - /removals/*.html       (496 town pages)
  - /removals-to-dubai/*.html (165 Dubai destination pages)

Purpose: fix CTR. Current templates bury the search keyword
("Removal Company in [Town]") and exceed Google's snippet length.
New templates lead with "Removals [Town]", stay under 65 chars,
and front-load USPs.
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# --- regex patterns ----------------------------------------------------------
# Old town-page title: <title>Removal Company in TOWN, COUNTY | Relokates | Fully Insured Fixed Price</title>
# Variant: "...Fully Insured &amp; Fixed Price" or "...Fully Insured & Fixed Price"
TOWN_TITLE_RE = re.compile(
    r'<title>Removal Company in ([^,]+),\s*([^|<]+?)\s*\|\s*Relokates\s*\|\s*Fully Insured\s*(?:&amp;\s*|&\s*)?Fixed Price</title>'
)
# Old town-page meta description
TOWN_DESC_RE = re.compile(
    r'<meta name="description" content="Professional, fully insured removal company in ([^,]+),\s*([^.]+)\.\s*Fixed-price house removals, office relocations and packing services\.\s*5-star rated\.\s*Call 07359 724844 for a free quote\.">'
)
# Old Dubai title: <title>Removals from CITY to Dubai | Relokates | Fully Insured International Removals</title>
DUBAI_TITLE_RE = re.compile(
    r'<title>Removals from ([^|<]+?)\s+to Dubai\s*\|\s*Relokates\s*\|\s*Fully Insured International Removals</title>'
)
# Old Dubai meta description
DUBAI_DESC_RE = re.compile(
    r'<meta name="description" content="Professional, fully insured international removals from ([^.]+?)\s+to Dubai and the UAE\.\s*Fixed-price quotes, expert packing and full customs management\.\s*Call 07359 724844\.">'
)


def new_town_title(town: str) -> str:
    return f"<title>Removals {town} | Fixed Price, Fully Insured | Free Quote</title>"


def new_town_desc(town: str, county: str) -> str:
    body = (
        f"5-star rated removals in {town}, {county}. Fixed-price quotes, "
        f"fully insured, no hidden charges. House, office & specialist moves. "
        f"Free quote – call 07359 724844."
    )
    return f'<meta name="description" content="{body}">'


def new_dubai_title(city: str) -> str:
    return f"<title>Removals {city} to Dubai | Fixed-Price UAE Movers | Free Quote</title>"


def new_dubai_desc(city: str) -> str:
    body = (
        f"Specialist removals from {city} to Dubai. Door-to-door UAE service "
        f"with full customs clearance, fixed-price shipping & expert packing. "
        f"Call 07359 724844."
    )
    return f'<meta name="description" content="{body}">'


def warn_length(label: str, text: str, soft: int, hard: int) -> None:
    visible = re.sub(r"<[^>]+>", "", text)
    if 'content="' in text:
        visible = text.split('content="', 1)[1].rstrip('">')
    n = len(visible)
    if n > hard:
        print(f"  ! {label}: {n} chars (>{hard}) — {visible}", file=sys.stderr)
    elif n > soft:
        print(f"  ~ {label}: {n} chars (>{soft})", file=sys.stderr)


def rewrite_town(path: Path) -> bool:
    src = path.read_text(encoding="utf-8")
    t_match = TOWN_TITLE_RE.search(src)
    d_match = TOWN_DESC_RE.search(src)
    if not t_match or not d_match:
        return False
    town_t, county_t = t_match.group(1).strip(), t_match.group(2).strip()
    town_d, county_d = d_match.group(1).strip(), d_match.group(2).strip()
    if town_t != town_d or county_t != county_d:
        print(f"  ! {path.name}: title/desc town mismatch ({town_t}/{county_t} vs {town_d}/{county_d})", file=sys.stderr)
    town, county = town_t, county_t

    new_t = new_town_title(town)
    new_d = new_town_desc(town, county)
    warn_length(f"{path.name} title", new_t, 60, 65)
    warn_length(f"{path.name} desc", new_d, 160, 170)

    src = TOWN_TITLE_RE.sub(new_t, src, count=1)
    src = TOWN_DESC_RE.sub(new_d, src, count=1)
    path.write_text(src, encoding="utf-8")
    return True


def rewrite_dubai(path: Path) -> bool:
    src = path.read_text(encoding="utf-8")
    t_match = DUBAI_TITLE_RE.search(src)
    d_match = DUBAI_DESC_RE.search(src)
    if not t_match or not d_match:
        return False
    city_t = t_match.group(1).strip()
    city_d = d_match.group(1).strip()
    if city_t != city_d:
        print(f"  ! {path.name}: title/desc city mismatch ({city_t} vs {city_d})", file=sys.stderr)
    city = city_t

    new_t = new_dubai_title(city)
    new_d = new_dubai_desc(city)
    warn_length(f"{path.name} title", new_t, 60, 65)
    warn_length(f"{path.name} desc", new_d, 160, 170)

    src = DUBAI_TITLE_RE.sub(new_t, src, count=1)
    src = DUBAI_DESC_RE.sub(new_d, src, count=1)
    path.write_text(src, encoding="utf-8")
    return True


def main() -> int:
    only = sys.argv[1] if len(sys.argv) > 1 else None
    town_dir = ROOT / "removals"
    dubai_dir = ROOT / "removals-to-dubai"

    town_files = sorted(town_dir.glob("*.html")) if town_dir.exists() else []
    dubai_files = sorted(dubai_dir.glob("*.html")) if dubai_dir.exists() else []
    if only:
        town_files = [p for p in town_files if p.name == only or p.stem == only]
        dubai_files = [p for p in dubai_files if p.name == only or p.stem == only]

    town_ok = town_skip = 0
    for p in town_files:
        if rewrite_town(p):
            town_ok += 1
        else:
            town_skip += 1
            print(f"  · town skip: {p.name}", file=sys.stderr)

    dubai_ok = dubai_skip = 0
    for p in dubai_files:
        if rewrite_dubai(p):
            dubai_ok += 1
        else:
            dubai_skip += 1
            print(f"  · dubai skip: {p.name}", file=sys.stderr)

    print(f"town pages:  rewrote={town_ok}  skipped={town_skip}")
    print(f"dubai pages: rewrote={dubai_ok}  skipped={dubai_skip}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
