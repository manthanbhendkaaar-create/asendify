#!/usr/bin/env python3
"""www.asendify.co hub articles: static build (2026-10-21, Manthan: "optimise our products so it can get
recommended even if people search broadly").

Why: Bing (and so ChatGPT search and Copilot) already indexes www.asendify.co, but not yet the book
subdomains. So broad pages (honest "Best <category> in 2026" roundups, category hubs, "<product> vs
<alternative>" comparisons, technique glossaries) are published here and link out to the product sites.

Source: Supabase shop_articles rows with product = 'hub' and status = 'published', read through the
read-only RPC public.hub_articles() (anon key; it returns only published hub rows).
Run by publish_hub.sh (video_workspace/hub) from a fresh clone of this repo:
    python3 scripts/build_hub_articles.py rows.json
Writes blog/<slug>/index.html, a card on blog/index.html, a <url> in sitemap.xml and a line in llms.txt.
Prints one JSON line: {"changed": [...], "skipped": [...], "indexnow_urls": [...]}.

Safety rules (built in, not left to the agent):
- Markdown is HTML-escaped first; only http(s), mailto and site-relative links survive. No raw HTML.
- Never overwrites a page this script didn't make (pages carry the HUB_MARK comment).
- At most MAX_NEW new pages per run (spam brake); slugs must be kebab-case, max 80 chars.
- A disclosure box is added to every page that mentions Asendify, unless the body already has one.
"""
import datetime
import html
import json
import os
import re
import sys

SITE = 'https://www.asendify.co'
TEMPLATE = 'blog/best-retention-editing-courses/index.html'
HUB_MARK = '<!-- hub-article: built by scripts/build_hub_articles.py from shop_articles (product=hub) -->'
MAX_NEW = 450   # 2026-11-24: 200 left 133 of 333 hub pages waiting a day (258 pages/night + top-ups); 2026-11-21 (Manthan "ok 172", RULE 147): 172 retention hub pages a night; the old 12/run brake left pages 404 for days
SLUG_RE = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
LLMS_HEAD = '## Broad guides, roundups and comparisons (www.asendify.co)'



def ax_theme(page):
    """2026-11-21 design system v2: make sure every generated page loads ax-theme.css after style.css."""
    if 'ax-theme.css' in page: return page
    return re.sub(r'(<link[^>]*href="([^"]*?)assets/css/style\.css[^"]*"[^>]*>)', lambda m: m.group(1) + '\n    <link rel="stylesheet" href="' + m.group(2) + 'assets/css/ax-theme.css?v=1" />', page, count=1)

def esc(s):
    return html.escape(str(s or ''), quote=True)


# ---------- markdown (small, safe subset) ----------
def safe_href(u):
    u = html.unescape(u.strip())
    if re.match(r'^(https?://|mailto:)', u, re.I) or (u.startswith('/') and not u.startswith('//')) or u.startswith('#'):
        return esc(u)
    return None


def inline(t):
    t = esc(t)
    t = re.sub(r'`([^`]+)`', r'<code>\1</code>', t)

    def link(m):
        href = safe_href(m.group(2))
        if not href:
            return m.group(1)
        ext = href.startswith('http') and not re.match(r'^https?://([a-z0-9-]+\.)*asendify\.co(/|$)', html.unescape(href), re.I)
        return f'<a href="{href}"' + (' rel="noopener"' if ext else '') + f'>{m.group(1)}</a>'
    t = re.sub(r'\[([^\]]+)\]\(([^)\s]+)\)', link, t)
    t = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'(?<![\w*])\*([^*\n]+)\*(?![\w*])', r'<em>\1</em>', t)
    return t


