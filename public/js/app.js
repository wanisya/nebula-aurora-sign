import { createHandLandmarker } from './hand-tracker.js';
import { analyzeHands, detectHeartPair, HAND_CONNECTIONS, GESTURE_LABEL } from './gestures.js';
import { FX } from './effects.js';
import { createIntro } from './background.js';
import { PALETTES, TAU, rand, dist, starSprite } from './palettes.js';

const $ = (s) => document.querySelector(s);

const els = {
  landing: $('#landing'),
  studio: $('#studio'),
  sky: $('#sky-canvas'),
  demo: $('#demo-canvas'),
  stage: $('#stage'),
  video: $('#cam'),
  loader: $('#loader'),
  loaderText: $('#loader-text'),
  loaderError: $('#loader-error'),
  errTitle: $('#err-title'),
  errMsg: $('#err-msg'),
  hint: $('#hint'),
  guide: $('#guide'),
  guideTitle: $('#guide-title'),
  guideList: $('#guide-list'),
  toasts: $('#toasts'),
  statusText: $('#status-text'),
  status: $('#status'),
  viewLabel: $('#view-label'),
  paletteLabel: $('#palette-label'),
  swatch: $('#swatch'),
  recLabel: $('#rec-label'),
  galleryCount: $('#gallery-count'),
  galleryGrid: $('#gallery-grid'),
  drawer: $('#drawer'),
  flash: $('#flash'),
};

const MODES = {
  galaxy: {
    title: 'Mode Galaksi',
    hint: '☝️ Tunjuk untuk melukis debu bintang · 🤏 Cubit untuk memunculkan galaksi · ✊ Kepal = black hole',
    gestures: [
      { g: 'point', icon: '☝️', name: 'Tunjuk', desc: 'Gerakkan telunjuk untuk melukis debu bintang.' },
      { g: 'pinch', icon: '🤏', name: 'Cubit', desc: 'Satukan jempol & telunjuk untuk memunculkan galaksi spiral.' },
      { g: 'open', icon: '🖐️', name: 'Buka telapak', desc: 'Telapak mengeluarkan awan nebula.' },
      { g: 'fist', icon: '✊', name: 'Kepal', desc: 'Black hole menyedot semuanya. Lepas kepalan = BIG BANG lalu lahir galaksi baru.' },
    ],
  },
  constellation: {
    title: 'Mode Rasi Bintang',
    hint: '☝️ Tahan telunjuk diam untuk menaruh bintang · ✊ Kepal untuk menyalakan · 🖐️ Buka tangan untuk make a wish',
    gestures: [
      { g: 'point', icon: '☝️', name: 'Tunjuk & tahan', desc: 'Diamkan telunjuk sebentar untuk menaruh bintang.' },
      { g: 'pinch', icon: '🤏', name: 'Cubit', desc: 'Cara cepat menaruh bintang.' },
      { g: 'fist', icon: '✊', name: 'Kepal', desc: 'Nyalakan bintang & sambungkan jadi rasi.' },
      { g: 'open', icon: '🖐️', name: 'Buka telapak', desc: 'Make a wish! Hujan bintang jatuh.' },
    ],
  },
  heart: {
    title: 'Mode Nebula Heart',
    hint: '🫶 Bentuk hati dengan dua tangan · 🤏 Cubit untuk hati kecil · ✊ Kepal untuk memecahkan hati',
    gestures: [
      { g: 'heart2', icon: '🫶', name: 'Hati dua tangan', desc: 'Satukan telunjuk di atas & jempol di bawah untuk Nebula Heart raksasa yang berdetak.' },
      { g: 'pinch', icon: '🤏', name: 'Cubit', desc: 'Munculkan hati nebula kecil yang melayang.' },
      { g: 'point', icon: '☝️', name: 'Tunjuk', desc: 'Lukis jejak cahaya pink.' },
      { g: 'open', icon: '🖐️', name: 'Buka telapak', desc: 'Awan nebula pink.' },
      { g: 'fist', icon: '✊', name: 'Kepal', desc: 'Pecahkan semua hati menjadi kelopak cahaya.' },
    ],
  },
};

