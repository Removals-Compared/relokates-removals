#!/usr/bin/env python3
"""
Fix the blog URL cascade in one pass:

  1. Rename every blog/YYYY-MM-DD-<slug>.html to blog/<slug>.html.
     The canonicals inside those files already pointed at the date-less
     URL so they're now correct in place. Internal cross-links between
     blog posts that used the date-less URL also start working.

  2. Replace every internal href="/blog/YYYY-MM-DD-..." across the
     repo with href="/blog/..." in case anything still references the
     old form (it usually doesn't, but cheap insurance).

  3. Rewrite sitemap.xml entries: swap any date-prefixed blog URL for
     its date-less equivalent, bump every <lastmod> on a blog entry
     to today.

  4. Rewrite blog page titles: strip the " | Relokates Removals"
     brand suffix. If the title is still over 60 chars after that,
     drop a long colon-subtitle. Targets the 117 over-long blog
     titles flagged in the audit.

  5. Add the one blog post that was missing from sitemap
     (how-to-move-house-in-london-complete-guide).

Run from the repo root: python3 scripts/fix-blog-urls.py
"""

from __future__ import annotations
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BLOG_DIR = ROOT / "blog"
SITEMAP = ROOT / "sitemap.xml"

DATE_PREFIX_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})-(.+)$")
TODAY = date.today().isoformat()


def step(msg: str) -> None:
    print(f"\n  ▸ {msg}")


# ---------- step 1: rename files --------------------------------------------
def rename_blog_files() -> dict[str, str]:
    """Return {old_basename: new_basename} for everything renamed."""
    mapping: dict[str, str] = {}
    for f in sorted(BLOG_DIR.glob("*.html")):
        m = DATE_PREFIX_RE.match(f.name)
        if not m:
            continue
        new_name = m.group(2)
        new_path = BLOG_DIR / new_name
        if new_path.exists():
            print(f"    ! collision: {f.name} would overwrite existing {new_name}; skipping")
            continue
        # Use git mv so history follows the rename.
        result = subprocess.run(
            ["git", "mv", str(f.relative_to(ROOT)), str(new_path.relative_to(ROOT))],
            cwd=ROOT, capture_output=True, text=True,
        )
        if result.returncode != 0:
            # Fall back to plain rename if file isn't tracked yet.
            f.rename(new_path)
        mapping[f.name] = new_name
    return mapping


# ---------- step 2: update internal hrefs -----------------------------------
def fix_internal_hrefs(rename_map: dict[str, str]) -> int:
    """Replace any href to /blog/YYYY-MM-DD-... with /blog/...  Returns count."""
    if not rename_map:
        return 0
    # Build a regex over all old slugs (with date prefix).
    old_slugs = sorted(
        (n[:-5] for n in rename_map.keys()),  # strip .html
        key=len, reverse=True,
    )
    if not old_slugs:
        return 0
    pattern = re.compile(
        r'href="/blog/(' + "|".join(re.escape(s) for s in old_slugs) + r')(\.html)?"'
    )
    replaced = 0
    for f in ROOT.rglob("*.html"):
        if ".git" in str(f):
            continue
        src = f.read_text(encoding="utf-8", errors="ignore")

        def _swap(m: re.Match) -> str:
            nonlocal replaced
            old_slug = m.group(1) + ".html"
            new_basename = rename_map.get(old_slug, old_slug)
            replaced += 1
            return f'href="/blog/{new_basename[:-5]}"'

        new_src = pattern.sub(_swap, src)
        if new_src != src:
            f.write_text(new_src, encoding="utf-8")
    return replaced


# ---------- step 3: sitemap refresh + missing entry -------------------------
MISSING_FROM_SITEMAP = "how-to-move-house-in-london-complete-guide"


