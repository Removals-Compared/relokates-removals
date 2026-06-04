# GSC Reindex Priority List

After the title/description rewrite (commit `d997dbc`), submit these URLs
for reindexing in Google Search Console to accelerate the new snippets
appearing in search results. GSC limit is roughly 10-12 manual requests
per day — work top-down.

## How to submit (60 seconds per URL)
1. Open https://search.google.com/search-console
2. Top search bar: paste the full URL (e.g. `https://www.relokates.co.uk/removals/rochester`)
3. Click **"Request Indexing"**
4. Wait ~30 seconds for the live URL test to finish, then submit
5. Move to the next URL

---

## Tier 1 — Submit today (highest impact)

These pages have proven impressions in your GSC data. New CTR-optimized
snippets here = direct clicks within 1-2 weeks of re-crawl.

| # | URL | Why |
|---|-----|-----|
| 1 | https://www.relokates.co.uk/ | Homepage — fixes the 20% branded CTR |
| 2 | https://www.relokates.co.uk/removals/rochester | 265 impressions, position 4.2, was 0.4% CTR |
| 3 | https://www.relokates.co.uk/removals/maidstone | 28 impressions, position ~5, was 3.5% CTR |
| 4 | https://www.relokates.co.uk/removals/margate | 29 impressions, was 3.4% CTR |
| 5 | https://www.relokates.co.uk/removals/strood | "house removals strood" keyword |
| 6 | https://www.relokates.co.uk/removals-london | Highest-volume county target |
| 7 | https://www.relokates.co.uk/removals-kent | Rochester sits in Kent — strengthens cluster |
| 8 | https://www.relokates.co.uk/removals-essex | High-value county target |
| 9 | https://www.relokates.co.uk/removals-west-sussex | High-value county target |
| 10 | https://www.relokates.co.uk/removals-dubai | "London to Dubai" is your differentiator |

## Tier 2 — Submit tomorrow

Major service pages — these capture intent searches ("house removals",
"office removals", "man and van") that aren't location-bound.

| # | URL |
|---|-----|
| 11 | https://www.relokates.co.uk/house-removals |
| 12 | https://www.relokates.co.uk/office-removals |
| 13 | https://www.relokates.co.uk/man-and-van |
| 14 | https://www.relokates.co.uk/packing-services |
| 15 | https://www.relokates.co.uk/storage |
| 16 | https://www.relokates.co.uk/luxury-removals |
| 17 | https://www.relokates.co.uk/house-clearance |
| 18 | https://www.relokates.co.uk/international-relocation |
| 19 | https://www.relokates.co.uk/services |
| 20 | https://www.relokates.co.uk/areas |

## Tier 3 — Spread across days 3-7

Top town pages by likely commercial value. Submit ~10 per day.

**London boroughs** (high search volume, high competition):
- /removals/croydon
- /removals/bromley
- /removals/greenwich
- /removals/lewisham
- /removals/bexley
- /removals/hackney
- /removals/camden
- /removals/islington
- /removals/wandsworth
- /removals/southwark

**Kent towns** (mid volume, mid competition — Rochester is here):
- /removals/canterbury
- /removals/dartford
- /removals/gravesend
- /removals/sevenoaks
- /removals/tunbridge-wells
- /removals/chatham
- /removals/ashford
- /removals/folkestone
- /removals/tonbridge
- /removals/dover

**Essex towns**:
- /removals/chelmsford
- /removals/basildon
- /removals/colchester
- /removals/southend-on-sea
- /removals/grays
- /removals/brentwood
- /removals/harlow
- /removals/romford
- /removals/billericay
- /removals/rayleigh

**West Sussex**:
- /removals/chichester
- /removals/crawley
- /removals/horsham
- /removals/worthing
- /removals/bognor-regis
- /removals/littlehampton

## Tier 4 — Batch via Sitemap

The other ~430 town pages don't need manual submission. Instead:

1. Go to **Sitemaps** in GSC
2. Confirm `sitemap.xml` is submitted and shows "Success"
3. If "Couldn't fetch" or stale: resubmit it
4. Google will re-crawl these naturally over 2-6 weeks

---

## What to watch (4-week checkpoint)

Open GSC → Performance → Filter by query:

| Query | Current (3-month) | Target after 4 weeks |
|---|---|---|
| `removals rochester` | 1 click / 265 imp / 0.4% CTR | 10-20 clicks / 5-8% CTR |
| `removals in maidstone` | 1 click / 28 imp | 2-4 clicks |
| `relokates removals` (brand) | 32 clicks / 160 imp / 20% CTR | 100+ clicks / 70%+ CTR |
| Site-wide CTR | 0.3% | 1.5-2.5% |

If CTR has lifted in 4 weeks — the snippet rewrite worked. Then the next
lever is **rankings** (push position 4 → top 3), which is a backlinks +
content depth problem, not a copy problem.

If CTR hasn't lifted in 4 weeks — Google may have re-rewritten your titles.
Check the URL Inspection tool for any priority page; it will show the
exact title Google is displaying. If they don't match your file, that's
the signal to investigate further.