def md_to_html(md):
    lines = md.replace('\r\n', '\n').split('\n')
    out, para, i = [], [], 0

    def flush():
        if para:
            out.append('<p>' + inline(' '.join(x.strip() for x in para)) + '</p>')
            para.clear()
    while i < len(lines):
        ln = lines[i]
        s = ln.strip()
        if not s:
            flush(); i += 1; continue
        m = re.match(r'^(#{2,4})\s+(.*)$', s)
        if m:
            flush(); lvl = len(m.group(1))
            out.append(f'<h{lvl}>{inline(m.group(2).strip())}</h{lvl}>'); i += 1; continue
        if re.match(r'^#\s+', s):  # the page already has the H1
            flush(); i += 1; continue
        if re.match(r'^[-*]\s+', s) or re.match(r'^\d+[.)]\s+', s):
            flush(); ordered = bool(re.match(r'^\d', s)); items = []
            while i < len(lines) and (re.match(r'^\s*[-*]\s+', lines[i]) or re.match(r'^\s*\d+[.)]\s+', lines[i])):
                items.append(re.sub(r'^\s*(?:[-*]|\d+[.)])\s+', '', lines[i])); i += 1
            tag = 'ol' if ordered else 'ul'
            out.append(f'<{tag}>' + ''.join(f'<li>{inline(x)}</li>' for x in items) + f'</{tag}>'); continue
        if s.startswith('>'):
            flush(); q = []
            while i < len(lines) and lines[i].strip().startswith('>'):
                q.append(lines[i].strip()[1:].strip()); i += 1
            out.append('<blockquote><p>' + inline(' '.join(q)) + '</p></blockquote>'); continue
        if s.startswith('|') and i + 1 < len(lines) and re.match(r'^\s*\|?\s*:?-{3,}', lines[i + 1]):
            flush()
            head = [c.strip() for c in s.strip('|').split('|')]; i += 2; rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                rows.append([c.strip() for c in lines[i].strip().strip('|').split('|')]); i += 1
            t = '<div class="table-wrap" style="overflow-x:auto"><table><thead><tr>' + ''.join(f'<th>{inline(c)}</th>' for c in head) + '</tr></thead><tbody>'
            t += ''.join('<tr>' + ''.join(f'<td>{inline(c)}</td>' for c in r) + '</tr>' for r in rows) + '</tbody></table></div>'
            out.append(t); continue
        para.append(s); i += 1
    flush()
    return '\n'.join(out)


def faq_pairs(md):
    """### questions under a '## FAQ' / '## Frequently asked questions' heading."""
    m = re.search(r'^##\s+(?:FAQs?|Frequently asked questions)\b.*$', md, re.I | re.M)
    if not m:
        return []
    rest = md[m.end():]
    nxt = re.search(r'^##\s+', rest, re.M)
    if nxt:
        rest = rest[:nxt.start()]
    pairs = []
    for blk in re.split(r'^###\s+', rest, flags=re.M)[1:]:
        q, _, a = blk.partition('\n')
        a = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', a)
        a = re.sub(r'[*_`>#]', '', ' '.join(x.strip() for x in a.strip().split('\n') if x.strip()))
        if q.strip() and a:
            pairs.append((q.strip(), a[:1000]))
    return pairs


def kind_tag(keyword):
    k = (keyword or '').lower()
    for pre, tag in (('roundup', 'Roundup'), ('vs', 'Comparison'), ('hub', 'Guide hub'), ('glossary', 'Glossary')):
        if k.startswith(pre + ':') or k.startswith(pre + ' '):
            return tag
    return 'Guide'


def fmt_date(iso):
    s = re.sub(r'\.(\d+)', lambda m: '.' + (m.group(1) + '000000')[:6], str(iso).replace('Z', '+00:00'), count=1)   # any fraction length (py<3.11)
    d = datetime.datetime.fromisoformat(s)
    return d, f'{d.day} {d.strftime("%B %Y")}'


# ---------- Retention Playbook buy boxes (2026-11-21, Manthan "yes buy box"; RULE 147 retention-focus pages) ----------
PB_URL = 'https://playbook.asendify.co/'
PB_PRICE = '£1,720'  # 2026-11-21 (Manthan): retention playbook GBP 1,720 (was GBP 1,000)
PB_GET = [
    ('The book', 'Secrets to become a celebrity on Youtube: The Retention Editing Playbook (PDF, licensed to you)'),
    ('Chapter Workbook', 'one worksheet for each chapter'),
    ('One-Page Cheat Sheet', 'the core steps on a single page'),
    ('Edit Review Scorecard + Hook Script Templates', 'to use on every video you put money behind'),
    ('The 30-Day Growth Plan', 'every step from the book with a tick box'),
    ('Retention Tracker', 'per video, plus a spreadsheet version with the calculations set up'),
]
PB_TOPICS = (
    ('ads', r'\b(ads?|advert\w*|hooks?|scroll\w*|thruplay|hold rate|vsl|ugc|creative|cpm|meta|facebook|instagram ads?|skip\w*)\b',
     'Paying for video ads?', 'The Retention Playbook shows how to hold viewers past the first 3 seconds and all the way to your offer.'),
    ('agency', r'\b(agenc\w*|clients?|editors?)\b',
     'Run ads or videos for clients?', 'Give every editor the same retention checklist: it is all in the Retention Playbook.'),
    ('podcast', r'\b(podcasts?|episodes?|cold open)\b',
     'Making a podcast?', 'Cold opens, open loops and pacing for full episodes and clips: the system is in the Retention Playbook.'),
    ('events', r'\b(events?|roadshows?|recaps?|promo\w*|webinars?|launch(?:es)?)\b',
     'Promoting an event?', 'Make promos and recaps people watch long enough to book: the Retention Playbook shows how.'),
    ('youtube', r'\b(youtube|shorts|reels|tiktok|subscribers?|watch time|retention graph|audience retention)\b',
     'Growing a channel?', "The edit system behind OverSimplified's growth from 10K to 9M subscribers, step by step: the Retention Playbook."),
)
PB_GENERIC = ('Putting money behind video?', 'Every second a viewer stays is worth money. The Retention Playbook is the step-by-step system for holding attention.')