def refresh_sitemap(rename_map: dict[str, str]) -> int:
    src = SITEMAP.read_text(encoding="utf-8")
    changes = 0

    # 3a. Swap date-prefixed blog URLs for date-less.
    for old_html, new_html in rename_map.items():
        old_slug = old_html[:-5]
        new_slug = new_html[:-5]
        old_url = f"https://www.relokates.co.uk/blog/{old_slug}"
        new_url = f"https://www.relokates.co.uk/blog/{new_slug}"
        if old_url in src:
            src = src.replace(old_url, new_url)
            changes += 1

    # 3b. Bump every blog lastmod to today.
    src = re.sub(
        r"(<loc>https://www\.relokates\.co\.uk/blog/[^<]+</loc>\s*<lastmod>)[^<]+",
        lambda m: m.group(1) + TODAY,
        src,
    )

    # 3c. Bump lastmod for the major site sections we rewrote today.
    section_re = re.compile(
        r'(<loc>https://www\.relokates\.co\.uk/(?:|index|about|services|areas|contact|faq|'
        r'house-removals|office-removals|man-and-van|packing-services|storage|luxury-removals|'
        r'house-clearance|international-relocation|removals-london|removals-essex|removals-kent|'
        r'removals-west-sussex|removals-dubai|same-day-removals|last-minute-removals|'
        r'weekend-removals|removals/[a-z0-9\-]+|removals-to-dubai/[a-z0-9\-]+)</loc>\s*<lastmod>)[^<]+'
    )
    src = section_re.sub(lambda m: m.group(1) + TODAY, src)

    # 3d. Add the missing blog post.
    missing_url = f"https://www.relokates.co.uk/blog/{MISSING_FROM_SITEMAP}"
    if missing_url not in src:
        # Insert as a new <url> block before </urlset>.
        block = (
            "  <url>\n"
            f"    <loc>{missing_url}</loc>\n"
            f"    <lastmod>{TODAY}</lastmod>\n"
            "    <changefreq>monthly</changefreq>\n"
            "    <priority>0.6</priority>\n"
            "  </url>\n"
        )
        src = src.replace("</urlset>", block + "</urlset>")
        changes += 1

    SITEMAP.write_text(src, encoding="utf-8")
    return changes


# ---------- step 4: blog title rewrites -------------------------------------
TITLE_RE = re.compile(r"<title>([^<]+)</title>")
BRAND_SUFFIX_RE = re.compile(
    r"\s*[|\-]\s*Relokates Removals(?:\s+Blog)?\s*$|\s*[|\-]\s*Relokates\s*$"
)


def shorten_title(t: str) -> str:
    """Strip brand suffix, then if still over 60 chars, drop a colon-subtitle."""
    t = BRAND_SUFFIX_RE.sub("", t).strip()
    if len(t) <= 60:
        return t
    # Drop the colon-subtitle: "Title: Subtitle..." -> "Title".
    if ":" in t:
        prefix = t.split(":", 1)[0].strip()
        if 25 <= len(prefix) <= 60:
            return prefix
    # Otherwise hard-truncate at the last word boundary before 58 chars.
    if len(t) > 60:
        cut = t[:58].rsplit(" ", 1)[0]
        return cut
    return t


def rewrite_blog_titles() -> int:
    n = 0
    for f in BLOG_DIR.glob("*.html"):
        src = f.read_text(encoding="utf-8", errors="ignore")
        m = TITLE_RE.search(src)
        if not m:
            continue
        old = m.group(1)
        new = shorten_title(old)
        if new == old:
            continue
        src = src.replace(f"<title>{old}</title>", f"<title>{new}</title>", 1)
        f.write_text(src, encoding="utf-8")
        n += 1
    return n


# ---------- main ------------------------------------------------------------
def main() -> int:
    step("Renaming date-prefixed blog files")
    rename_map = rename_blog_files()
    print(f"    renamed {len(rename_map)} file(s)")

    step("Updating internal hrefs to use new URLs")
    href_fixes = fix_internal_hrefs(rename_map)
    print(f"    rewrote {href_fixes} href reference(s)")

    step("Refreshing sitemap.xml (URLs + lastmod + missing entry)")
    sitemap_changes = refresh_sitemap(rename_map)
    print(f"    {sitemap_changes} explicit sitemap change(s); all blog lastmods bumped to {TODAY}")

    step("Rewriting over-long blog titles")
    titles_fixed = rewrite_blog_titles()
    print(f"    rewrote {titles_fixed} title(s)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
