// Builds the "Asendify Daily #N answers" pages for every finished day (2026-10-17).
// Run from the game folder: node scripts/answers.mjs   (writes answers/<N>/index.html, answers/index.html, sitemap.xml)
// The questions come from index.html itself (same bank and same daily picker), so the pages always match the game.
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path';
const dir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const a = html.indexOf('var TOPICS = {'), b = html.indexOf('/* ---------- Storage');
if (a < 0 || b < 0) throw new Error('index.html layout changed');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(html.slice(a, b) + '\n;globalThis.__x={TOPICS,KINDS,Q,dailySet,LAUNCH};', ctx);
const { TOPICS, KINDS, Q, dailySet, LAUNCH } = ctx.__x;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const now = new Date();
const today = Math.round((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - LAUNCH) / 86400000) + 1;
const last = today - 1; // only days that are over everywhere-ish (UTC); never today's or future answers
const dateOf = n => new Date(LAUNCH + (n - 1) * 86400000);
const fmt = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const css = `:root{--a:#9b8cff}*{box-sizing:border-box}body{margin:0;background:#0f0d16;color:#ecebf3;font:17px/1.65 system-ui,-apple-system,Segoe UI,sans-serif}
.w{max-width:760px;margin:0 auto;padding:0 16px}header{border-bottom:1px solid #2a2638}header .w{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;font-weight:700}
a{color:var(--a)}header a{color:#ecebf3;text-decoration:none}.btn{display:inline-block;background:linear-gradient(90deg,#ffb7d0,#78aaff);color:#14101c;font-weight:800;padding:12px 18px;border-radius:12px;text-decoration:none}
h1{font-size:clamp(26px,5vw,38px);line-height:1.15;margin:30px 0 8px}.meta{color:#a7a3b8;font-size:14px;margin-bottom:22px}
ol{padding-left:20px}li{margin:0 0 18px}.q{font-weight:700}.k{color:#a7a3b8;font-size:14px}.ans{display:inline-block;margin:4px 0;padding:2px 10px;border-radius:999px;background:#1d2a22;color:#7ee2a8;font-weight:700;font-size:14px}
.cta{background:#18151f;border:1px solid #2a2638;border-radius:14px;padding:16px;margin:28px 0}footer{border-top:1px solid #2a2638;color:#a7a3b8;font-size:13px;padding:22px 0;margin-top:40px}
.list a{display:block;padding:12px 0;border-bottom:1px solid #2a2638;text-decoration:none;color:#ecebf3}`;
const page = (title, desc, canon, body, ld) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${canon}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${canon}"><meta property="og:image" content="https://game.asendify.co/og.png"><meta name="twitter:card" content="summary_large_image">
${ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` : ''}<style>${css}</style></head><body>
<header><div class="w"><a href="/">Asendify Daily</a><a class="btn" href="/?utm_source=answers&utm_medium=header">Play today's game</a></div></header>
<main class="w">${body}</main><footer><div class="w">Asendify Daily is a free 2-minute daily challenge made by <a href="https://www.asendify.co/?utm_source=game&utm_medium=answers">Asendify</a>. Just for fun and learning; not financial, legal or medical advice. · <a href="/answers/">All answers</a> · <a href="/blog/">Articles</a></div></footer></body></html>`;
fs.mkdirSync(path.join(dir, 'answers'), { recursive: true });
const items = [];
for (let n = 1; n <= last; n++) {
  const set = dailySet(n), d = fmt(dateOf(n));
  const lis = set.map((i, k) => { const [t, kind, c, s, ex] = Q[i]; const K = KINDS[kind], T = TOPICS[t];
    return `<li><div class="k">${esc(K.p)} · ${esc(T.n)}</div><div class="q">${esc(s)}</div><span class="ans">Answer: ${esc(K.o[c])}</span><div>${esc(ex)} <a href="${T.u}?utm_source=game&utm_medium=answers&utm_campaign=${t}">Go deeper: ${esc(T.b)} →</a></div></li>`; }).join('');
  const title = `Asendify Daily #${n} answers (${d})`;
  const desc = `All 10 answers and explanations for Asendify Daily #${n}, the free 2-minute daily challenge from ${d}.`;
  const canon = `https://game.asendify.co/answers/${n}/`;
  const body = `<h1>Asendify Daily #${n} answers</h1><div class="meta">${d} · 10 questions</div><p>Here are all ten answers from Asendify Daily #${n}, with a one-line explanation for each. Haven't played today's yet? <a href="/?utm_source=answers&utm_medium=intro">Play today's challenge</a> first, it takes two minutes.</p><ol>${lis}</ol>
<div class="cta"><b>Today's game is waiting.</b><br>10 quick calls, 2 minutes. Beat your score and challenge a friend.<br><br><a class="btn" href="/?utm_source=answers&utm_medium=cta">Play Asendify Daily</a></div>
<p>${n > 1 ? `<a href="/answers/${n - 1}/">← #${n - 1} answers</a>` : ''}${n < last ? ` · <a href="/answers/${n + 1}/">#${n + 1} answers →</a>` : ''}</p>`;
  const ld = { '@context': 'https://schema.org', '@type': 'Article', headline: title, description: desc, datePublished: dateOf(n + 1).toISOString(), mainEntityOfPage: canon, author: { '@type': 'Organization', name: 'Asendify' }, publisher: { '@type': 'Organization', name: 'Asendify' } };
  fs.mkdirSync(path.join(dir, 'answers', String(n)), { recursive: true });
  fs.writeFileSync(path.join(dir, 'answers', String(n), 'index.html'), page(title, desc, canon, body, ld));
  items.push({ n, d });
}
const listBody = `<h1>Asendify Daily answers</h1><div class="meta">Every finished day, newest first</div>${items.length ? `<div class="list">${items.slice().reverse().map(x => `<a href="/answers/${x.n}/">Asendify Daily #${x.n} answers · ${esc(x.d)}</a>`).join('')}</div>` : '<p>The first answers appear after day #1 ends.</p>'}<div class="cta"><a class="btn" href="/?utm_source=answers&utm_medium=list">Play today's game</a></div>`;
fs.writeFileSync(path.join(dir, 'answers', 'index.html'), page('Asendify Daily answers: every day explained', 'Answers and explanations for every finished Asendify Daily, the free 2-minute daily challenge.', 'https://game.asendify.co/answers/', listBody));
const urls = [['https://game.asendify.co/', '1.0', 'daily'], ['https://game.asendify.co/answers/', '0.8', 'daily'], ...items.map(x => [`https://game.asendify.co/answers/${x.n}/`, '0.6', 'never'])];
fs.writeFileSync(path.join(dir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(([u, p, f]) => `<url><loc>${u}</loc><changefreq>${f}</changefreq><priority>${p}</priority></url>`).join('')}</urlset>\n`);
console.log(JSON.stringify({ today, built: items.length, newest: last }));