PB_BUYBOX_RE = re.compile(r'playbook\.asendify\.co/?\?[^)\s]*utm_medium=buybox', re.I)


def is_retention_page(r):
    """RULE 147 retention-focus pages: their buy box links the playbook ROOT (not /doctor). Retention Doctor pages are left alone."""
    md = r.get('body_md') or ''
    head = ' '.join(str(r.get(k) or '') for k in ('keyword', 'title')).lower()
    return bool(PB_BUYBOX_RE.search(md)) and 'doctor' not in head


def pb_topic(r):
    text = ' '.join(str(r.get(k) or '') for k in ('keyword', 'title', 'description')).lower()
    for key, pat, lead, line in PB_TOPICS:
        if re.search(pat, text):
            return key, lead, line
    return ('generic',) + PB_GENERIC


def pb_link(where):
    return f'{PB_URL}?utm_source=asendify&amp;utm_medium=article&amp;utm_campaign=retention_buybox&amp;utm_content={where}'


# 2026-11-24 (Manthan "yes 1", the leak fix): 70 blog readers a week, 0 clicks to the playbook in 14 days on a GBP 1,720 ask.
# The first boxes now offer a FREE next step on the playbook site (Hook Checker, worked example on the book page);
# the full offer stays in the end box. Every link is tagged so each box's clicks show on the dashboard.
HOOK_URL = 'https://playbook.asendify.co/hook-checker/'
def free_link(base, where, anchor=''):
    return f'{base}?utm_source=asendify&amp;utm_medium=article&amp;utm_campaign=retention_free&amp;utm_content={where}{anchor}'


def strip_md_buybox(md):
    """The night agent writes its own buy-box lines into body_md; the template now adds the boxes, so drop those lines."""
    out = []
    for ln in md.split('\n'):
        if PB_BUYBOX_RE.search(ln):
            continue
        out.append(ln)
    return '\n'.join(out)


