#!/usr/bin/env python3
"""
Generate a branded Relokates Removals quote PDF.

This is the first version, hard-coded for Anna Espinosa's quote
(ref 14393140) but structured so the data block at the top can be
swapped to produce any future quote.

Run:  python3 scripts/generate-quote-pdf.py
Out:  quotes/Relokates-Quote-<ref>-<customer-slug>.pdf

Dependencies: reportlab, pillow, pypdf
"""

from __future__ import annotations
import json
import os
import re
import sys
from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

# ---------------------------------------------------------------- BRAND -----
NAVY = HexColor("#1A3C6E")
GOLD = HexColor("#B8932A")
CREAM = HexColor("#F4F8F6")
TEAL = HexColor("#A8C5BC")
MUTED = HexColor("#556070")
BORDER = HexColor("#C8DDD8")
WHITE = HexColor("#FFFFFF")
BLACK = HexColor("#000000")

# ---------------------------------------------------------------- DATA -----
# Quotes are loaded from JSON to keep customer PII out of git.
# Default lookup:
#   quotes/data/<ref>.json   (where <ref> is the first CLI arg or env var)
#
# Run:
#   python3 scripts/generate-quote-pdf.py 14393140
#   python3 scripts/generate-quote-pdf.py quotes/data/14393140.json
#
# A template lives at quotes/data/_template.example.json (committed).
# Real customer data files (quotes/data/<digits>.json) and PDFs in
# quotes/*.pdf are .gitignored.

