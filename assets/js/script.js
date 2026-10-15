/* ============================================
   ASENDIFY — PREMIUM AGENCY JAVASCRIPT
   ============================================ */

'use strict';


// ---- Scroll Dark Overlay (page dims progressively as you scroll) ----
(function () {
    const overlay = document.querySelector('.scroll-dark-overlay');
    if (!overlay) return;

    const MAX_OPACITY = 0.55;   // never goes fully black — content stays readable
    const START_AT = 0.04;      // ignore the first 4% of scroll so the hero stays bright
    const FULL_AT = 0.75;       // reaches max darkness by 75% down the page

    let ticking = false;

    function updateOverlay() {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        const raw = scrollable > 0 ? scrollTop / scrollable : 0;

        let progress = (raw - START_AT) / (FULL_AT - START_AT);
        progress = Math.min(Math.max(progress, 0), 1);

        // ease-in so it darkens gently at first, then more noticeably near the bottom
        const eased = progress * progress;

        overlay.style.opacity = (eased * MAX_OPACITY).toFixed(3);
        document.documentElement.style.setProperty('--luminate', eased.toFixed(3));
        ticking = false;
    }

    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(updateOverlay);
            ticking = true;
        }
    }, { passive: true });

    window.addEventListener('resize', () => {
        requestAnimationFrame(updateOverlay);
    });

    updateOverlay();
})();

// ---- Navbar scroll effect (throttled for performance) ----
const navbar = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');
let lastScrollTime = 0;
const scrollThrottle = 100;

window.addEventListener('scroll', () => {
    const now = Date.now();
    if (now - lastScrollTime > scrollThrottle) {
        if (window.scrollY > 40) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
        lastScrollTime = now;
    }
}, { passive: true });

// ---- Mobile menu ----
let mobileMenuScrollY = 0;

function lockBodyScroll() {
    mobileMenuScrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${mobileMenuScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
}

function unlockBodyScroll() {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, mobileMenuScrollY);
}

hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    navLinks.classList.toggle('open');
    if (navLinks.classList.contains('open')) {
        lockBodyScroll();
    } else {
        unlockBodyScroll();
    }
});

navLinks.querySelectorAll('.nav-link:not(.nav-dropdown-toggle)').forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('open');
        navLinks.classList.remove('open');
        unlockBodyScroll();
    });
});

navLinks.querySelectorAll('.nav-dropdown-link').forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('open');
        navLinks.classList.remove('open');
        unlockBodyScroll();
    });
});

// Close menu on outside click
document.addEventListener('click', (e) => {
    if (navLinks.classList.contains('open') &&
        !navLinks.contains(e.target) &&
        !hamburger.contains(e.target)) {
        hamburger.classList.remove('open');
        navLinks.classList.remove('open');
        unlockBodyScroll();
    }
});

// ---- Services nav dropdown (works on every page) ----
(function () {
    const dropdowns = document.querySelectorAll('.nav-item-dropdown');
    dropdowns.forEach(function (dropdown) {
        const toggle = dropdown.querySelector('.nav-dropdown-toggle');
        if (!toggle) return;
        toggle.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const isOpen = dropdown.classList.contains('open');
            dropdowns.forEach(function (d) { d.classList.remove('open'); });
            if (!isOpen) dropdown.classList.add('open');
        });
    });
    document.addEventListener('click', function () {
        dropdowns.forEach(function (d) { d.classList.remove('open'); });
    });
})();

// ---- Smooth scroll for anchor links ----
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
        const target = document.querySelector(anchor.getAttribute('href'));
        if (target) {
            e.preventDefault();
            const navH = parseInt(getComputedStyle(document.documentElement)
                .getPropertyValue('--nav-h')) || 80;
            const top = target.getBoundingClientRect().top + window.scrollY - navH;
            window.scrollTo({ top, behavior: 'smooth' });
        }
    });
});

