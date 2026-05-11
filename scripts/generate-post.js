// ══════════════════════════════════════════════════════
//  Relokates Weekly Blog Auto-Poster
//  Runs every Tuesday via GitHub Actions at 6am UTC
//
//  1. Reads current week from state.json
//  2. Gets this week's post from blog-calendar.js
//  3. Calls Claude API to write the full blog post HTML
//  4. Saves HTML to blog/ folder
//  5. Optionally triggers Make.com for social posting
//  6. Updates state.json
// ══════════════════════════════════════════════════════

const fs   = require('fs');
const path = require('path');
const https = require('https');

const CALENDAR = require('./blog-calendar.js');

// ── Load or initialise state ──
const STATE_FILE = path.join(__dirname, 'state.json');
let state = { currentWeek: 0, lastRun: null };
if (fs.existsSync(STATE_FILE)) {
  try { state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch(e) { console.log('State file unreadable, starting fresh'); }
}

// ── Determine this week's number ──
const weekOverride = process.env.WEEK_OVERRIDE;
let thisWeek = weekOverride ? parseInt(weekOverride) : state.currentWeek + 1;
const calendarWeek = Math.min(thisWeek, CALENDAR.length);

console.log(`\n══════════════════════════════════`);
console.log(`Relokates Blog Automation — Week ${thisWeek}`);
console.log(`══════════════════════════════════`);

// ── Get this week's post ──
const post = CALENDAR[calendarWeek - 1];
if (!post) {
  console.log(`No post found for week ${calendarWeek}. All ${CALENDAR.length} posts complete.`);
  process.exit(0);
}

console.log(`Title: ${post.title}`);
console.log(`Slug:  ${post.slug}`);
console.log(`Category: ${post.category}`);

// ── Helper: HTTPS POST ──
function httpsPost(url, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers
      }
    };
    const req = https.request(options, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(raw); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ══════════════════════════════════════════════════════
//  STEP 1 — Call Claude API to write the blog post
// ══════════════════════════════════════════════════════
async function generateBlogPost(post) {
  console.log('\n[1/3] Calling Claude API to write blog post...');

  const prompt = `You are writing a fully SEO-optimised blog post for Relokates Removals (relokates.co.uk), a professional removal company covering 661 locations across London, Essex, Kent and West Sussex. Phone: 07359 724844. Address: 95 Mortimer Street, London W1W 7SB.

Write a complete, detailed blog post for this topic:

Title: ${post.title}
Category: ${post.category}
Target keywords: ${post.keywords.join(', ')}

Requirements:
- Minimum 1,500 words of genuinely useful, detailed content
- Write in a professional but warm and human tone
- Include specific references to London, Essex, Kent and West Sussex throughout
- Structure with clear H2 and H3 subheadings
- Include practical, actionable advice throughout
- Do NOT use em dashes (use hyphens or rewrite instead)
- Do NOT mention competitors by name
- Reference Relokates services naturally where relevant: house removals, office removals, packing services, storage, man and van, luxury removals, international relocation to Dubai
- End with a clear call to action to call 07359 724844 or visit relokates.co.uk/contact

Return ONLY the inner HTML content that goes inside the <article> tag.
Start with a <p> opening paragraph.
Use <h2>, <h3>, <p>, <ul>, <li>, <strong> tags only.
Do NOT include DOCTYPE, html, head, body, article tags or any wrapper.
Do NOT include markdown, code blocks or backticks.`;

  const response = await httpsPost(
    'https://api.anthropic.com/v1/messages',
    {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    },
    {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    }
  );

  if (!response.content || !response.content[0]) {
    throw new Error('Claude API returned no content: ' + JSON.stringify(response));
  }
  return response.content[0].text;
}

// ══════════════════════════════════════════════════════
//  STEP 2 — Build and save the HTML page
// ══════════════════════════════════════════════════════
function buildHtmlPage(post, articleContent) {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const dateISO = today.toISOString().split('T')[0];

  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "description": `${post.title} - expert advice from Relokates Removals covering London, Essex, Kent and West Sussex.`,
    "author": { "@type": "Organization", "name": "Relokates Removals" },
    "publisher": {
      "@type": "Organization",
      "name": "Relokates Removals",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "95 Mortimer Street",
        "addressLocality": "London",
        "addressRegion": "England",
        "postalCode": "W1W 7SB",
        "addressCountry": "GB"
      }
    },
    "datePublished": dateISO,
    "dateModified": dateISO,
    "keywords": post.keywords.join(', '),
    "mainEntityOfPage": `https://www.relokates.co.uk/blog/${post.slug}`
  });

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${post.title} | Relokates Removals Blog</title>
<meta name="description" content="${post.title} - expert moving advice from Relokates Removals. Covering London, Essex, Kent and West Sussex. Call 07359 724844.">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<link rel="canonical" href="https://www.relokates.co.uk/blog/${post.slug}">
<meta property="og:type" content="article">
<meta property="og:title" content="${post.title} | Relokates Removals">
<meta property="og:url" content="https://www.relokates.co.uk/blog/${post.slug}">
<meta property="og:site_name" content="Relokates Removals">
<script type="application/ld+json">${schema}</script>
<link rel="icon" type="image/png" sizes="32x32" href="/images/favicon.png">
<script async src="https://www.googletagmanager.com/gtag/js?id=G-GYPYC0FNKZ"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-GYPYC0FNKZ');</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<nav id="site-nav" role="navigation" aria-label="Main navigation">
  <div class="nav-inner">
    <a class="nav-logo" href="/" aria-label="Relokates Removals Home"><img src="/images/logo.webp" alt="Relokates Removals" style="height:54px;width:auto;display:block"></a>
    <ul class="nav-links" role="list">
      <li><a href="/">Home</a></li>
      <li><a href="/services">Services</a></li>
      <li><a href="/areas">Areas We Cover</a></li>
      <li><a href="/about">About</a></li>
      <li><a href="/blog">Blog</a></li>
      <li><a href="/faq">FAQs</a></li>
      <li><a href="/contact" class="nav-cta">Get a Free Quote</a></li>
    </ul>
    <button class="hamburger" onclick="toggleMobile()" aria-label="Open menu"><span></span><span></span><span></span></button>
  </div>