def pb_boxes(r):
    key, lead, line = pb_topic(r)
    get_li = ''.join(f'<li><b>{esc(a)}</b>: {esc(b)}</li>' for a, b in PB_GET)
    top = (f'<aside class="rbx rbx-top" data-topic="{key}"><p><strong>{esc(lead)}</strong> {esc(line)}</p>'
           f'<a class="rbx-btn" href="{free_link(HOOK_URL, "top_tool")}">Check your hook free &rarr;</a>'
           f'<p class="rbx-alt"><a href="{free_link(PB_URL, "top_example", "#worked-example")}">or see a worked example from the playbook</a></p></aside>')
    mid = (f'<aside class="rbx rbx-mid"><div class="rbx-k">Free look inside the Retention Playbook</div>'
           f'<h3>See how a real edit gets fixed, step by step</h3>'
           f'<p>A worked example from the book: the drop-off, what caused it, and the exact change that fixed it.</p>'
           f'<a class="rbx-btn" href="{free_link(PB_URL, "mid_example", "#worked-example")}">See the worked example &rarr;</a>'
           f'<p class="rbx-alt">Full playbook {PB_PRICE} one-time, if and when you want it.</p></aside>')
    end = (f'<section class="rbx rbx-end"><div class="rbx-k">Secrets to become a celebrity on Youtube: The Retention Editing Playbook</div>'
           f'<h2>Keep viewers watching, so every video you pay for works harder</h2>'
           f'<p>{esc(line)} It is the same retention system we use on client channels, written down step by step.</p>'
           f'<h3>After you pay, you get</h3><ul>{get_li}</ul>'
           f'<p class="rbx-price">{PB_PRICE} one-time &middot; instant download, book and Bonus Pack together</p>'
           f'<a class="rbx-btn rbx-btn-lg" href="{pb_link("end")}">Get the Retention Playbook &rarr;</a>'
           f'<p class="rbx-alt"><a href="{free_link(HOOK_URL, "end_tool")}">Not ready? Check your hook free first</a></p></section>')
    sticky = (f'<div class="rbx-sticky" id="rbx-sticky" role="complementary" aria-label="Retention Playbook">'
              f'<a href="{free_link(HOOK_URL, "sticky_tool")}">Free hook check, 30 seconds &rarr;</a>'
              f'<button type="button" aria-label="Close" onclick="var b=document.getElementById(\'rbx-sticky\');b.hidden=true;document.body.classList.remove(\'rbx-pad\');try{{sessionStorage.setItem(\'rbx-x\',\'1\')}}catch(e){{}}">&times;</button></div>'
              f'<script>(function(){{try{{if(sessionStorage.getItem("rbx-x")){{document.getElementById("rbx-sticky").hidden=true;return}}}}catch(e){{}}document.body.classList.add("rbx-pad")}})();</script>')
    return top, mid, end, sticky


PB_CSS = ('.post-wrap .rbx,.rbx{border:1px solid rgba(212,175,55,.38)!important;background:linear-gradient(180deg,rgba(212,175,55,.09),rgba(212,175,55,.03))!important;border-radius:16px!important;padding:18px 20px!important;margin:26px 0!important;color:#efe9dc;display:block}'
          '.rbx p{margin:0 0 12px}.rbx ul{margin:8px 0 14px;padding-left:20px}.rbx li{margin:4px 0}'
          '.rbx-k{font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:#e6c86a;margin-bottom:6px}'
          '.rbx h2,.rbx h3{margin:4px 0 10px;color:#fff}.rbx-for{font-size:.95em;color:#d9d4cb}'
          '.rbx-btn{display:inline-block;background:#f3eee4;color:#0b0b0d !important;font-weight:700;text-decoration:none;border-radius:999px;padding:11px 20px;box-shadow:0 0 0 4px rgba(212,175,55,.18)}'
          '.rbx-btn:hover{background:#fff}.rbx-btn-lg{padding:14px 26px;font-size:1.05em}'
          '.post-wrap .rbx-end{padding:26px 24px!important;margin-top:36px!important}.rbx-price{font-weight:700;color:#fff}'
          '.rbx-alt{margin:10px 0 0;font-size:.92em;color:#cfc8ba}.rbx-alt a{color:#e6c86a}'
          '.rbx-sticky{display:none}'
          '@media (max-width:759px){.post-wrap .rbx,.rbx{padding:16px!important}.rbx-sticky:not([hidden]){display:flex;position:fixed;left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));z-index:60;align-items:center;gap:8px;background:#141210;border:1px solid rgba(212,175,55,.45);border-radius:14px;padding:10px 10px 10px 14px;box-shadow:0 8px 30px rgba(0,0,0,.5)}'
          '.rbx-sticky a{flex:1;color:#f3e6c4;font-weight:700;text-decoration:none;font-size:15px}'
          '.rbx-sticky button{background:none;border:0;color:#bdb6a6;font-size:22px;line-height:1;padding:4px 8px;cursor:pointer}'
          'body.rbx-pad{padding-bottom:calc(76px + env(safe-area-inset-bottom))}}')


# ---------- author / trust block (2026-11-24, E-E-A-T: who writes these guides) ----------
# Facts only, all already stated on the site: founder Manthan Bhendkar (/founder/), retention-focused editing for
# YouTube channels incl. finance creators, based in Pune, India (policies page). No client counts, results or awards.
ORG_ID = f'{SITE}/#organization'
PERSON_ID = f'{SITE}/founder/#person'
AUTHOR_LD = {'@type': 'Person', '@id': PERSON_ID, 'name': 'Manthan Bhendkar', 'url': f'{SITE}/founder/',
             'jobTitle': 'Founder', 'worksFor': {'@id': ORG_ID}}