const COMMON_GESTURES = [
  { g: 'peace', icon: '✌️', name: 'Peace', desc: 'Ganti palet warna.' },
  { g: 'heart2', icon: '🫶', name: 'Hati dua tangan', desc: 'Nebula Heart di mode apa pun.' },
];

const VIEWS = [
  { id: 'dim', label: 'Redup' },
  { id: 'camera', label: 'Kamera' },
  { id: 'space', label: 'Angkasa' },
];

const state = {
  mode: 'galaxy',
  viewIdx: 0,
  skeleton: true,
  paletteIdx: 0,
  running: false,
  landmarker: null,
  stream: null,
  lastVideoTime: -1,
  result: null,
  hands: [],
  handStore: new Map(),
  lastNow: 0,
  lastPeace: 0,
  heartFrames: 0,
  heartLive: null,
  recorder: null,
  recStart: 0,
  gallery: [],
  lastStatus: 0,
  mouse: { down: false, x: 0, y: 0, moved: 0 },
  W: 1, H: 1, dpr: 1,
  cover: { dw: 1, dh: 1, ox: 0, oy: 0 },
};

const ctx = els.stage.getContext('2d');
const fx = new FX();
const intro = createIntro(els.sky, els.demo);
intro.start();

// ---------- Toast ----------
function toast(text, ms = 2200) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  els.toasts.appendChild(el);
  while (els.toasts.children.length > 3) els.toasts.firstChild.remove();
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 400);
  }, ms);
}

fx.onEvent = (type, data) => {
  if (type === 'galaxy' && state.running) toast('🌌 Galaksi baru lahir');
  if (type === 'blackhole') toast('🕳️ Black hole! Lepaskan kepalan untuk Big Bang');
  if (type === 'bigbang') toast(data.mass > 30 ? '💥 BIG BANG! Galaksi baru terbentuk' : '💥 Big Bang!');
  if (type === 'heart') toast('💖 Nebula Heart!');
  if (type === 'star' && data.count === 1) toast('⭐ Bintang pertama! Taruh beberapa lagi, lalu kepalkan tangan');
  if (type === 'lit') toast(`✨ Rasi ${data.count} bintang menyala! Buka tangan untuk make a wish`);
  if (type === 'wish') toast('🌠 Permintaanmu sudah dikirim ke bintang…', 3200);
};

// ---------- Layout & mapping kamera ----------
function resize() {
  state.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  state.W = window.innerWidth;
  state.H = window.innerHeight;
  els.stage.width = Math.round(state.W * state.dpr);
  els.stage.height = Math.round(state.H * state.dpr);
  fx.resize(state.W, state.H);
  updateCover();
}

function updateCover() {
  const vw = els.video.videoWidth || 1280;
  const vh = els.video.videoHeight || 720;
  const s = Math.max(state.W / vw, state.H / vh);
  const dw = vw * s, dh = vh * s;
  state.cover = { dw, dh, ox: (state.W - dw) / 2, oy: (state.H - dh) / 2 };
}

// Landmark ternormalisasi -> piksel layar (dicerminkan seperti selfie).
function toScreen(p) {
  const c = state.cover;
  return { x: state.W - (c.ox + p.x * c.dw), y: c.oy + p.y * c.dh };
}

window.addEventListener('resize', () => state.running && resize());
els.video.addEventListener('loadedmetadata', updateCover);

// ---------- Mulai / berhenti ----------
function showLoader(text) {
  els.loader.hidden = false;
  els.loaderError.hidden = true;
  els.loaderText.hidden = false;
  els.loaderText.textContent = text;
  els.loader.querySelector('.orbit').hidden = false;
}

function showError(title, msg) {
  els.loader.hidden = false;
  els.loaderText.hidden = true;
  els.loader.querySelector('.orbit').hidden = true;
  els.loaderError.hidden = false;
  els.errTitle.textContent = title;
  els.errMsg.textContent = msg;
}

