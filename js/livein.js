// Ljud in som spelas live: mikrofonen eller line-in (ljudkortets ingång – webbläsaren ser den som en mikrofon).
// Används av vocodern (js/synth.js: tonerna formas av ljudet in) och av Line-in i effektplattan
// (js/fxpad.js: ljudet in spelas genom plattans effekter).
//
// liveInAcquire(användare) öppnar ingången (en gång, delas av alla) och ger en GainNode med ljudet,
// eller null om det inte gick. liveInRelease(användare) – när ingen använder den längre stängs den
// (på iPhone låter allt annat tystare medan mikrofonen är öppen).
// Öppnas med micOpen (js/micrec.js): utan webbläsarens ekosläckning och brusreducering, som förstör musik.

const liveIn = { users: new Set(), stream: null, src: null, out: null, ctx: null, opening: null };
const liveInActive = () => liveIn.users.size > 0;

async function liveInAcquire(user) {
  liveIn.users.add(user);
  if (liveIn.out && liveIn.ctx === audioCtx) return liveIn.out;
  if (!liveIn.opening) liveIn.opening = liveInOpen().finally(() => { liveIn.opening = null; });
  const out = await liveIn.opening;
  return out && liveIn.users.has(user) ? out : null;
}

async function liveInOpen() {
  if (!navigator.mediaDevices?.getUserMedia) {
    log(t(window.isSecureContext === false ? 'Mikrofonen fungerar bara när sidan öppnas med https.' : 'Den här webbläsaren kan inte spela in från mikrofonen.'));
    liveIn.users.clear();
    return null;
  }
  if (!audioCtx) { try { initAudio(); } catch {} }
  if (!audioCtx) return null;
  let stream;
  try {
    stream = await micOpen();
  } catch (err) {
    log(micErrorText(err), 'error');
    liveIn.users.clear();
    return null;
  }
  if (!liveIn.users.size) { // (ingen vill ha den längre)
    stream.getTracks().forEach((tr) => tr.stop());
    micSession(false);
    return null;
  }
  liveIn.stream = stream;
  liveIn.ctx = audioCtx;
  liveIn.src = audioCtx.createMediaStreamSource(stream);
  liveIn.out = audioCtx.createGain();
  liveIn.src.connect(liveIn.out);
  // Om ingången försvinner (sladden dras ur, ett samtal tar mikrofonen) stängs den
  stream.getTracks().forEach((tr) => tr.addEventListener('ended', () => {
    log(t('Ljudet in (mikrofon/line-in) stängdes.'));
    liveInClose();
  }));
  wakeAudio(); // iPhone kan pausa ljudet när mikrofonen öppnas
  log(t('Lyssnar på mikrofonen/line-in.'));
  return liveIn.out;
}

function liveInRelease(user) {
  liveIn.users.delete(user);
  if (!liveIn.users.size) liveInClose();
}

function liveInClose() {
  if (!liveIn.stream) return;
  liveIn.stream.getTracks().forEach((tr) => tr.stop());
  try { liveIn.src.disconnect(); } catch {}
  try { liveIn.out.disconnect(); } catch {}
  Object.assign(liveIn, { stream: null, src: null, out: null, ctx: null });
  if (typeof mic === 'undefined' || !mic.on) micSession(false);
}
