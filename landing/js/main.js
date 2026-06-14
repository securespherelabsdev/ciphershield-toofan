/* CipherShield landing page — progressive enhancement only.
 * No tracking. No analytics. No external requests.
 * This file is optional — the page is fully readable without it.
 */

// Smooth scroll for anchor links (already handled by CSS scroll-behavior,
// this adds cross-browser fallback for older Tor Browser versions)
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (e) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});