async function start() {
  if (state.running) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    showError('Browser tidak mendukung kamera', 'Gunakan Chrome / Edge / Safari terbaru, dan buka lewat http://localhost atau https.');
    return;
  }
  showLoader('Meminta izin kamera…');
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  } catch (err) {
    const denied = err.name === 'NotAllowedError' || err.name === 'SecurityError';
    showError(
      denied ? 'Izin kamera ditolak' : 'Kamera tidak bisa dibuka',
      denied
        ? 'Klik ikon kamera di address bar, izinkan akses, lalu coba lagi.'
        : `Pastikan kamera tidak dipakai aplikasi lain. (${err.name})`,
    );
    return;
  }
  els.video.srcObject = state.stream;
  await els.video.play().catch(() => {});

  if (!state.landmarker) {
    showLoader('Memuat model pendeteksi tangan… (hanya lama di awal)');
    try {
      state.landmarker = await createHandLandmarker();
    } catch (err) {
      console.error(err);
      stopStream();
      showError('Model tangan gagal dimuat', 'Periksa koneksi internet (model MediaPipe diunduh dari CDN), lalu coba lagi.');
      return;
    }
  }

  els.loader.hidden = true;
  intro.stop();
  els.landing.hidden = true;
  els.studio.hidden = false;
  document.body.classList.add('in-studio');
  resize();
  setMode(state.mode);
  state.running = true;
  state.lastNow = performance.now();
  requestAnimationFrame(loop);
  toast('👋 Angkat tanganmu ke depan kamera');
}

function stopStream() {
  state.stream?.getTracks().forEach((t) => t.stop());
  state.stream = null;
  els.video.srcObject = null;
}

function exitStudio() {
  if (state.recorder) state.recorder.stop();
  state.running = false;
  stopStream();
  state.result = null;
  state.lastVideoTime = -1;
  state.handStore.clear();
  els.studio.hidden = true;
  els.landing.hidden = false;
  els.drawer.classList.remove('open');
  document.body.classList.remove('in-studio');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  intro.start();
}

// ---------- Mode, tampilan, palet ----------
function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll('[data-mode]').forEach((b) => {
    const on = b.dataset.mode === mode;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on);
  });
  const m = MODES[mode];
  els.hint.textContent = m.hint;
  els.guideTitle.textContent = m.title;
  const list = [...m.gestures, ...COMMON_GESTURES.filter((c) => !m.gestures.some((g) => g.g === c.g))];
  els.guideList.innerHTML = list
    .map((g) => `<li data-g="${g.g}"><span class="gi">${g.icon}</span><div><b>${g.name}</b><small>${g.desc}</small></div></li>`)
    .join('');
}

function cycleView() {
  state.viewIdx = (state.viewIdx + 1) % VIEWS.length;
  els.viewLabel.textContent = VIEWS[state.viewIdx].label;
  toast(`🎛️ Tampilan: ${VIEWS[state.viewIdx].label}`, 1200);
}

function setPalette(i) {
  state.paletteIdx = (i + PALETTES.length) % PALETTES.length;
  const p = PALETTES[state.paletteIdx];
  fx.setPalette(p);
  els.paletteLabel.textContent = p.name;
  els.swatch.style.background = `linear-gradient(135deg, ${p.colors[2]}, ${p.colors[1]}, ${p.colors[0]})`;
}

function cyclePalette() {
  setPalette(state.paletteIdx + 1);
  toast(`🎨 Palet: ${PALETTES[state.paletteIdx].name}`, 1400);
}

