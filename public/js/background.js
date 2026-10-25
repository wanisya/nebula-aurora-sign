// Animasi halaman depan: langit berbintang + kartu demo yang "melukis sendiri".

import { FX } from './effects.js';
import { TAU, rand, pick, starSprite } from './palettes.js';

function fitCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(r.width * dpr));
  canvas.height = Math.max(1, Math.round(r.height * dpr));
  return { W: r.width, H: r.height, dpr };
}

export function createIntro(skyCanvas, demoCanvas) {
  const sky = skyCanvas.getContext('2d');
  const demo = demoCanvas.getContext('2d');
  const fx = new FX();
  let skySize, demoSize, stars = [], meteors = [];
  let raf = 0, last = 0, running = false, galaxy = null, nextHeart = 2, finger = null;

  function resize() {
    skySize = fitCanvas(skyCanvas);
    demoSize = fitCanvas(demoCanvas);
    const { W, H } = skySize;
    stars = Array.from({ length: Math.round((W * H) / 3200) }, () => ({
      x: rand(0, W), y: rand(0, H), s: rand(0.2, 1.2), p: rand(0, TAU), sp: rand(0.3, 1.6),
      c: pick(['#ffffff', '#cfd8ff', '#ffd6f5', '#bfe9ff']),
    }));
    fx.resize(demoSize.W, demoSize.H);
    const m = Math.min(demoSize.W, demoSize.H);
    if (galaxy) fx.galaxies = fx.galaxies.filter((g) => g !== galaxy);
    galaxy = fx.spawnGalaxy(demoSize.W / 2, demoSize.H / 2, m * 0.3, true);
    fx.particles.length = 0;
    fx.rings.length = 0;
  }

  function drawSky(t, dt) {
    const { W, H, dpr } = skySize;
    sky.setTransform(dpr, 0, 0, dpr, 0, 0);
    sky.clearRect(0, 0, W, H);
    sky.globalCompositeOperation = 'lighter';
    for (const s of stars) {
      sky.globalAlpha = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * s.sp + s.p));
      const R = s.s * 4;
      sky.drawImage(starSprite(s.c), s.x - R, s.y - R, R * 2, R * 2);
    }
    if (Math.random() < dt * 0.35) {
      meteors.push({ x: rand(W * 0.2, W), y: rand(-20, H * 0.3), life: 1, len: rand(80, 160) });
    }
    sky.lineCap = 'round';
    for (const m of meteors) {
      m.x -= 520 * dt; m.y += 260 * dt; m.life -= dt * 1.1;
      const g = sky.createLinearGradient(m.x, m.y, m.x + m.len, m.y - m.len / 2);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(1, 'rgba(255,122,217,0)');
      sky.globalAlpha = Math.max(0, m.life);
      sky.strokeStyle = g;
      sky.lineWidth = 1.6;
      sky.beginPath();
      sky.moveTo(m.x, m.y);
      sky.lineTo(m.x + m.len, m.y - m.len / 2);
      sky.stroke();
    }
    meteors = meteors.filter((m) => m.life > 0);
  }

  function drawDemo(t, dt) {
    const { W, H, dpr } = demoSize;
    // Jari bayangan menggambar simbol tak hingga.
    const p = {
      x: W / 2 + Math.cos(t * 0.9) * W * 0.36,
      y: H / 2 + Math.sin(t * 1.8) * H * 0.2,
    };
    if (finger) fx.drawTrail(finger.x, finger.y, p.x, p.y, { persist: false, heart: Math.sin(t * 0.3) > 0 });
    finger = p;
    if (t > nextHeart) {
      nextHeart = t + 4.5;
      fx.spawnHeart(rand(W * 0.25, W * 0.75), rand(H * 0.3, H * 0.7), Math.min(W, H) * 0.09, { small: true });
    }
    fx.update(dt);
    demo.setTransform(dpr, 0, 0, dpr, 0, 0);
    demo.globalCompositeOperation = 'source-over';
    demo.globalAlpha = 1;
    demo.clearRect(0, 0, W, H);
    fx.renderAmbient(demo, 0.8);
    fx.render(demo);
    demo.globalCompositeOperation = 'lighter';
    demo.globalAlpha = 0.9;
    demo.drawImage(starSprite('#ffffff'), p.x - 14, p.y - 14, 28, 28);
  }

  function frame(now) {
    if (!running) return;
    const t = now / 1000;
    const dt = Math.min(0.05, last ? t - last : 0.016);
    last = t;
    drawSky(t, dt);
    drawDemo(t, dt);
    raf = requestAnimationFrame(frame);
  }

  window.addEventListener('resize', () => running && resize());

  return {
    start() {
      if (running) return;
      running = true;
      last = 0;
      finger = null;
      resize();
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
}