</nav>
<div id="mobile-overlay" role="dialog" aria-modal="true">
  <button class="mob-close" onclick="toggleMobile()">&#10005;</button>
  <a class="mob-nav-link" href="/">Home</a>
  <a class="mob-nav-link" href="/services">Services</a>
  <a class="mob-nav-link" href="/blog">Blog</a>
  <a class="mob-nav-link" href="/contact" style="color:var(--gold)">Get a Free Quote &#8594;</a>
</div>
<div class="gold-bar"></div>

<div style="background:var(--navy);padding:56px 0 48px">
  <div class="container">
    <nav aria-label="Breadcrumb" style="margin-bottom:16px">
      <ol style="list-style:none;display:flex;gap:8px;font-size:13px;color:rgba(255,255,255,0.5)">
        <li><a href="/" style="color:rgba(255,255,255,0.5)">Home</a></li>
        <li style="color:rgba(255,255,255,0.3)">&#8250;</li>
        <li><a href="/blog" style="color:rgba(255,255,255,0.5)">Blog</a></li>
        <li style="color:rgba(255,255,255,0.3)">&#8250;</li>
        <li style="color:rgba(255,255,255,0.8)">${post.category}</li>
      </ol>
    </nav>
    <div class="section-eyebrow">${post.category}</div>
    <h1 style="font-size:clamp(26px,3.5vw,42px);color:#fff;letter-spacing:-0.5px;max-width:780px;line-height:1.25;margin-bottom:14px;font-family:var(--ff-display)">${post.title}</h1>
    <div style="display:flex;gap:20px;flex-wrap:wrap;font-size:13px;color:rgba(255,255,255,0.5);margin-top:16px">
      <span>&#128197; ${dateStr}</span>
      <span>&#128336; 7 min read</span>
      <span>&#128101; Relokates Removals Team</span>
    </div>
  </div>
</div>

