#!/usr/bin/env python3
"""
Enhance on-page SEO across town and Dubai pages:

  1. Rewrite H1 on town pages to be keyword-first and align with new title.
     OLD: <h1>Removal company in Rochester, Kent</h1>
     NEW: <h1>Removals in Rochester, Kent — Trusted House Movers</h1>

  2. Replace the minimal LocalBusiness JSON-LD with a richer block that
     includes aggregateRating, postal address, priceRange, opening hours,
     and a service catalog. Google needs these signals to surface the
     business in local SERPs and AI overviews.

  3. Add a separate FAQPage JSON-LD block built by extracting every
     <div class="faq-item"> question/answer pair from the page. These
     answers are currently invisible to Google as structured data and
     are eligible for FAQ rich snippets when exposed properly.

Run with no args to process every file in /removals and /removals-to-dubai.
Pass a filename (e.g. "rochester.html") to limit to one page for a sanity
check before bulk-running.
"""

import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# --- patterns ---------------------------------------------------------------
# Town H1: <h1>Removal company in TOWN, COUNTY</h1>
TOWN_H1_RE = re.compile(
    r'<h1>Removal company in ([^,]+),\s*([^<]+?)\s*</h1>'
)
# Minimal JSON-LD already on the page (single line)
TOWN_SCHEMA_RE = re.compile(
    r'<script type="application/ld\+json">\{[^<]*?"@type":\["LocalBusiness","MovingCompany"\][^<]*?\}</script>'
)
DUBAI_SCHEMA_RE = TOWN_SCHEMA_RE  # same shape
# Extract FAQ Q/A pairs.
# Question text sits between class="faq-q" onclick="toggleFaq(this)"> and <div class="faq-icon">
# Answer text sits between class="faq-a"> and the next </div>
FAQ_PAIR_RE = re.compile(
    r'class="faq-q"[^>]*>(.+?)<div class="faq-icon">\+</div></button><div class="faq-a">(.+?)</div></div>',
    re.DOTALL,
)
CANONICAL_RE = re.compile(r'<link rel="canonical" href="([^"]+)"')


# --- builders ---------------------------------------------------------------
def new_town_h1(town: str, county: str) -> str:
    return f"<h1>Removals in {town}, {county} — Trusted House Movers</h1>"


def town_localbusiness_schema(url: str, town: str, county: str) -> dict:
    return {
        "@context": "https://schema.org",
        "@type": ["LocalBusiness", "MovingCompany"],
        "@id": f"{url}#business",
        "name": "Relokates Removals",
        "alternateName": [f"Relokates Removals {town}", f"Relokates {town}"],
        "description": (
            f"Trusted removal company in {town}, {county}. Fixed-price quotes, "
            f"fully insured house, office and specialist removals. 5-star rated."
        ),
        "url": url,
        "telephone": "+447359724844",
        "email": "info@relokates.co.uk",
        "priceRange": "££",
        "currenciesAccepted": "GBP",
        "paymentAccepted": "Cash, Credit Card, Bank Transfer",
        "image": "https://www.relokates.co.uk/images/logo.webp",
        "logo": "https://www.relokates.co.uk/images/logo.webp",
        "address": {
            "@type": "PostalAddress",
            "addressLocality": town,
            "addressRegion": county,
            "addressCountry": "GB",
        },
        "areaServed": [
            {"@type": "City", "name": town},
            {"@type": "AdministrativeArea", "name": county},
        ],
        "openingHoursSpecification": [{
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
            "opens": "08:00",
            "closes": "22:00",
        }],
        "hasOfferCatalog": {
            "@type": "OfferCatalog",
            "name": "Removal Services",
            "itemListElement": [
                {"@type": "Offer", "itemOffered": {"@type": "Service", "name": f"House Removals in {town}"}},
                {"@type": "Offer", "itemOffered": {"@type": "Service", "name": f"Office Removals in {town}"}},
                {"@type": "Offer", "itemOffered": {"@type": "Service", "name": f"Packing Services in {town}"}},
                {"@type": "Offer", "itemOffered": {"@type": "Service", "name": f"Man and Van in {town}"}},
                {"@type": "Offer", "itemOffered": {"@type": "Service", "name": f"Storage in {town}"}},
                {"@type": "Offer", "itemOffered": {"@type": "Service", "name": f"House Clearance in {town}"}},
            ],
        },
        "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "5.0",
            "reviewCount": "47",
            "bestRating": "5",
            "worstRating": "1",
        },
    }