ROOT = Path(__file__).resolve().parent.parent
LOGO_PATH = ROOT / "images" / "logo.png"
OUT_DIR = ROOT / "quotes"
DATA_DIR = OUT_DIR / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def slug(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-")


def load_quote(arg: str | None) -> dict:
    """Resolve the data file from a quote ref or an explicit path."""
    if arg is None:
        # No arg: look for a single non-template file in quotes/data/
        candidates = [p for p in DATA_DIR.glob("*.json")
                      if not p.name.startswith("_")]
        if len(candidates) != 1:
            raise SystemExit(
                "Pass a quote ref or path. Found "
                f"{len(candidates)} candidate(s) in quotes/data/."
            )
        path = candidates[0]
    else:
        p = Path(arg)
        path = p if p.exists() else DATA_DIR / f"{arg}.json"
    if not path.exists():
        raise SystemExit(f"No quote data file at {path}")
    return json.loads(path.read_text(encoding="utf-8"))


_arg = sys.argv[1] if len(sys.argv) > 1 else None
QUOTE = load_quote(_arg)

OUT_PATH = OUT_DIR / f"Relokates-Quote-{QUOTE['ref']}-{slug(QUOTE['customer']['name'])}.pdf"

# A4 page geometry --------------------------------------------------- LAYOUT
PAGE_W, PAGE_H = A4  # 595.27 x 841.89 pt
MARGIN = 36         # 12.7mm
CONTENT_W = PAGE_W - 2 * MARGIN
GUTTER = 14
COL_W = (CONTENT_W - GUTTER) / 2


# Helper: text writer ------------------------------------------------ HELPERS
def draw_text(c, x, y, text, font="Helvetica", size=10, color=BLACK):
    c.setFont(font, size)
    c.setFillColor(color)
    c.drawString(x, y, str(text))


def draw_text_right(c, x, y, text, font="Helvetica", size=10, color=BLACK):
    c.setFont(font, size)
    c.setFillColor(color)
    c.drawRightString(x, y, str(text))


def draw_box(c, x, y, w, h, fill=None, stroke=None, stroke_w=0.6, radius=6):
    if fill is None and stroke is None:
        return
    c.saveState()
    if stroke is not None:
        c.setStrokeColor(stroke)
        c.setLineWidth(stroke_w)
    if fill is not None:
        c.setFillColor(fill)
    c.roundRect(x, y, w, h, radius, fill=1 if fill else 0, stroke=1 if stroke else 0)
    c.restoreState()


def draw_rule(c, x1, y, x2, color=BORDER, width=0.6):
    c.setStrokeColor(color)
    c.setLineWidth(width)
    c.line(x1, y, x2, y)


# Renderers --------------------------------------------------------- LAYOUTS
def render_header(c, y_top):
    """Header band with logo left, contact right, gold rule beneath."""
    # Logo
    if LOGO_PATH.exists():
        img = ImageReader(str(LOGO_PATH))
        iw, ih = img.getSize()
        target_h = 44
        scale = target_h / ih
        target_w = iw * scale
        c.drawImage(
            img, MARGIN, y_top - target_h,
            width=target_w, height=target_h, mask="auto",
        )

    # Right-aligned contact block
    rx = PAGE_W - MARGIN
    y = y_top - 10
    lines = [
        ("Relokates Removals", "Helvetica-Bold", 10, NAVY),
        ("07359 724844",      "Helvetica",      9,  MUTED),
        ("info@relokates.co.uk", "Helvetica",   9,  MUTED),
        ("www.relokates.co.uk", "Helvetica",    9,  MUTED),
    ]
    for txt, font, size, color in lines:
        draw_text_right(c, rx, y, txt, font, size, color)
        y -= 12

    # Gold rule
    rule_y = y_top - 56
    c.setStrokeColor(GOLD)
    c.setLineWidth(2)
    c.line(MARGIN, rule_y, PAGE_W - MARGIN, rule_y)
    return rule_y


def render_title_block(c, y_top):
    """REMOVAL QUOTE heading + ref/date meta row."""
    draw_text(c, MARGIN, y_top - 22, "REMOVAL QUOTE", "Helvetica-Bold", 22, NAVY)
    y = y_top - 46
    # left col
    draw_text(c, MARGIN,              y,         "Quote Reference",   "Helvetica",      8, MUTED)
    draw_text(c, MARGIN,              y - 12,    QUOTE["ref"],        "Helvetica-Bold", 11, NAVY)
    draw_text(c, MARGIN + 130,        y,         "Customer Reference","Helvetica",      8, MUTED)
    draw_text(c, MARGIN + 130,        y - 12,    QUOTE["customer_ref"], "Helvetica",   11, NAVY)
    # right col - push Quote Date further left so it can't collide with Valid Until
    rx_label = PAGE_W - MARGIN - 200
    draw_text(c, rx_label,            y,         "Quote Date",        "Helvetica",      8, MUTED)
    draw_text(c, rx_label,            y - 12,    QUOTE["date"],       "Helvetica-Bold", 11, NAVY)
    draw_text_right(c, PAGE_W - MARGIN, y,       "Valid Until",       "Helvetica",      8, MUTED)
    draw_text_right(c, PAGE_W - MARGIN, y - 12,  QUOTE["valid_until"],"Helvetica-Bold", 11, NAVY)
    return y - 32


def render_two_cards(c, y_top, height, left_title, left_lines, right_title, right_lines, fill=None, stroke=None):
    """Generic two-card row. Returns y at bottom of cards."""
    # Left card
    draw_box(c, MARGIN, y_top - height, COL_W, height, fill=fill, stroke=stroke)
    draw_text(c, MARGIN + 14, y_top - 18, left_title.upper(), "Helvetica-Bold", 8, NAVY)
    ly = y_top - 36
    for line, font, size, color in left_lines:
        draw_text(c, MARGIN + 14, ly, line, font, size, color)
        ly -= 14

    # Right card
    rx = MARGIN + COL_W + GUTTER
    draw_box(c, rx, y_top - height, COL_W, height, fill=fill, stroke=stroke)
    draw_text(c, rx + 14, y_top - 18, right_title.upper(), "Helvetica-Bold", 8, NAVY)
    ry = y_top - 36
    for line, font, size, color in right_lines:
        draw_text(c, rx + 14, ry, line, font, size, color)
        ry -= 14
    return y_top - height


def render_customer_and_move(c, y_top):
    left_lines = [
        (QUOTE["customer"]["name"],  "Helvetica-Bold", 12, NAVY),
        (QUOTE["customer"]["email"], "Helvetica",      10, MUTED),
        (QUOTE["customer"]["phone"], "Helvetica",      10, MUTED),
    ]
    right_lines = [
        ("Move date: " + QUOTE["move"]["date"],          "Helvetica", 10, BLACK),
        ("Move type: " + QUOTE["move"]["type"],          "Helvetica", 10, BLACK),
        ("Distance: " + QUOTE["move"]["distance"],       "Helvetica", 10, BLACK),
        ("Category: " + QUOTE["move"]["category"],       "Helvetica", 10, BLACK),
    ]
    return render_two_cards(c, y_top, 84, "Customer", left_lines, "Move details", right_lines, fill=CREAM)


def render_from_to(c, y_top):
    left_lines = [(a, "Helvetica", 10, BLACK) for a in QUOTE["from_addr"]]
    right_lines = [(a, "Helvetica", 10, BLACK) for a in QUOTE["to_addr"]]
    return render_two_cards(c, y_top, 86, "Collection address", left_lines, "Delivery address", right_lines, stroke=NAVY)


def render_inventory(c, y_top):
    """Full-width inventory, 2 columns of bullets."""
    items = QUOTE["inventory"]
    # Two columns; first half left, second half right.
    half = (len(items) + 1) // 2
    left = items[:half]
    right = items[half:]
    rows = max(len(left), len(right))

    line_h = 13
    pad_top = 36
    pad_bottom = 16
    height = pad_top + rows * line_h + pad_bottom

    draw_box(c, MARGIN, y_top - height, CONTENT_W, height, fill=CREAM)
    draw_text(c, MARGIN + 14, y_top - 18, "INVENTORY TO BE MOVED", "Helvetica-Bold", 8, NAVY)

    col_x = [MARGIN + 14, MARGIN + 14 + COL_W]
    y = y_top - pad_top
    for i in range(rows):
        for col_i, col in enumerate([left, right]):
            if i < len(col):
                draw_text(c, col_x[col_i], y, "- " + col[i], "Helvetica", 10, BLACK)
        y -= line_h
    return y_top - height


def render_costs(c, y_top):
    """Cost breakdown table with gold TOTAL row."""
    row_h = 18
    cost_rows = QUOTE["costs"]
    n_rows = len(cost_rows)
    # Title + cost rows + separator + subtotal + vat + separator + total + footnote
    height = 24 + n_rows * row_h + 12 + 2 * row_h + 12 + 26 + 22

    draw_box(c, MARGIN, y_top - height, CONTENT_W, height, fill=WHITE, stroke=BORDER)
    draw_text(c, MARGIN + 14, y_top - 18, "COST BREAKDOWN", "Helvetica-Bold", 8, NAVY)

    y = y_top - 36
    # Column header
    draw_text(c, MARGIN + 14, y, "Description", "Helvetica-Bold", 9, MUTED)
    draw_text_right(c, PAGE_W - MARGIN - 14, y, "Amount", "Helvetica-Bold", 9, MUTED)
    y -= 6
    draw_rule(c, MARGIN + 14, y, PAGE_W - MARGIN - 14, BORDER, 0.5)
    y -= 14

    for desc, amt in cost_rows:
        draw_text(c, MARGIN + 14, y, desc, "Helvetica", 10, BLACK)
        draw_text_right(c, PAGE_W - MARGIN - 14, y, amt, "Helvetica", 10, BLACK)
        y -= row_h

    # separator
    y += 4
    draw_rule(c, MARGIN + 14, y, PAGE_W - MARGIN - 14, BORDER, 0.6)
    y -= 16

    # Subtotal
    draw_text(c, MARGIN + 14, y, "Subtotal", "Helvetica-Bold", 10, NAVY)
    draw_text_right(c, PAGE_W - MARGIN - 14, y, QUOTE["subtotal"], "Helvetica-Bold", 10, NAVY)
    y -= row_h
    # VAT row - shows "Not applicable" or "Not charged" cleanly for non-VAT-registered businesses
    draw_text(c, MARGIN + 14, y, "VAT", "Helvetica", 10, BLACK)
    draw_text_right(c, PAGE_W - MARGIN - 14, y, QUOTE["vat"], "Helvetica", 10, BLACK)
    y -= row_h

    # Total band in gold
    total_band_h = 26
    draw_box(c, MARGIN + 14, y - total_band_h + 6, CONTENT_W - 28, total_band_h, fill=GOLD)
    draw_text(c, MARGIN + 14 + 14, y - total_band_h + 6 + 9, "TOTAL (fixed price)", "Helvetica-Bold", 12, WHITE)
    draw_text_right(c, PAGE_W - MARGIN - 14 - 14, y - total_band_h + 6 + 9, QUOTE["total"], "Helvetica-Bold", 14, WHITE)
    y -= total_band_h + 6

    # Footnote
    draw_text(c, MARGIN + 14, y - 6,
              "All prices in GBP. Quote is a fixed price - no surprise charges on moving day.",
              "Helvetica-Oblique", 9, MUTED)
    return y_top - height


def render_trust_badges(c, y_top):
    """Three trust badges in a row, cream backgrounds."""
    badges = [
        ("Fully insured", "Goods-in-transit + public liability"),
        ("Fixed price", "No hidden charges"),
        ("5-star rated", "Verified Google reviews"),
    ]
    h = 52
    gap = 10
    bw = (CONTENT_W - 2 * gap) / 3
    for i, (title, sub) in enumerate(badges):
        x = MARGIN + i * (bw + gap)
        draw_box(c, x, y_top - h, bw, h, fill=CREAM)
        draw_text(c, x + 14, y_top - 22, title, "Helvetica-Bold", 11, NAVY)
        draw_text(c, x + 14, y_top - 38, sub, "Helvetica", 8.5, MUTED)
    return y_top - h


def render_terms(c, y_top):
    """Terms & notes section, small text."""
    terms = [
        "This quote is valid for 28 days from the date of issue.",
        "A small deposit secures your moving date. Balance due on completion of the move.",
        "Free rescheduling subject to availability if your completion date changes.",
        "Quote based on the inventory and access information provided. Material changes may require a revised quote.",
        "Cancellations within 48 hours of the move may incur a charge.",
    ]
    draw_text(c, MARGIN, y_top - 0, "TERMS & NOTES", "Helvetica-Bold", 8, NAVY)
    y = y_top - 16
    for t in terms:
        draw_text(c, MARGIN, y, "- " + t, "Helvetica", 9, MUTED)
        y -= 12
    return y - 4


def render_acceptance(c, y_top):
    """Acceptance / next steps cream block."""
    h = 52
    draw_box(c, MARGIN, y_top - h, CONTENT_W, h, fill=CREAM)
    draw_text(c, MARGIN + 14, y_top - 20, "TO ACCEPT THIS QUOTE", "Helvetica-Bold", 9, NAVY)
    draw_text(c, MARGIN + 14, y_top - 36,
              "Call 07359 724844 or reply to this email to confirm. We will send a booking confirmation and deposit invoice the same day.",
              "Helvetica", 9, BLACK)
    return y_top - h


def render_footer(c):
    """Centred footer, thin gold rule above."""
    y_rule = 70
    c.setStrokeColor(GOLD)
    c.setLineWidth(1)
    c.line(MARGIN, y_rule, PAGE_W - MARGIN, y_rule)
    lines = [
        ("Relokates Removals - Registered in England & Wales", "Helvetica-Bold", 8, MUTED),
        ("Company Registration No.: 13441775  |  Not VAT registered", "Helvetica", 7.5, MUTED),
        ("Registered Address: [to be inserted]", "Helvetica", 7.5, MUTED),
        ("Phone: 07359 724844  |  Email: info@relokates.co.uk  |  Web: www.relokates.co.uk", "Helvetica", 7.5, MUTED),
    ]
    y = y_rule - 14
    cx = PAGE_W / 2
    for txt, font, size, color in lines:
        c.setFont(font, size)
        c.setFillColor(color)
        c.drawCentredString(cx, y, txt)
        y -= 11


# ----------------------------------------------------------------- BUILD ----
def build_pdf(path: Path) -> None:
    c = canvas.Canvas(
        str(path),
        pagesize=A4,
        pageCompression=1,
    )
    c.setTitle(f"Removal Quote {QUOTE['ref']} - {QUOTE['customer']['name']}")
    c.setAuthor("Relokates Removals")
    c.setSubject(f"Removal Quote for {QUOTE['customer']['name']}")
    c.setCreator("Relokates Removals Quote System")
    c.setProducer("Relokates Removals")

    # ----- PAGE 1 -----
    y = PAGE_H - MARGIN
    y = render_header(c, y)
    y -= 18
    y = render_title_block(c, y)
    y -= 12
    y = render_customer_and_move(c, y)
    y -= 12
    y = render_from_to(c, y)
    y -= 14
    y = render_inventory(c, y)

    # Cost breakdown - if not enough room, push to page 2
    needed = 220 + 60 + 90 + 70 + 70  # costs + trust + terms + acceptance + footer
    if y - needed < 90:
        c.showPage()
        # Header band on page 2 (compact)
        y = PAGE_H - MARGIN
        y = render_header(c, y)
        y -= 18
        # Mini title showing this is continuation
        draw_text(c, MARGIN, y - 8, f"REMOVAL QUOTE - continued (Ref {QUOTE['ref']})",
                  "Helvetica-Bold", 13, NAVY)
        y -= 24

    y = render_costs(c, y)
    y -= 16
    y = render_trust_badges(c, y)
    y -= 18
    y = render_terms(c, y)
    y -= 10
    render_acceptance(c, y)
    render_footer(c)

    c.save()


def harden_pdf(path: Path) -> None:
    """Set restrictive permissions (no editing/copying, printing allowed)."""
    try:
        from pypdf import PdfReader, PdfWriter
    except ImportError:
        os.system("pip3 install --quiet pypdf")
        from pypdf import PdfReader, PdfWriter

    reader = PdfReader(str(path))
    writer = PdfWriter(clone_from=reader)
    # Copy metadata too
    writer.add_metadata({
        "/Title":   f"Removal Quote {QUOTE['ref']} - {QUOTE['customer']['name']}",
        "/Author":  "Relokates Removals",
        "/Subject": f"Removal Quote for {QUOTE['customer']['name']}",
        "/Creator": "Relokates Removals Quote System",
        "/Producer": "Relokates Removals",
    })
    # Encrypt with owner password but blank user password so the document
    # opens without a password but cannot be modified/copied.
    writer.encrypt(
        user_password="",
        owner_password=f"relokates-{QUOTE['ref']}",
        permissions_flag=4,  # PRINT_LOW only; no modify/copy/annotate
        use_128bit=True,
    )
    with open(path, "wb") as f:
        writer.write(f)


def main() -> int:
    build_pdf(OUT_PATH)
    harden_pdf(OUT_PATH)
    size = OUT_PATH.stat().st_size
    print(f"PDF written: {OUT_PATH}")
    print(f"Size:        {size:,} bytes")
    print(f"Library:     reportlab (canvas) + pypdf (permissions)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
