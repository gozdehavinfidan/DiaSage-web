// DiaSage — App Entry (ES module).
//
// Orchestrates: the 3D viewer (Agent B's modules), authentication,
// QR login modal, patient-monitor dashboard, and miscellaneous UI behaviors
// (theme toggle, navbar scroll, smooth scroll, reveal animations, hero
// parallax, sliding phone carousel).
//
// Exposes globals on `window` so inline `onclick="..."` attributes in
// index.html can still reach the functions that have moved into modules.
//
// Load order contract: this file is loaded as `<script type="module">` AFTER
//   - firebase-*-compat.js  (provides window.firebase)
//   - qrcode.min.js         (provides window.QRCode)
//   - three.min.js          (provides window.THREE)
//   - STLLoader.js          (extends window.THREE)
// The defer-like semantics of `type="module"` guarantee DOMContentLoaded has
// effectively fired when the module executes its top-level code.

import { createScene } from './features/viewer/scene.js';
import { loadStlParts } from './features/viewer/stl-loader.js';
import { setupInteractions } from './features/viewer/interactions.js';

import { initAuth } from './features/auth/auth.js';

import {
  openQRModal,
  closeQRModal,
  handleDoctorAuth,
  toggleDoctorAuthMode,
} from './features/dashboard/qr-link.js';

import {
  openMonitor,
  closeMonitor,
} from './features/dashboard/patient-monitor.js';

// ==================== THEME TOGGLE ====================
function toggleTheme() {
  const html = document.documentElement;
  const newTheme = html.dataset.theme === 'dark' ? 'light' : 'dark';
  html.dataset.theme = newTheme;
  localStorage.setItem('diasage-theme', newTheme);
}

function initTheme() {
  const saved = localStorage.getItem('diasage-theme');
  if (saved) document.documentElement.dataset.theme = saved;
}

// ==================== MOBILE NAV ====================
function toggleMobileNav() {
  const el = document.getElementById('mobileNav');
  if (el) el.classList.toggle('open');
}

// ==================== NAVBAR SCROLL ====================
function initNavbarScroll() {
  const nav = document.getElementById('navbar');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  });
}

// ==================== SCROLL REVEAL ====================
function initRevealAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
}

// ==================== SMOOTH SCROLL ====================
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      const offset = 80;
      const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
}

// ==================== HERO PARALLAX ====================
function initHeroParallax() {
  window.addEventListener('scroll', () => {
    const scroll = window.scrollY;
    document.querySelectorAll('.hero-orb').forEach((orb, i) => {
      const speed = 0.1 + i * 0.05;
      orb.style.transform = `translateY(${scroll * speed}px)`;
    });
  });
}

// ==================== PHONE CAROUSEL ====================
function initPhoneCarousel() {
  const wrap = document.querySelector('.app-carousel-wrap');
  const stage = document.getElementById('appStage');
  const dotsContainer = document.getElementById('appDots');
  const infoInner = document.getElementById('appSlideInfoInner');
  const infoTitle = document.getElementById('appSlideTitle');
  const infoDesc = document.getElementById('appSlideDesc');
  if (!stage || !dotsContainer || !wrap) return;

  const phones = Array.from(stage.querySelectorAll('.phone-mockup'));
  const total = phones.length;
  let current = phones.findIndex((p) => p.classList.contains('active'));
  if (current === -1) current = Math.floor(total / 2);
  let autoTimer = null;

  phones.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'app-dot' + (i === current ? ' active' : '');
    dot.setAttribute('aria-label', phones[i].dataset.label || 'Slide ' + (i + 1));
    dot.addEventListener('click', () => goTo(i));
    dotsContainer.appendChild(dot);
  });
  const dots = Array.from(dotsContainer.querySelectorAll('.app-dot'));

  function updateInfoPanel() {
    const phone = phones[current];
    const title = phone.dataset.label || '';
    const desc = phone.dataset.desc || '';
    if (infoInner) {
      infoInner.classList.add('fade-out');
      setTimeout(() => {
        if (infoTitle) infoTitle.textContent = title;
        if (infoDesc) infoDesc.textContent = desc;
        infoInner.classList.remove('fade-out');
      }, 300);
    }
  }

  function update() {
    phones.forEach((phone, i) => {
      phone.classList.remove('active', 'near');
      if (i === current) phone.classList.add('active');
      else if (Math.abs(i - current) === 1) phone.classList.add('near');
    });
    dots.forEach((dot, i) => dot.classList.toggle('active', i === current));

    const wrapWidth = wrap.offsetWidth;
    const phone = phones[current];
    const phoneLeft = phone.offsetLeft;
    const phoneWidth = phone.offsetWidth;
    const offset = wrapWidth / 2 - phoneLeft - phoneWidth / 2;
    stage.style.transform = `translateX(${offset}px)`;

    updateInfoPanel();
  }

  function goTo(index) {
    current = ((index % total) + total) % total;
    update();
    resetAutoplay();
  }

  function next() { goTo(current + 1); }

  function resetAutoplay() {
    clearInterval(autoTimer);
    autoTimer = setInterval(next, 4000);
  }

  phones.forEach((phone, i) => phone.addEventListener('click', () => goTo(i)));
  wrap.addEventListener('mouseenter', () => clearInterval(autoTimer));
  wrap.addEventListener('mouseleave', resetAutoplay);
  window.addEventListener('resize', () => update());

  update();
  resetAutoplay();
}

// ==================== LOGIN BUTTON WIRE-UP ====================
function initLoginButton() {
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openQRModal();
    });
  }
}

// ==================== 3D VIEWER BOOT ====================
async function boot3DViewer() {
  const canvas = document.getElementById('watch-3d-canvas');
  if (!canvas) return;
  try {
    const sceneCtx = createScene(canvas);
    const { watchGroup } = await loadStlParts(sceneCtx);
    setupInteractions({ ...sceneCtx, watchGroup, canvas });
  } catch (err) {
    console.error('3D viewer init failed:', err);
  }
}

// ==================== GLOBAL BRIDGES for inline onclick= ====================
// The source HTML has many inline onclick handlers (toggleTheme, toggleMobileNav,
// openQRModal, closeQRModal, closeMonitor, handleDoctorAuth, toggleDoctorAuthMode).
// Module scope is isolated, so we must expose these on window.
window.toggleTheme = toggleTheme;
window.toggleMobileNav = toggleMobileNav;
window.openQRModal = openQRModal;
window.closeQRModal = closeQRModal;
window.handleDoctorAuth = handleDoctorAuth;
window.toggleDoctorAuthMode = toggleDoctorAuthMode;
window.openMonitor = openMonitor;
window.closeMonitor = closeMonitor;

// ==================== BOOT ====================
function boot() {
  initTheme();
  initNavbarScroll();
  initRevealAnimations();
  initSmoothScroll();
  initHeroParallax();
  initPhoneCarousel();
  initLoginButton();

  // Auth observer — reserved for future UI updates. Currently the site uses
  // the QR-modal local listener to pick up sign-in status when opening the
  // modal, so this subscription is only for logging/telemetry.
  initAuth((user) => {
    // eslint-disable-next-line no-console
    console.debug('[auth] state changed:', user ? user.email : 'signed out');
  });

  boot3DViewer();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
