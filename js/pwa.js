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

  // Installera-knappar: uppe till höger och på startrutan
  const btns = [$('install-btn'), $('start-install-btn')];
  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    btns.forEach((b) => { b.hidden = false; });
  });
  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    btns.forEach((b) => { b.hidden = true; });
  };
  btns.forEach((b) => b.addEventListener('click', install));
  window.addEventListener('appinstalled', () => {
    btns.forEach((b) => { b.hidden = true; });
    $('start-install').hidden = true;
    log('Hover Pads är installerad som app.');
  });

  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  // Startrutan: berätta att appen går att installera, och hur i just den här webbläsaren
  if (!standalone) {
    $('start-install-how').textContent = installHowTo();
    $('start-install').hidden = false;
  }

  // Om-rutan: säg till när appen redan körs installerad
  const status = $('about-install-status');
  if (standalone) {
    status.textContent = 'Du kör redan Hover Pads som installerad app.';
    status.hidden = false;
  }
}

// Kort instruktion för att installera i den webbläsare som används (mer i Om-rutan)
function installHowTo() {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return 'Tryck på Dela (fyrkanten med en pil uppåt) och välj Lägg till på hemskärmen.';
  if (/Android/.test(ua)) return 'Öppna webbläsarens meny ⋮ och välj Installera app.';
  if (/Firefox\//.test(ua)) return 'Öppna sidan i Chrome, Edge eller Safari för att installera.';
  if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua)) {
    return 'I Safari: välj Arkiv → Lägg till i Dock.';
  }
  return 'Tryck på Installera eller på installera-ikonen i adressfältet.';
}
