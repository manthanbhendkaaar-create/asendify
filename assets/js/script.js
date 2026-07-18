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

const globeContainer =
document.getElementById("globe-container");



const scene = new THREE.Scene();



const camera = new THREE.PerspectiveCamera(
    45,
    globeContainer.offsetWidth /
    globeContainer.offsetHeight,
    0.1,
    1000
);

camera.position.z = 3;



const renderer = new THREE.WebGLRenderer({
    antialias:true,
    alpha:true
});

renderer.setSize(
    globeContainer.offsetWidth,
    globeContainer.offsetHeight
);

renderer.setPixelRatio(window.devicePixelRatio);

globeContainer.appendChild(renderer.domElement);



// LIGHTS

const ambient =
new THREE.AmbientLight(0xffffff,0.9);

scene.add(ambient);



const directional =
new THREE.DirectionalLight(0xffffff,1);

directional.position.set(5,3,5);

scene.add(directional);



// CONTROLS

const controls =
new THREE.OrbitControls(
    camera,
    renderer.domElement
);

controls.enableDamping = true;

controls.enablePan = false;

controls.rotateSpeed = 0.6;

controls.autoRotate = true;

controls.autoRotateSpeed = 0.45;



// EARTH TEXTURE

const loader =
new THREE.TextureLoader();

const earthTexture =
loader.load(
'https://threejs.org/examples/textures/planets/earth_lights_2048.png'
);



// EARTH

const earthGeometry =
new THREE.SphereGeometry(
    1.42,
    128,
    128
);

const earthMaterial =
new THREE.MeshStandardMaterial({
    map:earthTexture,
    roughness:1,
    metalness:0
});

const earth =
new THREE.Mesh(
    earthGeometry,
    earthMaterial
);

scene.add(earth);



// GLOW

const glowGeometry =
new THREE.SphereGeometry(
    1.46,
    128,
    128
);

const glowMaterial =
new THREE.MeshBasicMaterial({
    color:0xd4af37,
    transparent:true,
    opacity:0.06,
    side:THREE.BackSide
});

const glow =
new THREE.Mesh(
    glowGeometry,
    glowMaterial
);

scene.add(glow);



// UAE MARKER

function addMarker(lat, lon){

    const radius = 1.42;

    const phi =
    (90 - lat) *
    (Math.PI / 180);

    const theta =
    (lon + 180) *
    (Math.PI / 180);

    const x =
    -(radius *
    Math.sin(phi) *
    Math.cos(theta));

    const z =
    radius *
    Math.sin(phi) *
    Math.sin(theta);

    const y =
    radius *
    Math.cos(phi);



    const markerGeometry =
    new THREE.SphereGeometry(
        0.03,
        16,
        16
    );

    const markerMaterial =
    new THREE.MeshBasicMaterial({
        color:0xd4af37
    });

    const marker =
    new THREE.Mesh(
        markerGeometry,
        markerMaterial
    );

    marker.position.set(x,y,z);

    earth.add(marker);



    const ringGeometry =
    new THREE.RingGeometry(
        0.05,
        0.08,
        32
    );

    const ringMaterial =
    new THREE.MeshBasicMaterial({
        color:0xd4af37,
        transparent:true,
        opacity:0.8,
        side:THREE.DoubleSide
    });

    const ring =
    new THREE.Mesh(
        ringGeometry,
        ringMaterial
    );

    ring.position.set(x,y,z);

    ring.lookAt(
        new THREE.Vector3(0,0,0)
    );

    earth.add(ring);

}

addMarker(25.2048,55.2708);



// ANIMATION

function animate(){

    requestAnimationFrame(animate);

    controls.update();

    renderer.render(scene,camera);

}

animate();



// RESPONSIVE

window.addEventListener('resize',()=>{

    camera.aspect =
    globeContainer.offsetWidth /
    globeContainer.offsetHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        globeContainer.offsetWidth,
        globeContainer.offsetHeight
    );

});



