// PWA: registrerar service workern (offline + installation) och visar en Installera-knapp
// där webbläsaren erbjuder det (Chrome/Edge/Android). På iPhone/iPad: Dela → Lägg till på hemskärmen.

function setupPwa() {
  // Versionen (samma som ?v= på skripten) visas längst ned i Om-rutan
  const v = document.querySelector('script[src*="main.js"]')?.src.match(/[?&]v=(\d+)/)?.[1];
  $('about-version').textContent = v || '?';
  const dev = ['localhost', '127.0.0.1'].includes(location.hostname);
  // Under utveckling används ingen cache, om man inte ber om det med ?pwa
  if ('serviceWorker' in navigator && (!dev || new URLSearchParams(location.search).has('pwa'))) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) log('En ny version av appen är installerad – ladda om när det passar.');
    });
  }

  const btn = $('install-btn');
  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    btn.hidden = false;
  });
  btn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    btn.hidden = true;
  });
  window.addEventListener('appinstalled', () => {
    btn.hidden = true;
    log('Hover Pads är installerad som app.');
  });

  // Om-rutan: säg till när appen redan körs installerad
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const status = $('about-install-status');
  if (standalone) {
    status.textContent = 'Du kör redan Hover Pads som installerad app.';
    status.hidden = false;
  }
}