// ---- Scroll Reveal ----
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ---- Animated Counters ----
const counters = document.querySelectorAll('.stat-num');
let countersStarted = false;

const easeOutQuad = t => t * (2 - t);

function animateCounter(el, target, duration = 1800) {
    const start = performance.now();
    const update = (now) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutQuad(progress);
        const value = Math.round(eased * target);
        el.textContent = value.toLocaleString();
        if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
}

const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting && !countersStarted) {
            countersStarted = true;
            counters.forEach(counter => {
                const target = parseInt(counter.getAttribute('data-target'), 10);
                animateCounter(counter, target);
            });
        }
    });
}, { threshold: 0.3 });

const statsSection = document.querySelector('.stats-grid');
if (statsSection) statsObserver.observe(statsSection);

// ---- Testimonials Slider ----
const track = document.getElementById('testimonialTrack');
const cards = track ? track.querySelectorAll('.testimonial-card') : [];
const dotsContainer = document.getElementById('sliderDots');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

let currentSlide = 0;
let autoSlideTimer = null;

function buildDots() {
    if (!dotsContainer || !cards.length) return;
    dotsContainer.innerHTML = '';
    cards.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = 'slider-dot' + (i === 0 ? ' active' : '');
        dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
        dot.addEventListener('click', () => goToSlide(i));
        dotsContainer.appendChild(dot);
    });
}

function goToSlide(index) {
    if (!track) return;
    currentSlide = (index + cards.length) % cards.length;
    track.style.transform = `translateX(-${currentSlide * 100}%)`;
    document.querySelectorAll('.slider-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === currentSlide);
    });
    resetAutoSlide();
}

function resetAutoSlide() {
    clearInterval(autoSlideTimer);
    autoSlideTimer = setInterval(() => goToSlide(currentSlide + 1), 5000);
}

if (prevBtn) prevBtn.addEventListener('click', () => goToSlide(currentSlide - 1));
if (nextBtn) nextBtn.addEventListener('click', () => goToSlide(currentSlide + 1));

// Touch/swipe support
if (track) {
    let startX = 0;
    let isDragging = false;

    track.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        isDragging = true;
    }, { passive: true });

    track.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        const diff = startX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) {
            goToSlide(diff > 0 ? currentSlide + 1 : currentSlide - 1);
        }
        isDragging = false;
    }, { passive: true });
}

buildDots();
resetAutoSlide();

// ---- Form submission ----
const contactForm = document.getElementById('contactForm');
if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const btn = contactForm.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.textContent = 'Sending...';
        btn.style.opacity = '0.7';
        btn.disabled = true;

        setTimeout(() => {
            btn.textContent = '✓ Message Sent!';
            btn.style.background = '#1a6e1a';
            btn.style.color = '#fff';
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = '';
                btn.style.color = '';
                btn.style.opacity = '';
                btn.disabled = false;
                contactForm.reset();
            }, 3000);
        }, 1200);
    });
}

// ---- Active nav link on scroll (throttled for performance) ----
const sections = document.querySelectorAll('section[id]');
const navLinkEls = document.querySelectorAll('.nav-link');
let lastUpdateTime = 0;
const updateThrottle = 150;

function updateActiveLink() {
    const now = Date.now();
    if (now - lastUpdateTime < updateThrottle) return;
    lastUpdateTime = now;

    const scrollY = window.scrollY;
    const navH = parseInt(getComputedStyle(document.documentElement)
        .getPropertyValue('--nav-h')) || 80;

    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop - navH - 60;
        if (scrollY >= sectionTop) current = section.getAttribute('id');
    });

    navLinkEls.forEach(link => {
        link.classList.remove('active-link');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active-link');
        }
    });
}

window.addEventListener('scroll', updateActiveLink, { passive: true });

// ---- Parallax glow on mouse move (Desktop only) ----
const glow1 = document.querySelector('.glow-1');
const glow2 = document.querySelector('.glow-2');
const isDesktop = window.innerWidth > 768;