// ---------- Interaksi gestur ----------
function handleHands(hands, dt, now) {
  if (state.heartLive && !fx.hearts.includes(state.heartLive)) state.heartLive = null;

  const pair = detectHeartPair(hands);
  state.heartFrames = pair ? state.heartFrames + 1 : 0;
  if (!pair && state.heartLive) {
    state.heartLive.live = false;
    state.heartLive = null;
  }
  if (pair) {
    if (state.heartFrames >= 4) {
      if (!state.heartLive) state.heartLive = fx.spawnHeart(pair.x, pair.y, pair.size, { live: true });
      else fx.moveHeart(state.heartLive, pair.x, pair.y, pair.size);
    }
    hands.forEach((h) => { h.st.drawPrev = null; });
    return;
  }

  for (const h of hands) {
    const st = h.st;
    if (h.gesture === 'peace' && h.entered && now - state.lastPeace > 1200) {
      state.lastPeace = now;
      cyclePalette();
    }
    const pointing = h.gesture === 'point';

    if (state.mode === 'galaxy') {
      if (pointing && st.drawPrev) fx.drawTrail(st.drawPrev.x, st.drawPrev.y, h.tip.x, h.tip.y);
      if (h.gesture === 'pinch' && h.entered) fx.spawnGalaxy(h.pinchPt.x, h.pinchPt.y);
      if (h.gesture === 'fist') fx.holdBlackHole(h.palm.x, h.palm.y);
      if (h.gesture === 'open') fx.emitNebula(h.palm.x, h.palm.y, dt);
    } else if (state.mode === 'constellation') {
      updateDwell(h, now);
      if (h.gesture === 'pinch' && h.entered) fx.placeStar(h.pinchPt.x, h.pinchPt.y);
      if (h.gesture === 'fist' && h.entered && !fx.lightConstellation()) {
        if (!fx.constellations.length || fx.constellations[fx.constellations.length - 1].lit) {
          toast('☝️ Taruh beberapa bintang dulu ya', 1500);
        }
      }
      if (h.gesture === 'open' && h.entered) fx.makeWish();
    } else if (state.mode === 'heart') {
      if (pointing && st.drawPrev) fx.drawTrail(st.drawPrev.x, st.drawPrev.y, h.tip.x, h.tip.y, { persist: false, heart: true });
      if (h.gesture === 'pinch' && h.entered) fx.spawnHeart(h.pinchPt.x, h.pinchPt.y, rand(38, 60), { small: true });
      if (h.gesture === 'open') fx.emitNebula(h.palm.x, h.palm.y, dt, true);
      if (h.gesture === 'fist' && h.entered && fx.shatterHearts()) toast('💗 Hati pecah jadi kelopak cahaya', 1400);
    }
    st.drawPrev = pointing ? { ...h.tip } : null;
  }
}

// Mode rasi: tahan telunjuk diam ±0,55 detik untuk menaruh bintang.
function updateDwell(h, now) {
  const st = h.st;
  h.dwell = 0;
  if (h.gesture !== 'point') { st.dwellAnchor = null; return; }
  if (!st.dwellAnchor || dist(st.dwellAnchor, h.tip) > 16) {
    st.dwellAnchor = { ...h.tip };
    st.dwellStart = now;
    st.dwellDone = false;
    return;
  }
  if (st.dwellDone) return;
  h.dwell = Math.min(1, (now - st.dwellStart) / 550);
  if (h.dwell >= 1) {
    st.dwellDone = true;
    const last = fx.lastStar();
    if (!last || dist(last, h.tip) > 30) fx.placeStar(h.tip.x, h.tip.y);
  }
}