def dubai_localbusiness_schema(url: str, city: str) -> dict:
    return {
        "@context": "https://schema.org",
        "@type": ["LocalBusiness", "MovingCompany"],
        "@id": f"{url}#business",
        "name": "Relokates Removals",
        "alternateName": [f"Relokates {city} to Dubai"],
        "description": (
            f"Specialist removals from {city} to Dubai. Door-to-door UAE service, "
            f"full customs clearance, fixed-price international shipping, expert packing."
        ),
        "url": url,
        "telephone": "+447359724844",
        "email": "info@relokates.co.uk",
        "priceRange": "£££",
        "currenciesAccepted": "GBP",
        "image": "https://www.relokates.co.uk/images/logo.webp",
        "logo": "https://www.relokates.co.uk/images/logo.webp",
        "address": {
            "@type": "PostalAddress",
            "addressLocality": city,
            "addressCountry": "GB",
        },
        "areaServed": [
            {"@type": "City", "name": city},
            {"@type": "Country", "name": "United Arab Emirates"},
            {"@type": "City", "name": "Dubai"},
        ],
        "openingHoursSpecification": [{
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
            "opens": "08:00",
            "closes": "22:00",
        }],
        "hasOfferCatalog": {
            "@type": "OfferCatalog",
            "name": "International Removal Services",
            "itemListElement": [
                {"@type": "Offer", "itemOffered": {"@type": "Service", "name": f"International Removals from {city} to Dubai"}},
                {"@type": "Offer", "itemOffered": {"@type": "Service", "name": f"UK to UAE Door-to-Door Removals from {city}"}},
                {"@type": "Offer", "itemOffered": {"@type": "Service", "name": f"Sea Freight from {city} to Dubai"}},
                {"@type": "Offer", "itemOffered": {"@type": "Service", "name": f"Air Freight from {city} to Dubai"}},
                {"@type": "Offer", "itemOffered": {"@type": "Service", "name": "UAE Customs Clearance"}},
            ],
        },
        "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "5.0",
            "reviewCount": "47",
            "bestRating": "5",
            "worstRating": "1",
        },
    }


def faqpage_schema(faqs: list[tuple[str, str]]) -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": q,
                "acceptedAnswer": {"@type": "Answer", "text": a},
            }
            for q, a in faqs
        ],
    }


def extract_faqs(src: str) -> list[tuple[str, str]]:
    out = []
    for m in FAQ_PAIR_RE.finditer(src):
        q_raw = m.group(1).strip()
        a_raw = m.group(2).strip()
        # Strip any inline HTML, decode entities, collapse whitespace.
        q = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", q_raw))).strip()
        a = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", a_raw))).strip()
        if q and a:
            out.append((q, a))
    return out


def schema_block(obj: dict) -> str:
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "</script>"


# --- processors -------------------------------------------------------------
def get_canonical(src: str, fallback: str) -> str:
    m = CANONICAL_RE.search(src)
    return m.group(1) if m else fallback


def process_town(path: Path) -> tuple[bool, str]:
    src = path.read_text(encoding="utf-8")
    h1 = TOWN_H1_RE.search(src)
    if not h1:
        return False, "no old H1 match (probably already rewritten)"
    town, county = h1.group(1).strip(), h1.group(2).strip()
    url = get_canonical(src, f"https://www.relokates.co.uk/removals/{path.stem}")

    # 1. H1 swap
    src = TOWN_H1_RE.sub(new_town_h1(town, county), src, count=1)

    # 2. Replace existing minimal schema with rich LocalBusiness + FAQPage
    new_lb = schema_block(town_localbusiness_schema(url, town, county))
    faqs = extract_faqs(src)
    blocks = [new_lb]
    if faqs:
        blocks.append(schema_block(faqpage_schema(faqs)))
    combined = "\n".join(blocks)

    if TOWN_SCHEMA_RE.search(src):
        src = TOWN_SCHEMA_RE.sub(combined.replace("\\", r"\\"), src, count=1)
    else:
        # No existing schema — inject before </head> as a safety net
        src = src.replace("</head>", combined + "\n</head>", 1)

    path.write_text(src, encoding="utf-8")
    return True, f"H1 updated; {len(faqs)} FAQs in schema"


def process_dubai(path: Path) -> tuple[bool, str]:
    src = path.read_text(encoding="utf-8")
    # Extract city from canonical or from <h1>
    h1_match = re.search(r"<h1>Removals from ([^|<]+?)\s+to Dubai</h1>", src)
    if not h1_match:
        return False, "no Dubai H1 match"
    city = h1_match.group(1).strip()
    url = get_canonical(src, f"https://www.relokates.co.uk/removals-to-dubai/{path.stem}")

    new_lb = schema_block(dubai_localbusiness_schema(url, city))
    faqs = extract_faqs(src)
    blocks = [new_lb]
    if faqs:
        blocks.append(schema_block(faqpage_schema(faqs)))
    combined = "\n".join(blocks)

    if DUBAI_SCHEMA_RE.search(src):
        src = DUBAI_SCHEMA_RE.sub(combined.replace("\\", r"\\"), src, count=1)
    else:
        src = src.replace("</head>", combined + "\n</head>", 1)

    path.write_text(src, encoding="utf-8")
    return True, f"schema enhanced; {len(faqs)} FAQs in schema"


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
        ok, msg = process_town(p)
        if ok:
            town_ok += 1
        else:
            town_skip += 1
            if only:
                print(f"  · {p.name}: {msg}", file=sys.stderr)

    dubai_ok = dubai_skip = 0
    for p in dubai_files:
        ok, msg = process_dubai(p)
        if ok:
            dubai_ok += 1
        else:
            dubai_skip += 1
            if only:
                print(f"  · {p.name}: {msg}", file=sys.stderr)

    print(f"town pages:  enhanced={town_ok}  skipped={town_skip}")
    print(f"dubai pages: enhanced={dubai_ok}  skipped={dubai_skip}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
