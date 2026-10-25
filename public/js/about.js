// Halaman kenalan: langit berbintang yang berkelip + animasi muncul saat di-scroll.

import { TAU, rand, pick, starSprite } from './palettes.js';

const canvas = document.getElementById('sky-canvas');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, dpr = 1, stars = [];

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  stars = Array.from({ length: Math.round((W * H) / 3200) }, () => ({
    x: rand(0, W), y: rand(0, H), s: rand(0.2, 1.2), p: rand(0, TAU), sp: rand(0.3, 1.4),
    c: pick(['#ffffff', '#cfd8ff', '#ffd6f5', '#bfe9ff']),
  }));
}

function frame(now) {
  const t = now / 1000;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  for (const s of stars) {
    ctx.globalAlpha = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * s.sp + s.p));
    const R = s.s * 4;
    ctx.drawImage(starSprite(s.c), s.x - R, s.y - R, R * 2, R * 2);
  }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize);
resize();
requestAnimationFrame(frame);

const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) {
      e.target.classList.add('shown');
      io.unobserve(e.target);
    }
  }
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