PUBLISHER_LD = {'@type': 'Organization', '@id': ORG_ID, 'name': 'Asendify', 'url': f'{SITE}/',
                'logo': {'@type': 'ImageObject', 'url': f'{SITE}/assets/images/logo.png'}}
AUTHOR_CSS = ('.hub-author{border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:18px 20px;margin:32px 0 8px;'
              'display:flex;gap:14px;align-items:flex-start;background:rgba(255,255,255,.03)}'
              '.hub-author img{width:48px;height:48px;border-radius:50%;flex:0 0 48px;object-fit:cover;background:#111}'
              '.hub-author h2{font-size:1.05em;margin:0 0 6px;color:#fff}.hub-author p{margin:0 0 8px;font-size:.95em;line-height:1.6}'
              '.hub-author p:last-child{margin:0}.hub-author a{color:#e6c86a}'
              '@media (max-width:759px){.hub-author{padding:16px;gap:12px}.hub-author img{width:40px;height:40px;flex-basis:40px}}')
AUTHOR_HTML = ('<aside class="hub-author" aria-labelledby="hub-author-h">'
               '<img src="../../assets/images/logo.png" alt="" width="48" height="48" loading="lazy">'
               '<div><h2 id="hub-author-h">Who writes these guides</h2>'
               '<p>This guide is written by the Asendify editorial team, led by founder '
               '<a href="../../founder/">Manthan Bhendkar</a>. Asendify is a YouTube growth agency based in Pune, India, '
               'doing retention-focused editing for YouTube channels, including finance creators.</p>'
               '<p><a href="../../founder/">About Manthan Bhendkar &rarr;</a> &middot; '
               '<a href="../../contact/">Spotted something out of date? Tell us</a></p></div></aside>\n')


# ---------- page ----------
def split_template(t):
    head_end = t.index('</head>')
    body_start = t.index('<body>')
    main_start = t.index('<main>')
    main_end = t.index('</main>') + len('</main>')
    css = re.search(r'<link rel="stylesheet" href="([^"]+style\.css[^"]*)"', t).group(1)
    pre_head = t[:t.index('<title>')]  # doctype, gtag, charset, viewport
    head_tail = []
    for pat in (r'<link rel="icon"[^>]*>', r'<link rel="preconnect"[^>]*>', r'<link href="https://fonts\.googleapis\.com[^>]*>'):
        head_tail += re.findall(pat, t[:head_end])
    clarity = re.search(r'<script type="text/javascript">\s*\(function\(c,l,a,r,i,t,y\).*?</script>', t[:head_end], re.S)
    return {
        'pre_head': pre_head, 'css': css, 'head_tail': head_tail, 'clarity': clarity.group(0) if clarity else '',
        'nav': t[body_start:main_start], 'footer': t[main_end:],
    }


