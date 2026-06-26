#!/usr/bin/env python3
"""
Idempotent on-page SEO fixer for Relokates location pages.

Adds, only when missing:
  - og:image, og:type (Open Graph completeness)
  - twitter:card + twitter:title/description/image
  - BreadcrumbList JSON-LD (derived from each page's existing visual breadcrumb nav)
For Dubai pages that have no Open Graph tags at all, the full OG set is added.

Run from repo root:  python3 scripts/fix-onpage-seo.py
"""
import re
import sys
import glob
import html

SITE = "https://www.relokates.co.uk"

NAV_RE = re.compile(r'<nav class="breadcrumb"[^>]*>(.*?)</nav>', re.S)
LI_RE = re.compile(r'<li>(.*?)</li>', re.S)
LINK_RE = re.compile(r'<a\s+href="([^"]*)">(.*?)</a>', re.S)
CANON_RE = re.compile(r'rel="canonical"\s+href="([^"]*)"')
TITLE_RE = re.compile(r'<title>(.*?)</title>', re.S)
DESC_RE = re.compile(r'<meta name="description" content="([^"]*)"')
OG_TITLE_RE = re.compile(r'<meta property="og:title" content="([^"]*)"')
OG_DESC_RE = re.compile(r'<meta property="og:description" content="([^"]*)"')
OG_URL_TAG_RE = re.compile(r'(<meta property="og:url" content="[^"]*">)')


def abs_url(href, canonical):
    href = href.strip()
    if href.startswith("http"):
        return href
    if href.startswith("/"):
        return SITE + href
    # relative – resolve against canonical dir
    base = canonical.rsplit("/", 1)[0]
    return base + "/" + href


def build_breadcrumb(content, canonical):
    """Convert the visual <nav class="breadcrumb"> into BreadcrumbList JSON-LD."""
    m = NAV_RE.search(content)
    if not m:
        return None
    items = []
    pos = 1
    for li in LI_RE.findall(m.group(1)):
        link = LINK_RE.search(li)
        if link:
            href, text = link.group(1), link.group(2)
            url = abs_url(href, canonical)
        else:
            text = li
            url = canonical  # current page (last crumb)
        text = re.sub(r"<[^>]+>", "", text).strip()
        items.append(
            '{"@type":"ListItem","position":%d,"name":"%s","item":"%s"}'
            % (pos, text, url)
        )
        pos += 1
    if len(items) < 2:
        return None
    return (
        '<script type="application/ld+json">'
        '{"@context":"https://schema.org","@type":"BreadcrumbList",'
        '"itemListElement":[' + ",".join(items) + "]}</script>"
    )


def process(path, default_img):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    original = content

    canon_m = CANON_RE.search(content)
    if not canon_m:
        return "skip-no-canonical"
    canonical = canon_m.group(1)

    title_m = TITLE_RE.search(content)
    desc_m = DESC_RE.search(content)
    title = title_m.group(1).strip() if title_m else "Relokates Removals"
    desc = desc_m.group(1).strip() if desc_m else ""

    og_title = OG_TITLE_RE.search(content)
    og_title = og_title.group(1) if og_title else title
    og_desc = OG_DESC_RE.search(content)
    og_desc = og_desc.group(1) if og_desc else desc

    # ---- Open Graph ----
    if 'property="og:url"' in content:
        # Town pages: have og:url, append image/type after it.
        anchor = OG_URL_TAG_RE.search(content)
        additions = ""
        if 'property="og:image"' not in content:
            additions += '\n<meta property="og:image" content="%s/images/%s">' % (SITE, default_img)
        if 'property="og:type"' not in content:
            additions += '\n<meta property="og:type" content="website">'
        if additions and anchor:
            content = content.replace(anchor.group(1), anchor.group(1) + additions, 1)
    else:
        # Dubai pages: no OG at all – insert full set after canonical link.
        canon_tag_m = re.search(r'(<link rel="canonical" href="[^"]*">)', content)
        if canon_tag_m:
            og_block = (
                '\n<meta property="og:title" content="%s">' % og_title
                + '\n<meta property="og:description" content="%s">' % og_desc
                + '\n<meta property="og:url" content="%s">' % canonical
                + '\n<meta property="og:image" content="%s/images/%s">' % (SITE, default_img)
                + '\n<meta property="og:type" content="website">'
            )
            content = content.replace(canon_tag_m.group(1), canon_tag_m.group(1) + og_block, 1)

    # ---- Twitter Card ----
    if 'twitter:card' not in content:
        tw_block = (
            '\n<meta name="twitter:card" content="summary_large_image">'
            + '\n<meta name="twitter:title" content="%s">' % og_title
            + '\n<meta name="twitter:description" content="%s">' % og_desc
            + '\n<meta name="twitter:image" content="%s/images/%s">' % (SITE, default_img)
        )
        # place right before </head>
        content = content.replace("</head>", tw_block + "\n</head>", 1)

    # ---- BreadcrumbList JSON-LD ----
    if "BreadcrumbList" not in content:
        bc = build_breadcrumb(content, canonical)
        if bc:
            content = content.replace("</head>", bc + "\n</head>", 1)

    if content != original:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return "fixed"
    return "unchanged"


def main():
    targets = [("removals/*.html", "hero-home.webp"),
               ("removals-to-dubai/*.html", "dubai-strip.webp")]
    summary = {}
    for pattern, img in targets:
        files = sorted(glob.glob(pattern))
        counts = {}
        for fp in files:
            r = process(fp, img)
            counts[r] = counts.get(r, 0) + 1
        summary[pattern] = (len(files), counts)
    for pattern, (n, counts) in summary.items():
        print(f"{pattern}: {n} files -> {counts}")


if __name__ == "__main__":
    main()