// ---------- Render ----------
function drawBackdrop(t) {
  const { W, H } = state;
  const view = VIEWS[state.viewIdx].id;
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  if (view === 'space' || !els.video.videoWidth) {
    ctx.fillStyle = '#050816';
    ctx.fillRect(0, 0, W, H);
    drawAurora(t, 1);
    fx.renderAmbient(ctx, 1);
    return;
  }

  const c = state.cover;
  ctx.save();
  ctx.translate(W, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(els.video, c.ox, c.oy, c.dw, c.dh);
  ctx.restore();

  if (view === 'dim') {
    ctx.fillStyle = 'rgba(5, 6, 26, 0.58)';
    ctx.fillRect(0, 0, W, H);
    drawAurora(t, 0.45);
    fx.renderAmbient(ctx, 0.6);
  } else {
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(5,6,26,0)');
    v.addColorStop(1, 'rgba(5,6,26,0.55)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    fx.renderAmbient(ctx, 0.25);
  }
}

// Cahaya aurora: biru galaksi + pink aurora yang bergerak perlahan.
function drawAurora(t, k) {
  const { W, H } = state;
  const blobs = [
    { x: 0.2 + 0.08 * Math.sin(t * 0.13), y: 0.25 + 0.06 * Math.cos(t * 0.11), r: 0.6, c: [60, 90, 255], a: 0.35 },
    { x: 0.82 + 0.07 * Math.cos(t * 0.1), y: 0.18 + 0.08 * Math.sin(t * 0.12), r: 0.55, c: [255, 79, 184], a: 0.32 },
    { x: 0.55 + 0.1 * Math.sin(t * 0.08), y: 0.95, r: 0.7, c: [157, 78, 221], a: 0.3 },
  ];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const b of blobs) {
    const x = b.x * W, y = b.y * H, R = b.r * Math.max(W, H);
    const g = ctx.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, `rgba(${b.c},${b.a * k})`);
    g.addColorStop(1, `rgba(${b.c},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

const GESTURE_COLOR = { point: '#8fd3ff', pinch: '#ff7ad9', fist: '#c77dff', open: '#80ffdb', peace: '#ffd6a5' };

function drawHands(hands) {
  ctx.save();
  ctx.lineCap = 'round';
  for (const h of hands) {
    const col = GESTURE_COLOR[h.gesture] || '#ffffff';
    if (state.skeleton) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = 'rgba(235,225,255,0.8)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (const [a, b] of HAND_CONNECTIONS) {
        ctx.moveTo(h.pts[a].x, h.pts[a].y);
        ctx.lineTo(h.pts[b].x, h.pts[b].y);
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.9;
      h.pts.forEach((p, i) => {
        const R = [4, 8, 12, 16, 20].includes(i) ? 9 : 5;
        ctx.drawImage(starSprite(col), p.x - R, p.y - R, R * 2, R * 2);
      });
    }

    // Kursor di ujung telunjuk / titik cubit.
    ctx.globalCompositeOperation = 'lighter';
    const c = h.gesture === 'pinch' ? h.pinchPt : h.gesture === 'fist' || h.gesture === 'open' ? h.palm : h.tip;
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(c.x, c.y, h.gesture === 'pinch' ? 10 : 14, 0, TAU);
    ctx.stroke();
    if (h.dwell > 0) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#fff2fb';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 20, -Math.PI / 2, -Math.PI / 2 + TAU * h.dwell);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function render(t) {
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  drawBackdrop(t);
  fx.render(ctx);
  drawHands(state.hands);
}

// ---------- Loop utama ----------
function loop(now) {
  if (!state.running) return;
  const dt = Math.min(0.05, (now - state.lastNow) / 1000 || 0.016);
  state.lastNow = now;

  const v = els.video;
  if (state.landmarker && v.readyState >= 2 && v.currentTime !== state.lastVideoTime) {
    state.lastVideoTime = v.currentTime;
    try {
      state.result = state.landmarker.detectForVideo(v, now);
    } catch (err) {
      console.warn(err);
    }
  }

  state.hands = analyzeHands(state.result, toScreen, state.handStore);
  handleHands(state.hands, dt, now);
  handleMouse();
  fx.update(dt);
  render(now / 1000);
  updateStatus(now);
  requestAnimationFrame(loop);
}

function updateStatus(now) {
  if (now - state.lastStatus < 150) return;
  state.lastStatus = now;
  const hands = state.hands;
  const heart = state.heartFrames >= 4;
  els.status.classList.toggle('live', hands.length > 0);
  els.statusText.textContent = !hands.length
    ? 'Mencari tangan…'
    : heart
      ? '🫶 Hati dua tangan'
      : hands.map((h) => GESTURE_LABEL[h.gesture] || '…').join('  ·  ');
  const active = new Set(heart ? ['heart2'] : hands.map((h) => h.gesture));
  els.guideList.querySelectorAll('li').forEach((li) => li.classList.toggle('active', active.has(li.dataset.g)));
  if (state.recorder) {
    const s = Math.floor((now - state.recStart) / 1000);
    els.recLabel.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }
}

// ---------- Mouse / touch (cadangan kalau tanpa tangan) ----------
const mouse = state.mouse;
els.stage.addEventListener('pointerdown', (e) => {
  mouse.down = true;
  mouse.x = mouse.px = e.clientX;
  mouse.y = mouse.py = e.clientY;
  mouse.moved = 0;
  els.stage.setPointerCapture(e.pointerId);
});
els.stage.addEventListener('pointermove', (e) => {
  if (!mouse.down) return;
  mouse.moved += Math.hypot(e.clientX - mouse.x, e.clientY - mouse.y);
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});
els.stage.addEventListener('pointerup', () => {
  if (!mouse.down) return;
  mouse.down = false;
  if (mouse.moved < 6) {
    if (state.mode === 'galaxy') fx.spawnGalaxy(mouse.x, mouse.y);
    else if (state.mode === 'constellation') fx.placeStar(mouse.x, mouse.y);
    else fx.spawnHeart(mouse.x, mouse.y, rand(38, 60), { small: true });
  }
});

function handleMouse() {
  if (!mouse.down || mouse.moved < 6) return;
  if (state.mode !== 'constellation') {
    fx.drawTrail(mouse.px, mouse.py, mouse.x, mouse.y, { persist: state.mode === 'galaxy', heart: state.mode === 'heart' });
  }
  mouse.px = mouse.x;
  mouse.py = mouse.y;
}

// ---------- Foto, video, galeri ----------
function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function takePhoto() {
  els.flash.classList.remove('go');
  void els.flash.offsetWidth;
  els.flash.classList.add('go');
  els.stage.toBlob((blob) => {
    if (blob) addToGallery('photo', blob, `nebula-aurora-sign-${stamp()}.png`);
  }, 'image/png');
}

function toggleRecord() {
  if (state.recorder) {
    state.recorder.stop();
    return;
  }
  if (!window.MediaRecorder || !els.stage.captureStream) {
    toast('Browser ini belum mendukung rekam video');
    return;
  }
  const mime = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm']
    .find((m) => MediaRecorder.isTypeSupported(m)) || '';
  const stream = els.stage.captureStream(30);
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.onstop = () => {
    stream.getTracks().forEach((t) => t.stop());
    const type = rec.mimeType || 'video/webm';
    const ext = type.includes('mp4') ? 'mp4' : 'webm';
    addToGallery('video', new Blob(chunks, { type }), `nebula-aurora-sign-${stamp()}.${ext}`);
    state.recorder = null;
    document.body.classList.remove('recording');
    els.recLabel.textContent = 'Rekam';
  };
  rec.start(250);
  state.recorder = rec;
  state.recStart = performance.now();
  document.body.classList.add('recording');
  toast('🔴 Merekam… tekan lagi untuk berhenti', 1600);
}

function addToGallery(type, blob, name) {
  const url = URL.createObjectURL(blob);
  state.gallery.unshift({ type, url, name });
  els.galleryCount.textContent = state.gallery.length;
  renderGallery();
  toast(type === 'photo' ? '📸 Foto tersimpan di galeri' : '🎬 Video tersimpan di galeri', 1600);
}

function renderGallery() {
  if (!state.gallery.length) {
    els.galleryGrid.innerHTML = '<p class="empty">Belum ada hasil. Tekan tombol bulat untuk foto ✨</p>';
    return;
  }
  els.galleryGrid.innerHTML = state.gallery
    .map((g) => `
      <figure class="shot">
        ${g.type === 'photo'
          ? `<img src="${g.url}" alt="Hasil foto">`
          : `<video src="${g.url}" muted loop playsinline autoplay></video><span class="badge">VIDEO</span>`}
        <a class="dl" href="${g.url}" download="${g.name}">⬇ Unduh</a>
      </figure>`)
    .join('');
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen?.().catch(() => {});
}

// ---------- Tombol & keyboard ----------
const actions = {
  start,
  cancel() {
    els.loader.hidden = true;
    stopStream();
  },
  exit: exitStudio,
  view: cycleView,
  palette: cyclePalette,
  skeleton(btn) {
    state.skeleton = !state.skeleton;
    btn?.setAttribute('aria-pressed', state.skeleton);
  },
  guide() { els.guide.classList.toggle('collapsed'); },
  fullscreen: toggleFullscreen,
  clear() {
    fx.clear();
    state.heartLive = null;
  },
  photo: takePhoto,
  record: toggleRecord,
  gallery() { els.drawer.classList.toggle('open'); },
};

document.addEventListener('click', (e) => {
  const modeBtn = e.target.closest('[data-mode]');
  if (modeBtn) {
    setMode(modeBtn.dataset.mode);
    return;
  }
  const btn = e.target.closest('[data-action]');
  if (btn && actions[btn.dataset.action]) {
    e.preventDefault();
    actions[btn.dataset.action](btn);
  }
});

document.addEventListener('keydown', (e) => {
  if (!state.running || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  const map = {
    1: () => setMode('galaxy'),
    2: () => setMode('constellation'),
    3: () => setMode('heart'),
    c: actions.clear,
    p: takePhoto,
    r: toggleRecord,
    v: cycleView,
    k: cyclePalette,
    h: () => actions.skeleton(document.querySelector('[data-action="skeleton"]')),
    g: actions.guide,
    f: toggleFullscreen,
    l: () => fx.lightConstellation(),
    w: () => fx.makeWish(),
    b: () => fx.spawnHeart(state.W / 2, state.H / 2, Math.min(state.W, state.H) * 0.22),
    escape: () => els.drawer.classList.remove('open'),
  };
  if (map[k]) {
    e.preventDefault();
    map[k]();
  }
});

// ---------- Pop-up sambutan ----------
const welcome = {
  el: $('#welcome'),
  step: 0,
  steps: document.querySelectorAll('.welcome-step'),
  dots: document.querySelectorAll('.welcome .dots i'),
  next: $('[data-welcome="next"]'),
  prev: $('[data-welcome="prev"]'),
};
const LAST_STEP = welcome.steps.length - 1;

function showWelcomeStep(i) {
  welcome.step = Math.max(0, Math.min(LAST_STEP, i));
  welcome.steps.forEach((s, k) => s.classList.toggle('active', k === welcome.step));
  welcome.dots.forEach((d, k) => d.classList.toggle('on', k === welcome.step));
  welcome.prev.hidden = welcome.step === 0;
  welcome.next.textContent = welcome.step === LAST_STEP ? 'Masuki Semesta ✦' : 'Lanjutkan';
}

function closeWelcome() {
  if (welcome.el.hidden) return;
  welcome.el.classList.add('closing');
  setTimeout(() => { welcome.el.hidden = true; }, 350);
}

welcome.el.addEventListener('click', (e) => {
  if (e.target === welcome.el) return closeWelcome();
  const act = e.target.closest('[data-welcome]')?.dataset.welcome;
  if (act === 'close') closeWelcome();
  if (act === 'prev') showWelcomeStep(welcome.step - 1);
  if (act === 'next') {
    if (welcome.step === LAST_STEP) closeWelcome();
    else showWelcomeStep(welcome.step + 1);
  }
});

document.addEventListener('keydown', (e) => {
  if (welcome.el.hidden) return;
  if (e.key === 'Escape') closeWelcome();
  if (e.key === 'ArrowRight') welcome.next.click();
  if (e.key === 'ArrowLeft' && welcome.step > 0) showWelcomeStep(welcome.step - 1);
});

showWelcomeStep(0);
welcome.next.focus();

setPalette(0);
renderGallery();
if (window.innerWidth < 760) els.guide.classList.add('collapsed');
