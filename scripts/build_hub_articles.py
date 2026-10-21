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
MAX_NEW = 12
SLUG_RE = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
LLMS_HEAD = '## Broad guides, roundups and comparisons (www.asendify.co)'


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
    d = datetime.datetime.fromisoformat(str(iso).replace('Z', '+00:00'))
    return d, f'{d.day} {d.strftime("%B %Y")}'


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
    body = md_to_html(body_md)
    if re.search(r'asendify', body_md, re.I) and not re.search(r'disclos', body_md, re.I):
        body = ('<p class="hub-disclosure"><em>Disclosure: Asendify publishes this page and makes some of the options '
                'mentioned here; ours are named as ours. Every option is described from its own official page, and prices '
                'and features can change, so check before you buy.</em></p>\n') + body
    words = len(re.sub(r'<[^>]+>', ' ', body).split())
    mins = max(3, round(words / 230))
    pub_d, pub = fmt_date(r['published_at'])
    upd_d, upd = fmt_date(r.get('updated_at') or r['published_at'])
    graph = [{
        '@type': 'BlogPosting', 'headline': title[:110], 'description': desc,
        'datePublished': pub_d.date().isoformat(), 'dateModified': upd_d.date().isoformat(),
        'image': f'{SITE}/assets/images/og-image.png', 'mainEntityOfPage': url,
        'author': {'@type': 'Person', 'name': 'Manthan Bhendkar', 'url': f'{SITE}/founder/'},
        'publisher': {'@type': 'Organization', 'name': 'Asendify', 'url': f'{SITE}/', 'logo': f'{SITE}/assets/images/logo.png'},
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
            f'    <style>.post-body table{{width:100%;border-collapse:collapse;margin:18px 0;font-size:.95em}}.post-body th,.post-body td{{border:1px solid rgba(255,255,255,.15);padding:8px 10px;text-align:left;vertical-align:top}}</style>\n'
            f'    <script type="application/ld+json">{ld}</script>\n</head>\n\n')
    main = (f'<main>\n        {HUB_MARK}\n        <article class="post-wrap">\n            <div class="container post-container">\n'
            f'                <nav class="post-crumbs" aria-label="Breadcrumb"><a href="../../">Home</a> / <a href="../">Blog</a></nav>\n'
            f'                <div class="section-tag">{kind_tag(r.get("keyword"))}</div>\n'
            f'                <h1 class="post-title">{t}</h1>\n'
            f'                <p class="post-meta">By <a href="../../founder">Manthan Bhendkar</a> · {mins} min read · Published {pub} · Last updated {upd}</p>\n'
            f'                <div class="svc-copy post-body">\n{body}\n                </div>\n'
            f'            <div class="post-cta">\n'
            f'                <h2>Everything Asendify makes, in one place</h2>\n'
            f'                <p>Practical playbooks, free tools and apps, each with its own page that lists exactly what is inside.</p>\n'
            f'                <a href="../../books/?utm_source=asendify&amp;utm_medium=blog_end&amp;utm_campaign={esc(slug)}" class="btn-primary">See all books</a>\n'
            f'                <p style="margin:18px 0 8px">Or try something free first:</p>\n'
            f'                <a href="../../tools/?utm_source=asendify&amp;utm_medium=blog_end&amp;utm_campaign={esc(slug)}" class="btn-outline">Free tools &rarr;</a>\n'
            f'            </div>\n            </div>\n        </article>\n    </main>')
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
