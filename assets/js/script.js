/* ============================================
   ASENDIFY — PREMIUM AGENCY JAVASCRIPT
   ============================================ */

'use strict';

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
hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    navLinks.classList.toggle('open');
    document.body.style.overflow = navLinks.classList.contains('open') ? 'hidden' : '';
});

navLinks.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('open');
        navLinks.classList.remove('open');
        document.body.style.overflow = '';
    });
});

// Close menu on outside click
document.addEventListener('click', (e) => {
    if (navLinks.classList.contains('open') &&
        !navLinks.contains(e.target) &&
        !hamburger.contains(e.target)) {
        hamburger.classList.remove('open');
        navLinks.classList.remove('open');
        document.body.style.overflow = '';
    }
});

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

