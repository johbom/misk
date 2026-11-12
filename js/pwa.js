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

  // Installera-knappen uppe till höger syns bara när webbläsaren själv kan installera (Chrome, Edge, Android).
  // Knappen på startrutan syns alltid (utom i den installerade appen): finns webbläsarens installation
  // används den, annars visas hur man installerar i just den här webbläsaren.
  const headerBtn = $('install-btn');
  const startBtn = $('start-install-btn');
  const how = $('start-install-how');
  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    headerBtn.hidden = false;
  });
  const install = async () => {
    if (!deferred) return false;
    const d = deferred;
    deferred = null;
    headerBtn.hidden = true;
    d.prompt();
    await d.userChoice;
    return true;
  };
  headerBtn.addEventListener('click', install);
  startBtn.addEventListener('click', async () => {
    if (await install()) return;
    how.textContent = installHowTo();
    how.hidden = !how.hidden;
    startBtn.setAttribute('aria-expanded', !how.hidden);
  });
  window.addEventListener('appinstalled', () => {
    headerBtn.hidden = true;
    $('start-install').hidden = true;
    log('Hover Pads är installerad som app.');
  });

  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (!standalone) $('start-install').hidden = false;

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
  return 'Använd installera-ikonen i adressfältet eller webbläsarens meny (Installera Hover Pads). Finns inget sådant val kan appen redan vara installerad.';
}
