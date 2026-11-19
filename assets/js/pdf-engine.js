/*
 * Loads the PDF engine (pdf-lib + pdf-clean.js, ~550 KB) only when it's needed,
 * so it doesn't slow down the first page load. Call `await loadPdfEngine()` before using PdfClean.
 */
(function () {
  let pending = null;
  function add(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(Object.assign(new Error('The PDF tool could not load. Check your connection and try again.'), { code: 'ENGINE' }));
      document.head.appendChild(s);
    });
  }
  window.loadPdfEngine = function () {
    if (window.PdfClean) return Promise.resolve();
    if (!pending) {
      pending = add('/assets/js/pdf-lib.min.js').then(() => add('/assets/js/pdf-clean.js'));
      pending.catch(() => { pending = null; });
    }
    return pending;
  };
  // Start downloading as soon as the visitor shows intent, so it's ready when they drop a file.
  const warm = () => window.loadPdfEngine().catch(() => {});
  ['pointerdown', 'touchstart', 'keydown', 'dragenter'].forEach(ev => window.addEventListener(ev, warm, { once: true, passive: true }));
  document.addEventListener('DOMContentLoaded', () => {
    const zone = document.getElementById('dropZone');
    if (zone) zone.addEventListener('pointerenter', warm, { once: true });
  });
})();
