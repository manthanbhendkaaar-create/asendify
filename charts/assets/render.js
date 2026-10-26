/* Chart Reader: renders a read (the JSON saved by the server) as HTML. Used by /app/ in the browser and by the
   build script for the landing-page example (works in Node too). Every value is escaped. */
(function (root) {
  'use strict';
  var NOTICE = 'Educational analysis only. Not financial advice: nothing here tells you to buy or sell. No guarantee of accuracy. Trading carries a high risk of losing money.';
  var SYM = { GBP: '£', USD: '$', EUR: '€', INR: '₹', AUD: 'A$', CAD: 'C$', SGD: 'S$', JPY: '¥', AED: 'AED ', CHF: 'CHF ', USDT: 'USDT ' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(n, d) { return Number(n).toLocaleString('en-GB', { maximumFractionDigits: d, minimumFractionDigits: 0 }); }
  function px(n) { if (n == null || !isFinite(n)) return '–'; var a = Math.abs(n); return num(n, a >= 1000 ? 2 : a >= 100 ? 2 : a >= 1 ? 4 : 8); }
  function units(n) { var a = Math.abs(n); return num(n, a >= 1000 ? 0 : a >= 10 ? 2 : a >= 1 ? 3 : 6); }
  function money(c, n) { return (SYM[c] || '') + num(n, 2); }
  function range(l) { if (l.low == null && l.high == null) return 'Level not readable'; if (l.low != null && l.high != null && l.low !== l.high) return px(l.low) + ' – ' + px(l.high); return px(l.low != null ? l.low : l.high); }
  var TREND = { up: ['Uptrend', 'up'], down: ['Downtrend', 'down'], sideways: ['Sideways', 'side'], unclear: ['Trend unclear', 'side'] };
  function card(title, body, cls) { return '<section class="rcard' + (cls ? ' ' + cls : '') + '"><h3>' + esc(title) + '</h3>' + body + '</section>'; }
  function renderRead(r, opts) {
    opts = opts || {};
    var t = TREND[(r.trend && r.trend.direction) || 'unclear'] || TREND.unclear;
    var h = [];
    h.push('<article class="read">');
    if (opts.label) h.push('<div class="exlabel">' + esc(opts.label) + '</div>');
    h.push('<header class="rhead"><div><p class="kick">Chart read</p><h2>' + esc(r.instrument) + '</h2><p class="meta">' + esc([r.timeframe, r.chart_type].filter(Boolean).join(' · ')) + (opts.date ? ' · ' + esc(opts.date) : '') + '</p></div><span class="trend ' + t[1] + '">' + t[0] + '</span></header>');
    h.push('<p class="notice" role="note"><b>Educational only.</b> ' + esc(NOTICE.replace('Educational analysis only. ', '')) + '</p>');
    h.push('<div class="rgrid">');
    h.push(card('Trend', '<p>' + esc(r.trend && r.trend.summary) + '</p>'));
    h.push(card('Market structure', '<p>' + esc(r.structure) + '</p>'));
    h.push('</div>');
    if (r.levels && r.levels.length) h.push(card('Key levels', '<div class="levels">' + r.levels.map(function (l) {
      return '<div class="lv ' + (l.type === 'resistance' ? 'res' : 'sup') + '"><span class="pill">' + (l.type === 'resistance' ? 'Resistance' : 'Support') + '</span><b class="px">' + esc(range(l)) + '</b><span class="ln">' + esc(l.label) + (l.note ? '<small>' + esc(l.note) + '</small>' : '') + '</span></div>';
    }).join('') + '</div>'));
    h.push('<div class="rgrid">');
    h.push(card('Patterns', r.patterns && r.patterns.length ? '<ul>' + r.patterns.map(function (p) { return '<li><b>' + esc(p.name) + '.</b> ' + esc(p.note) + '</li>'; }).join('') + '</ul>' : '<p>No clear chart pattern.</p>'));
    h.push(card('Volume and indicators', '<p>' + esc(r.indicators) + '</p>'));
    h.push('</div>');
    h.push(card('Scenarios traders often watch', '<div class="scen">' + (r.scenarios || []).map(function (s, i) {
      return '<div class="sc"><span class="n">' + (i + 1) + '</span><h4>' + esc(s.title) + '</h4><p>' + esc(s.if) + ' ' + esc(s.watch) + '</p><div class="lvls"><span>Level <b>' + px(s.trigger_price) + '</b></span><span>Invalidation <b>' + px(s.invalidation_price) + '</b></span></div><p class="inv">' + esc(s.invalidation) + '</p></div>';
    }).join('') + '</div>'));
    var p = r.plan;
    if (p && p.available) {
      h.push(card('Position-size arithmetic', '<p>Your rule: risk <b>' + num(p.riskPct, 3) + '%</b> of <b>' + money(p.currency, p.account) + '</b> = <b>' + money(p.currency, p.riskAmount) + '</b> per trade.</p><div class="tbl"><table><thead><tr><th>Scenario</th><th>Level → invalidation</th><th>Distance</th><th>Size for that risk</th><th>Position value</th></tr></thead><tbody>' +
        p.rows.map(function (x) {
          if (!x.ok) return '<tr><td>' + esc(x.title) + '</td><td colspan="4">Not calculated: levels not readable on the chart.</td></tr>';
          return '<tr><td>' + esc(x.title) + '</td><td>' + px(x.level) + ' → ' + px(x.invalidation) + '</td><td>' + px(x.distance) + ' (' + num(x.distancePct, 2) + '%)</td><td>≈ ' + units(x.units) + ' units</td><td>≈ ' + money(p.currency, x.positionValue) + (x.leverage > 1 ? ' <small>(' + num(x.leverage, 2) + '× account)</small>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div><p class="fine">Pure arithmetic: units = risk amount ÷ distance between the level and its invalidation. It assumes the chart is priced in your account currency and ignores fees, spread, slippage, lot or contract sizes and leverage rules. It is not a recommendation to trade.</p>', 'plan'));
    } else {
      h.push(card('Position-size arithmetic', '<p class="fine">' + esc((p && p.reason) || 'Add your account size and risk % per trade to see the position-size arithmetic.') + '</p>', 'plan'));
    }
    if (r.what_changes && r.what_changes.length) h.push(card('What would change the picture', '<ul>' + r.what_changes.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>'));
    if (r.quality_note) h.push('<p class="fine qn">Note on this read: ' + esc(r.quality_note) + '</p>');
    // 2026-10-17 (Manthan): every read recommends the trading book and the business book.
    h.push(card('Keep learning', '<ul class="books">' +
      '<li><a href="https://trading.asendify.co/?utm_source=charts&amp;utm_medium=read&amp;utm_campaign=trading" target="_blank" rel="noopener"><b>Secrets of Chart Reading Most Traders Miss</b></a> — the playbook for technical analysis, trading strategies and risk management.</li>' +
      '<li><a href="https://sellable.asendify.co/?utm_source=charts&amp;utm_medium=read&amp;utm_campaign=sellable" target="_blank" rel="noopener"><b>Secrets to Building a Business Someone Will Buy</b></a> — how to build a business from first idea to systems that run without you.</li>' +
      '</ul>', 'learn'));
    h.push('<p class="notice bottom" role="note">' + esc(NOTICE) + '</p>');
    h.push('</article>');
    return h.join('');
  }
  var api = { renderRead: renderRead, NOTICE: NOTICE, esc: esc, px: px };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ChartRender = api;
})(this);