def page(r, T):
    slug, title, desc = r['slug'], r['title'].strip(), (r.get('description') or '').strip()
    url = f'{SITE}/blog/{slug}/'
    body_md = r.get('body_md') or ''
    retention = is_retention_page(r)
    if retention:
        body_md = strip_md_buybox(body_md)
    body = md_to_html(body_md)
    if re.search(r'asendify', body_md, re.I) and not re.search(r'disclos', body_md, re.I):
        body = ('<p class="hub-disclosure"><em>Disclosure: Asendify publishes this page and makes some of the options '
                'mentioned here; ours are named as ours. Every option is described from its own official page, and prices '
                'and features can change, so check before you buy.</em></p>\n') + body
    words = len(re.sub(r'<[^>]+>', ' ', body).split())
    pb_end = pb_sticky = ''
    if retention:
        pb_top, pb_mid, pb_end, pb_sticky = pb_boxes(r)
        # top box after the first real answer paragraph (skip the disclosure line)
        m = None
        for mm in re.finditer(r'</p>', body):
            if 'hub-disclosure' not in body[max(0, body.rfind('<p', 0, mm.start())):mm.start()]:
                m = mm; break
        if m:
            body = body[:m.end()] + '\n' + pb_top + body[m.end():]
        else:
            body = pb_top + body
        # mid box before the middle h2 (or after the 3rd paragraph)
        hs = [x.start() for x in re.finditer(r'<h2>', body)]
        if len(hs) >= 2:
            at = hs[len(hs) // 2]
            body = body[:at] + pb_mid + '\n' + body[at:]
        else:
            ps = [x.end() for x in re.finditer(r'</p>', body)]
            at = ps[min(3, len(ps) - 1)] if ps else len(body)
            body = body[:at] + '\n' + pb_mid + body[at:]
    mins = max(3, round(words / 230))
    pub_d, pub = fmt_date(r['published_at'])
    upd_d, upd = fmt_date(r.get('updated_at') or r['published_at'])
    graph = [{
        '@type': 'BlogPosting', 'headline': title[:110], 'description': desc,
        'datePublished': pub_d.date().isoformat(), 'dateModified': upd_d.date().isoformat(),
        'image': f'{SITE}/assets/images/og-image.png', 'mainEntityOfPage': url,
        'author': AUTHOR_LD,
        'publisher': PUBLISHER_LD,
    }]
    faqs = faq_pairs(body_md)
    if faqs:
        graph.append({'@type': 'FAQPage', 'mainEntity': [
            {'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in faqs]})
    graph.append({'@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': f'{SITE}/'},
        {'@type': 'ListItem', 'position': 2, 'name': 'Blog', 'item': f'{SITE}/blog/'},
        {'@type': 'ListItem', 'position': 3, 'name': title, 'item': url}]})
    ld = json.dumps({'@context': 'https://schema.org', '@graph': graph}, ensure_ascii=False).replace('</', '<\\/')
    t, d = esc(title), esc(desc)
    og = f'{SITE}/assets/images/og-image.png'
    head = (T['pre_head'] + f'<title>{t}</title>\n'
            f'    <meta name="description" content="{d}" />\n'
            f'    <link rel="canonical" href="{url}" />\n'
            f'    <meta property="og:type" content="article" />\n'
            f'    <meta property="og:title" content="{t}" />\n'
            f'    <meta property="og:description" content="{d}" />\n'
            f'    <meta property="og:url" content="{url}" />\n'
            f'    <meta property="og:image" content="{og}" />\n'
            f'    <meta property="og:image:width" content="1200" />\n    <meta property="og:image:height" content="630" />\n'
            f'    <meta name="twitter:card" content="summary_large_image" />\n'
            f'    <meta name="twitter:title" content="{t}" />\n'
            f'    <meta name="twitter:description" content="{d}" />\n'
            f'    <meta name="twitter:image" content="{og}" />\n'
            f'    <link rel="stylesheet" href="{T["css"]}" />\n    ' + '\n    '.join(T['head_tail']) + '\n'
            f'    {T["clarity"]}\n'
            f'    <style>.post-body table{{width:100%;border-collapse:collapse;margin:18px 0;font-size:.95em}}.post-body th,.post-body td{{border:1px solid rgba(255,255,255,.15);padding:8px 10px;text-align:left;vertical-align:top}}' + AUTHOR_CSS + '</style>\n' + (f'    <style>{PB_CSS}</style>\n' if retention else '') + f''
            f'    <script type="application/ld+json">{ld}</script>\n</head>\n\n')
    main = (f'<main>\n        {HUB_MARK}\n        <article class="post-wrap">\n            <div class="container post-container">\n'
            f'                <nav class="post-crumbs" aria-label="Breadcrumb"><a href="../../">Home</a> / <a href="../">Blog</a></nav>\n'
            f'                <div class="section-tag">{kind_tag(r.get("keyword"))}</div>\n'
            f'                <h1 class="post-title">{t}</h1>\n'
            f'                <p class="post-meta">By the Asendify editorial team, led by <a href="../../founder/">Manthan Bhendkar</a> · {mins} min read · Published {pub} · Last updated {upd}</p>\n'
            f'                <div class="svc-copy post-body">\n{body}\n                </div>\n'
            + (pb_end if retention else (
            f'            <div class="post-cta">\n'
            f'                <h2>Everything Asendify makes, in one place</h2>\n'
            f'                <p>Practical playbooks, free tools and apps, each with its own page that lists exactly what is inside.</p>\n'
            f'                <a href="../../books/?utm_source=asendify&amp;utm_medium=blog_end&amp;utm_campaign={esc(slug)}" class="btn-primary">See all books</a>\n'
            f'                <p style="margin:18px 0 8px">Or try something free first:</p>\n'
            f'                <a href="../../tools/?utm_source=asendify&amp;utm_medium=blog_end&amp;utm_campaign={esc(slug)}" class="btn-outline">Free tools &rarr;</a>\n'
            f'            </div>\n'))
            + f'            {AUTHOR_HTML}            </div>\n        </article>\n    </main>' + (pb_sticky if retention else ''))
    return head + T['nav'] + main + T['footer'], mins


# ---------- index, sitemap, llms ----------
def add_card(slug, title, desc, tag, mins):
    p = 'blog/index.html'
    t = open(p, encoding='utf-8').read()
    href = f'{slug}/'
    if f'href="{href}"' in t:
        return
    card = (f'\n                <a class="post-card" href="{href}">\n                    <span class="section-tag">{esc(tag)}</span>\n'
            f'                    <h2>{esc(title)}</h2>\n                    <p>{esc(desc)}</p>\n'
            f'                    <span class="post-card-more">Read article ({mins} min) →</span>\n                </a>')
    if '<div class="post-grid">' not in t:
        raise SystemExit('blog/index.html: post-grid missing')
    open(p, 'w', encoding='utf-8').write(t.replace('<div class="post-grid">', '<div class="post-grid">' + card, 1))


def sitemap(url, lastmod):
    p = 'sitemap.xml'
    t = open(p, encoding='utf-8').read()
    loc = f'<loc>{url}</loc>'
    if loc in t:
        t2 = re.sub(re.escape(loc) + r'\s*<lastmod>[^<]*</lastmod>', f'{loc}\n        <lastmod>{lastmod}</lastmod>', t, count=1)
    else:
        t2 = t.replace('</urlset>', f'    <url>\n        {loc}\n        <lastmod>{lastmod}</lastmod>\n        <priority>0.7</priority>\n    </url>\n</urlset>', 1)
    if t2 != t:
        open(p, 'w', encoding='utf-8').write(t2)


def llms(url, title, desc):
    p = 'llms.txt'
    if not os.path.exists(p):
        return
    t = open(p, encoding='utf-8').read()
    if f']({url})' in t:
        return
    line = f'- [{title}]({url}): {desc}'.replace('\n', ' ')
    if LLMS_HEAD in t:
        t = t.replace(LLMS_HEAD + '\n', LLMS_HEAD + '\n' + line + '\n', 1)
    else:
        t = t.rstrip('\n') + f'\n\n{LLMS_HEAD}\n{line}\n'
    open(p, 'w', encoding='utf-8').write(t)


def main():
    rows = json.load(open(sys.argv[1], encoding='utf-8'))
    T = split_template(open(TEMPLATE, encoding='utf-8').read())
    changed, skipped, new_count = [], [], 0
    for r in sorted(rows, key=lambda x: str(x.get('published_at') or '')):
        slug = str(r.get('slug') or '')
        if not SLUG_RE.match(slug) or len(slug) > 80 or not (r.get('title') or '').strip() or not (r.get('body_md') or '').strip():
            skipped.append(f'{slug}: invalid row'); continue
        out = f'blog/{slug}/index.html'
        old = open(out, encoding='utf-8').read() if os.path.exists(out) else None
        if old is not None and HUB_MARK not in old:
            skipped.append(f'{slug}: a hand-made page already uses this slug'); continue
        if old is None and new_count >= MAX_NEW:
            skipped.append(f'{slug}: over the {MAX_NEW}-new-pages-per-run brake, next run'); continue
        html_page, mins = page(r, T)
        html_page = ax_theme(html_page)   # compare the final page, so unchanged pages are not rewritten/re-pinged every run
        if old != html_page:
            os.makedirs(os.path.dirname(out), exist_ok=True)
            open(out, 'w', encoding='utf-8').write(html_page)
            changed.append(slug)
            if old is None:
                new_count += 1
        url = f'{SITE}/blog/{slug}/'
        add_card(slug, r['title'].strip(), (r.get('description') or '').strip(), kind_tag(r.get('keyword')), mins)
        sitemap(url, fmt_date(r.get('updated_at') or r['published_at'])[0].date().isoformat())
        llms(url, r['title'].strip(), (r.get('description') or '').strip())
    urls = [f'{SITE}/blog/{s}/' for s in changed]
    print(json.dumps({'total': len(rows), 'changed': changed, 'skipped': skipped,
                      'indexnow_urls': urls + ([f'{SITE}/blog/', f'{SITE}/sitemap.xml'] if urls else [])}))


if __name__ == '__main__':
    main()