<section class="section">
  <div class="container">
    <div style="display:grid;grid-template-columns:1fr 300px;gap:56px;align-items:start">
      <article style="font-size:16px;color:#333;line-height:1.9">
        ${articleContent}
        <div style="background:var(--navy);border-radius:12px;padding:32px;margin:40px 0;text-align:center">
          <h3 style="color:#fff;font-size:20px;margin-bottom:10px;font-family:var(--ff-display)">Planning your move?</h3>
          <p style="color:rgba(255,255,255,0.65);font-size:15px;margin-bottom:20px">Get a free, fixed-price quote from Relokates. We cover 661 locations across London, Essex, Kent and West Sussex.</p>
          <a href="/contact" class="btn btn-primary" style="margin-right:12px">Get a Free Quote</a>
          <a href="tel:07359724844" style="display:inline-block;background:rgba(255,255,255,0.1);color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">&#9990; 07359 724844</a>
        </div>
      </article>
      <aside>
        <div style="background:var(--navy);border-radius:12px;padding:24px;color:#fff;position:sticky;top:80px;margin-bottom:20px">
          <h3 style="color:var(--gold);font-size:16px;margin-bottom:10px;font-family:var(--ff-display)">Get a free quote</h3>
          <p style="font-size:13px;color:rgba(255,255,255,0.55);margin-bottom:16px;line-height:1.6">Fixed price. Fully insured. 661 locations covered.</p>
          <a href="/contact" class="btn btn-primary" style="width:100%;justify-content:center;margin-bottom:10px">Get a Free Quote &#8594;</a>
          <a href="tel:07359724844" style="display:block;text-align:center;font-size:18px;font-weight:800;color:#fff;text-decoration:none;font-family:var(--ff-display)">07359 724844</a>
          <p style="font-size:12px;color:rgba(255,255,255,0.35);text-align:center;margin-top:6px">Mon-Sun 8am-10pm</p>
        </div>
        <div style="background:var(--cream);border-radius:12px;padding:20px;border:1px solid var(--border)">
          <h4 style="font-size:14px;color:var(--navy);margin-bottom:12px;font-family:var(--ff-display)">Our services</h4>
          <div style="display:flex;flex-direction:column;gap:8px">
            <a href="/house-removals" style="font-size:13px;color:var(--muted);text-decoration:none">&#127968; House Removals</a>
            <a href="/office-removals" style="font-size:13px;color:var(--muted);text-decoration:none">&#127970; Office Removals</a>
            <a href="/international-relocation" style="font-size:13px;color:var(--muted);text-decoration:none">&#127758; International &amp; Dubai</a>
            <a href="/packing-services" style="font-size:13px;color:var(--muted);text-decoration:none">&#128230; Packing Services</a>
            <a href="/storage" style="font-size:13px;color:var(--muted);text-decoration:none">&#128274; Storage</a>
            <a href="/man-and-van" style="font-size:13px;color:var(--muted);text-decoration:none">&#128654; Man and Van</a>
            <a href="/luxury-removals" style="font-size:13px;color:var(--muted);text-decoration:none">&#128081; Luxury Removals</a>
          </div>
        </div>
      </aside>
    </div>
  </div>
</section>

<div class="cta-band"><div class="container">
  <div class="section-eyebrow">Ready to move?</div>
  <h2 class="section-title">Get your free, fixed-price removal quote</h2>
  <p class="section-sub">661 locations covered. Fully insured. No hidden charges.</p>
  <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:24px">
    <a href="/contact" class="btn btn-primary">Get a Free Quote &#8594;</a>
    <a href="tel:07359724844" class="btn btn-secondary">&#9990; 07359 724844</a>
  </div>
</div></div>

<footer id="site-footer" role="contentinfo">
  <div class="container">
    <p style="color:rgba(255,255,255,0.35);font-size:12px;text-align:center;padding:20px 0">&copy; 2026 Relokates Removals. All rights reserved. | <a href="/privacy-policy" style="color:rgba(255,255,255,0.35)">Privacy Policy</a></p>
  </div>
</footer>
<script>function toggleMobile(){document.getElementById('mobile-overlay').classList.toggle('active')}</script>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════
//  STEP 3 — Send to Make.com webhook (optional)
// ══════════════════════════════════════════════════════
async function triggerMakeWebhook(post) {
  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log('No MAKE_WEBHOOK_URL set - skipping social posting');
    return;
  }
  console.log('\n[3/3] Triggering Make.com webhook...');
  const blogUrl = `https://www.relokates.co.uk/blog/${post.slug}`;
  const payload = {
    title: post.title,
    slug: post.slug,
    category: post.category,
    blog_url: blogUrl,
    caption: post.caption + `\n\nRead more: ${blogUrl}`,
    week: thisWeek
  };
  const result = await httpsPost(webhookUrl, payload);
  console.log('Make.com response:', JSON.stringify(result));
}

// ══════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════
async function main() {
  try {
    const articleContent = await generateBlogPost(post);
    console.log(`Blog content generated - approx ${articleContent.split(' ').length} words`);

    console.log('\n[2/3] Building and saving HTML file...');
    const html = buildHtmlPage(post, articleContent);
    const outputPath = path.join(__dirname, '..', 'blog', `${post.slug}.html`);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, html, 'utf8');
    console.log(`Saved: blog/${post.slug}.html`);
    fs.writeFileSync(path.join(__dirname, 'current-week.txt'), String(thisWeek));

    await triggerMakeWebhook(post);

    state.currentWeek = thisWeek;
    state.lastRun = new Date().toISOString();
    state.lastPost = post.slug;
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

    console.log('\n══════════════════════════════════');
    console.log(`Week ${thisWeek} complete: ${post.slug}`);
    console.log('══════════════════════════════════\n');

  } catch(err) {
    console.error('\nERROR:', err.message);
    process.exit(1);
  }
}

main();
