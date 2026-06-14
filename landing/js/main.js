/* CipherShield landing page — progressive enhancement only.
 * No tracking. No analytics. No external requests.
 * This file is optional — the page is fully readable without it.
 */

// Smooth scroll for anchor links (already handled by CSS scroll-behavior,
// this adds cross-browser fallback for older Tor Browser versions)
// Mobile nav toggle
var navToggle = document.getElementById('nav-toggle');
var navLinks  = document.getElementById('nav-links');
if (navToggle && navLinks) {
  navToggle.addEventListener('click', function () {
    var open = navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  // Close menu when a link is clicked
  navLinks.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      navLinks.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (e) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});