if (glow1 && glow2 && isDesktop) {
    let ticking = false;
    document.addEventListener('mousemove', (e) => {
        if (!ticking) {
            requestAnimationFrame(() => {
                const x = (e.clientX / window.innerWidth - 0.5) * 40;
                const y = (e.clientY / window.innerHeight - 0.5) * 40;
                glow1.style.transform = `translate(${x * 0.4}px, ${y * 0.4}px)`;
                glow2.style.transform = `translate(${-x * 0.3}px, ${-y * 0.3}px)`;
                ticking = false;
            });
            ticking = true;
        }
    });
}

// ---- Hero heading stagger on load ----
window.addEventListener('load', () => {
    document.querySelectorAll('.reveal').forEach((el, i) => {
        const delay = parseFloat(
            getComputedStyle(el).transitionDelay || '0'
        );
        if (el.closest('.hero')) {
            setTimeout(() => {
                if (!el.classList.contains('visible')) {
                    el.classList.add('visible');
                }
            }, (delay + 0.2) * 1000);
        }
    });
});

// ---- Smooth Channels Carousel (Seamless Infinite Loop) ----
const channelsTrack = document.getElementById('channelsTrack');
if (channelsTrack) {
    const cards = channelsTrack.querySelectorAll('.channel-card');
    const cardArray = Array.from(cards);
    
    if (cardArray.length > 0) {
        // Clone all cards twice for seamless looping
        cardArray.forEach(card => {
            const clone = card.cloneNode(true);
            channelsTrack.appendChild(clone);
        });
        cardArray.forEach(card => {
            const clone = card.cloneNode(true);
            channelsTrack.appendChild(clone);
        });
    }
    
    let scrollPos = 0;
    let animationId = null;
    let isRunning = true;
    const scrollSpeed = 0.5; // pixels per frame
    
    function animate() {
        if (isRunning) {
            scrollPos += scrollSpeed;
            
            // Calculate the width of one set of original cards
            const trackWidth = channelsTrack.scrollWidth;
            const originalWidth = trackWidth / 3; // Since we cloned twice
            
            // Reset position when we've scrolled one full set
            if (scrollPos >= originalWidth) {
                scrollPos = 0;
            }
            
            channelsTrack.style.transform = `translateX(-${scrollPos}px)`;
        }
        animationId = requestAnimationFrame(animate);
    }
    
    // Pause on hover
    channelsTrack.addEventListener('mouseenter', () => {
        isRunning = false;
    });
    
    channelsTrack.addEventListener('mouseleave', () => {
        isRunning = true;
    });
    
    // Start animation
    animate();
}


// ---- Conversion tracking: booking / playbook clicks (Microsoft Clarity custom events) ----
document.addEventListener('click', function (e) {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || typeof window.clarity !== 'function') return;
    const h = a.getAttribute('href') || '';
    if (/(^|\/)book\/?(#|\?|$)/.test(h)) window.clarity('event', 'book_click');
    else if (/(^|\/)playbook\/?(#|\?|$)/.test(h)) window.clarity('event', 'playbook_click');
    else if (/(^|\/)contact\/?(#|\?|$)/.test(h)) window.clarity('event', 'contact_click');
}, true);

// ---- Payment safety notice (site-wide; added 2026-10-02) ----
// Shown in every page footer and under each pricing grid, so clients know the only official ways to pay.
(function () {
    var MSG = '<strong>Payment safety:</strong> Asendify only takes payment through the PayPal checkout on our official websites or an invoice emailed from an <strong>@asendify.co</strong> address. Our only official WhatsApp is <a href="https://wa.me/919096082894" style="color:inherit;text-decoration:underline">+91 90960 82894</a>. We don’t take bank transfers, and no one from our team will ever ask you to pay a personal account, UPI ID, crypto wallet or gift card. If anyone does, don’t pay. Email <a href="mailto:montybhendkar@gmail.com" style="color:inherit;text-decoration:underline">montybhendkar@gmail.com</a>.';
    function box(extra) {
        var d = document.createElement('div');
        d.className = 'pay-safety';
        d.setAttribute('role', 'note');
        d.style.cssText = 'margin:22px auto 0;max-width:820px;padding:12px 16px;border:1px solid rgba(255,180,107,.35);background:rgba(255,180,107,.07);border-radius:12px;font-size:13.5px;line-height:1.55;text-align:left;' + (extra || '');
        d.innerHTML = '🔒 ' + MSG;
        return d;
    }
    function run() {
        var fb = document.querySelector('.footer-bottom');
        if (fb && !document.getElementById('pay-safety-footer')) {
            var f = box('margin:0 0 18px;max-width:none;');
            f.id = 'pay-safety-footer';
            fb.parentNode.insertBefore(f, fb);
        }
        var card = document.querySelector('.tier-card, .pricing-card');
        if (card && card.parentNode && !document.getElementById('pay-safety-pricing')) {
            var p = box();
            p.id = 'pay-safety-pricing';
            card.parentNode.parentNode.insertBefore(p, card.parentNode.nextSibling);
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();

// ---- Double Money-Back Guarantee notice (site-wide; added 2026-10-02) ----
// Clients receive a signed guarantee contract; playbooks are covered too. Shown above the footer's payment-safety box on every page,
// and under each pricing grid that doesn't already mention it. Terms: /policies (Refund Policy).
(function () {
    var MSG = '<strong>🛡 Double Money-Back Guarantee:</strong> clients receive a signed Double Money-Back Guarantee contract, and our playbooks are covered too. If you don’t see results in your first month, you get double what you paid back.';
    function box(extra) {
        var d = document.createElement('div');
        d.className = 'dmbg-note';
        d.setAttribute('role', 'note');
        d.style.cssText = 'margin:22px auto 0;max-width:820px;padding:12px 16px;border:1px solid rgba(46,204,113,.35);background:rgba(46,204,113,.07);border-radius:12px;font-size:13.5px;line-height:1.55;text-align:left;' + (extra || '');
        d.innerHTML = MSG;
        return d;
    }
    function run() {
        var fb = document.getElementById('pay-safety-footer') || document.querySelector('.footer-bottom');
        if (fb && !document.getElementById('dmbg-footer')) {
            var f = box('margin:0 0 12px;max-width:none;');
            f.id = 'dmbg-footer';
            fb.parentNode.insertBefore(f, fb);
        }
        var card = document.querySelector('.tier-card, .pricing-card');
        if (card && card.parentNode && !document.getElementById('dmbg-pricing') && !/money-back/i.test(card.parentNode.parentNode.textContent || '')) {
            var p = box();
            p.id = 'dmbg-pricing';
            card.parentNode.parentNode.insertBefore(p, card.parentNode.nextSibling);
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();


// ---- Traffic source hand-off (2026-10-11) ----
// Remembers where a visitor first came from (AI search like ChatGPT/Perplexity, utm tags or another site)
// for 30 days, and adds it to links into our shops/booking subdomains, so a sale is credited to the real
// source instead of "asendify.co". AI visits are tagged utm_source=ai, utm_medium=<assistant>.
(function () {
    const AI = [
        [/(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$|(^|\.)openai\.com$/, 'chatgpt'],
        [/(^|\.)perplexity\.ai$/, 'perplexity'],
        [/(^|\.)gemini\.google\.com$|(^|\.)bard\.google\.com$/, 'gemini'],
        [/(^|\.)copilot\.microsoft\.com$/, 'copilot'],
        [/(^|\.)claude\.ai$/, 'claude'],
        [/(^|\.)you\.com$|(^|\.)phind\.com$|(^|\.)meta\.ai$|(^|\.)grok\.com$|(^|\.)deepseek\.com$/, 'other-ai']
    ];
    const clean = v => String(v || '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 60);
    const aiName = host => { host = clean(host).replace(/^www\./, ''); for (const [re, n] of AI) if (re.test(host)) return n; return ''; };
    const KEY = 'asd_src', TTL = 30 * 864e5;
    let src = null;
    try {
        const qs = new URLSearchParams(location.search);
        const us = qs.get('utm_source');
        let fresh = null;
        if (us) {
            const ai = aiName(us);
            fresh = ai ? { s: 'ai', m: ai, c: clean(qs.get('utm_campaign')) || 'via-asendify' }
                       : { s: clean(us), m: clean(qs.get('utm_medium')), c: clean(qs.get('utm_campaign')) };
        } else if (document.referrer) {
            const h = new URL(document.referrer).hostname.replace(/^www\./, '');
            if (h && !/(^|\.)asendify\.co$/.test(h)) {
                const ai = aiName(h);
                fresh = ai ? { s: 'ai', m: ai, c: 'via-asendify' } : { s: 'ref', m: clean(h), c: 'via-asendify' };
            }
        }
        if (fresh) localStorage.setItem(KEY, JSON.stringify({ ...fresh, t: Date.now() }));
        const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (saved && Date.now() - saved.t < TTL) src = saved;
    } catch (e) {}
    if (!src) return;
    document.addEventListener('click', function (ev) {
        const a = ev.target && ev.target.closest && ev.target.closest('a[href]');
        if (!a) return;
        try {
            const u = new URL(a.href, location.href);
            if (!/(^|\.)asendify\.co$/.test(u.hostname) || u.hostname === location.hostname || /^(www\.)?asendify\.co$/.test(u.hostname)) return;
            if (u.searchParams.has('utm_source')) return;
            u.searchParams.set('utm_source', src.s);
            if (src.m) u.searchParams.set('utm_medium', src.m);
            if (src.c) u.searchParams.set('utm_campaign', src.c);
            a.href = u.toString();
        } catch (e) {}
    }, true);
})();

// 2026-10-15: count real visits to asendify.co by source for the Asendify Channels dashboard (Manthan's OK).
// One visit per browser session for the whole site, recorded with the page it landed on: product 'books' when it
// landed on the library page (/books/), 'hub' for any other page. Same rules as the book shops: sent only after a
// scroll/tap/mouse/key or 12 s on screen; bots skipped. AI assistants show up via their utm tag or referrer.
(function () {
    try {
        if (sessionStorage.getItem('asd_sv') === '1') return;
        // Our own browsers are not counted: ?internal=1 on any asendify.co page marks this browser for every *.asendify.co site.
        var q0 = new URLSearchParams(location.search);
        if (q0.get('internal') === '1') document.cookie = 'asd_internal=1; domain=.asendify.co; path=/; max-age=63072000; SameSite=Lax; Secure';
        if (q0.get('internal') === '0') document.cookie = 'asd_internal=; domain=.asendify.co; path=/; max-age=0; SameSite=Lax; Secure';
        if (/(^|;\s*)asd_internal=1/.test(document.cookie)) return;
        if (navigator.webdriver || /bot\b|bot\/|crawl|spider|slurp|preview|headless|lighthouse|scanner|facebookexternalhit/i.test(navigator.userAgent)) return;
        var clean = function (v) { return String(v || '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 60); };
        var qs = new URLSearchParams(location.search), src = '';
        if (qs.get('utm_source')) src = [clean(qs.get('utm_source')), clean(qs.get('utm_medium')), clean(qs.get('utm_campaign'))].join('/');
        if (!src && document.referrer) {
            var h = new URL(document.referrer).hostname.replace(/^www\./, '');
            if (h && !/(^|\.)asendify\.co$/.test(h)) src = 'ref/' + clean(h);
        }
        if (!src) {
            var sv = JSON.parse(localStorage.getItem('asd_src') || 'null');
            if (sv && Date.now() - sv.t < 30 * 864e5) src = [sv.s, sv.m, sv.c].map(clean).join('/');
        }
        src = src || 'direct';
        var path = location.pathname.replace(/[^a-zA-Z0-9._\/-]/g, '').slice(0, 120) || '/';
        var product = /^\/books(\/|$)/.test(path) ? 'books' : 'hub';
        var acts = ['scroll', 'pointerdown', 'touchstart', 'keydown', 'mousemove', 'wheel'], sent = false, shown = 0, tick;
        var send = function (how) {
            if (sent) return; sent = true; clearInterval(tick);
            acts.forEach(function (e) { removeEventListener(e, onAct, true); });
            try { sessionStorage.setItem('asd_sv', '1'); } catch (e) {}
            fetch('https://playbook.asendify.co/api/ref', { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ visit: src, page: path, engaged: how, product: product }) }).catch(function () {});
        };
        var onAct = function () { send('interact'); };
        acts.forEach(function (e) { addEventListener(e, onAct, { capture: true, passive: true }); });
        tick = setInterval(function () { if (document.visibilityState === 'visible' && (shown += 1000) >= 12000) send('time'); }, 1000);
    } catch (e) {}
})();

/* 2026-10-15 (Manthan: "books page visible everywhere, keep the bar as people scroll"):
   a gold bar fixed at the top of every page linking to the Asendify Books library. Fixed/sticky headers are
   moved down by the bar's height and the page gets matching top padding, so nothing is covered. */
(function () {
  try {
    if (window.__asdBooksBar) return; window.__asdBooksBar = 1;
    if (/^\/books(\/|$)/.test(location.pathname)) return;
    var s = null;
    var src = (s && s.getAttribute('data-src')) || 'asendify';
    var text = (s && s.getAttribute('data-text')) || 'New: Asendify Books · 21 practical playbooks. Pick your problem →';
    var href = '/books/';
    function build() {
      if (document.getElementById('asd-booksbar')) return;
      var bar = document.createElement('a');
      bar.id = 'asd-booksbar'; bar.href = href; bar.textContent = innerWidth < 520 ? 'Asendify Books: 21 practical playbooks \u2192' : text;
      bar.setAttribute('style', 'position:fixed;top:0;left:0;right:0;z-index:2147483000;display:block;text-align:center;padding:8px 12px;' +
        'font:600 13px/1.35 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.1px;background:#d4af37;color:#111;' +
        'text-decoration:none;box-shadow:0 1px 0 rgba(0,0,0,.25);white-space:nowrap;overflow:hidden;text-overflow:ellipsis');
      document.body.insertBefore(bar, document.body.firstChild);
      var basePad = parseFloat(getComputedStyle(document.body).paddingTop) || 0, moved = [];
      function topEls() {
        var out = [];
        document.querySelectorAll('header, nav, #navbar, [class*="navbar"], [class*="header"], [class*="topbar"]').forEach(function (el) {
          if (el === bar || el.closest('#asd-booksbar') || moved.indexOf(el) >= 0) return;
          var cs = getComputedStyle(el);
          if ((cs.position === 'fixed' || cs.position === 'sticky') && Math.abs(parseFloat(cs.top) || 0) < 2) out.push(el);
        });
        return out;
      }
      function apply() {
        var h = bar.offsetHeight;
        document.body.style.paddingTop = (basePad + h) + 'px';
        moved = moved.concat(topEls());
        moved.forEach(function (el) { el.style.setProperty('top', h + 'px', 'important'); });
      }
      apply(); setTimeout(apply, 600); setTimeout(apply, 2000);
      addEventListener('resize', apply);
      addEventListener('scroll', function () { if (topEls().length) apply(); }, { passive: true });
    }
    if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
  } catch (e) {}
})();
