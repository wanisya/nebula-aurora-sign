// Mesin partikel kosmik: debu bintang, galaksi spiral, black hole,
// nebula heart, rasi bintang, dan bintang jatuh. Semua digambar di Canvas 2D
// dengan blending "lighter" supaya cahayanya saling menumpuk dan berpendar.

import {
  TAU, rand, pick, gauss, clamp01, easeOut, PALETTES, HEART_COLORS, HEART_NEBULA,
  starSprite, nebulaSprite, flareSprite, rgba,
} from './palettes.js';

const MAX_PARTICLES = 7000;
const MAX_GALAXIES = 6;
const MAX_CONSTELLATIONS = 8;
const MAX_HEARTS = 14;
const CORE_COLORS = ['#ffffff', '#fff0fa', '#ffe6c7', '#ffd6f5'];

// Kurva hati klasik, dinormalisasi ke kira-kira [-1, 1] dan diposisikan di tengah.
function heartXY(t) {
  const x = 16 * Math.pow(Math.sin(t), 3);
  const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
  return [x / 17, y / 17 - 0.15];
}

// Tabel titik tepi hati dengan jarak merata (berdasarkan panjang busur),
// supaya partikel tidak menumpuk di lekukan atas & ujung bawah.
const HEART_EDGE = (() => {
  const raw = [];
  let len = 0, prev = heartXY(0);
  for (let i = 0; i <= 2000; i++) {
    const p = heartXY((i / 2000) * TAU);
    len += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    raw.push({ p, len });
    prev = p;
  }
  const out = [];
  let j = 0;
  for (let i = 0; i < 512; i++) {
    const target = (i / 512) * len;
    while (raw[j].len < target) j++;
    out.push(raw[j].p);
  }
  return out;
})();

const heartEdgePoint = () => HEART_EDGE[(Math.random() * HEART_EDGE.length) | 0];

export class FX {
  constructor() {
    this.palette = PALETTES[0];
    this.t = 0;
    this.W = 1;
    this.H = 1;
    this.particles = [];
    this.galaxies = [];
    this.hearts = [];
    this.constellations = [];
    this.shooting = [];
    this.rings = [];
    this.pending = [];
    this.ambient = [];
    this.blackHole = null;
    this.flash = 0;
    this.flashAt = { x: 0, y: 0 };
    this.fade = 1;
    this.clearing = false;
    this.nebAcc = 0;
    this.onEvent = () => {};
  }

  resize(W, H) {
    this.W = W;
    this.H = H;
    const n = Math.round((W * H) / 5500);
    this.ambient = Array.from({ length: n }, () => ({
      x: rand(0, W), y: rand(0, H), s: rand(0.25, 1.1), p: rand(0, TAU), sp: rand(0.4, 1.8),
      c: pick(['#cfd8ff', '#ffffff', '#ffd6f5', '#bfe9ff']),
    }));
  }

  setPalette(p) { this.palette = p; }
  color() { return pick(this.palette.colors); }
  nebColor() { return pick(this.palette.nebula); }

  star(x, y, o = {}) {
    const life = o.life ?? Infinity;
    return {
      kind: 'star', x, y, vx: o.vx || 0, vy: o.vy || 0, drag: o.drag ?? 0.92,
      life, age: 0, size: o.size ?? rand(0.6, 2), color: o.color || this.color(),
      a: o.a ?? rand(0.6, 1), tw: rand(0, TAU), ts: rand(1.5, 4),
    };
  }

  neb(x, y, o = {}) {
    return {
      kind: 'neb', x, y, vx: o.vx || 0, vy: o.vy || 0, drag: o.drag ?? 0.97,
      life: o.life ?? rand(3, 6), age: 0, size: o.size ?? rand(30, 70),
      color: o.color || this.nebColor(), a: o.a ?? rand(0.06, 0.13), tw: 0, ts: 0,
    };
  }

  sparkle(x, y, n, speed = 120, colors = null) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), sp = rand(0.2, 1) * speed;
      this.particles.push(this.star(x, y, {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.93,
        life: rand(0.5, 1.3), size: rand(0.4, 1.4), color: colors ? pick(colors) : this.color(),
      }));
    }
  }

  // ---------- Debu bintang dari ujung jari ----------
  drawTrail(x0, y0, x1, y1, { persist = true, heart = false } = {}) {
    let d = Math.hypot(x1 - x0, y1 - y0);
    if (d > 180) { x0 = x1; y0 = y1; d = 0; }
    if (d < 1.5 && d !== 0) return;
    const steps = Math.max(1, Math.ceil(d / 5));
    const colors = heart ? HEART_COLORS : null;
    for (let i = 1; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps;
      const y = y0 + ((y1 - y0) * i) / steps;
      for (let k = 0; k < 2; k++) {
        this.particles.push(this.star(x + gauss() * 4.5, y + gauss() * 4.5, {
          vx: gauss() * 6, vy: gauss() * 6, drag: 0.9,
          life: persist ? Infinity : rand(1.4, 2.8),
          size: Math.random() < 0.07 ? rand(2, 3.2) : rand(0.5, 1.7),
          color: colors ? pick(colors) : this.color(),
        }));
      }
      if (Math.random() < 0.3) {
        this.particles.push(this.star(x, y, {
          vx: gauss() * 40, vy: gauss() * 40, drag: 0.95, life: rand(0.6, 1.4),
          size: rand(0.4, 1.1), color: '#ffffff',
        }));
      }
      if (Math.random() < 0.08) {
        this.particles.push(this.neb(x + gauss() * 8, y + gauss() * 8, {
          vx: gauss() * 8, vy: gauss() * 8,
          life: persist && Math.random() < 0.5 ? Infinity : rand(3, 6),
          size: rand(28, 60), a: rand(0.05, 0.1),
          color: heart ? pick(HEART_NEBULA) : this.nebColor(),
        }));
      }
    }
  }

  // ---------- Awan nebula dari telapak tangan ----------
  emitNebula(x, y, dt, heart = false) {
    this.nebAcc += dt * 18;
    while (this.nebAcc >= 1) {
      this.nebAcc -= 1;
      this.particles.push(this.neb(x + gauss() * 14, y + gauss() * 14, {
        vx: gauss() * 30, vy: -rand(15, 55), drag: 0.985, life: rand(3, 5.5),
        size: rand(35, 85), a: rand(0.06, 0.12),
        color: heart ? pick(HEART_NEBULA) : this.nebColor(),
      }));
      for (let i = 0; i < 3; i++) {
        this.particles.push(this.star(x + gauss() * 20, y + gauss() * 20, {
          vx: gauss() * 40, vy: -rand(20, 90), drag: 0.97, life: rand(1, 2.4),
          size: rand(0.4, 1.4), color: heart ? pick(HEART_COLORS) : this.color(),
        }));
      }
    }
  }

  // ---------- Galaksi spiral ----------
  spawnGalaxy(x, y, R, big = false) {
    R = R || rand(110, 170);
    const arms = pick([2, 2, 3, 3, 4, 5]);
    const dir = Math.random() < 0.5 ? 1 : -1;
    const spin = rand(3.2, 5.2);
    const tilt = rand(0.45, 0.9);
    const phi = rand(0, TAU);
    const N = big ? 950 : 680;
    const stars = [];
    for (let i = 0; i < N; i++) {
      let r, a, size, color;
      if (Math.random() < 0.2) {
        r = Math.abs(gauss()) * R * 0.13;
        a = rand(0, TAU);
        size = rand(0.7, 2.2);
        color = pick(CORE_COLORS);
      } else {
        const arm = i % arms;
        const u = Math.pow(Math.random(), 0.8);
        r = R * (0.06 + 0.94 * u);
        a = (arm * TAU) / arms - dir * u * spin + gauss() * 0.3 * (1 - 0.4 * u);
        size = Math.random() < 0.05 ? rand(1.8, 2.8) : rand(0.35, 1.5);
        color = u < 0.3 ? pick([...CORE_COLORS, this.palette.colors[0]]) : this.color();
      }
      stars.push({ r, a, size, color, tw: rand(0, TAU), ts: rand(1, 3), al: rand(0.55, 1) });
    }
    const nebs = [{ r: 0, a: 0, size: R * 0.5, color: '#ffd6f5', al: 0.16 }];
    for (let i = 0; i < 30; i++) {
      const arm = i % arms;
      const u = rand(0.15, 0.95);
      nebs.push({
        r: R * u,
        a: (arm * TAU) / arms - dir * u * spin + gauss() * 0.2,
        size: rand(0.3, 0.55) * R * (1 - 0.3 * u),
        color: this.nebColor(),
        al: rand(0.05, 0.1),
      });
    }
    const g = {
      x, y, R, tilt, cp: Math.cos(phi), sp: Math.sin(phi), dir, speed: rand(0.22, 0.38),
      stars, nebs, born: this.t, fade: 1, dying: false,
    };
    this.galaxies.push(g);
    const alive = this.galaxies.filter((q) => !q.dying);
    if (alive.length > MAX_GALAXIES) alive[0].dying = true;
    this.rings.push({ x, y, born: this.t, life: 0.9, maxR: R * 1.4, color: this.palette.colors[1], w: 3 });
    this.sparkle(x, y, 40, 220);
    this.onEvent('galaxy');
    return g;
  }

  galaxyPos(g, s) {
    const age = this.t - g.born;
    const sc = easeOut(clamp01(age / 1.6));
    const ang = s.a + g.dir * g.speed * age * (1.25 - 0.35 * (s.r / g.R));
    const lx = Math.cos(ang) * s.r * sc;
    const ly = Math.sin(ang) * s.r * sc * g.tilt;
    return { x: g.x + lx * g.cp - ly * g.sp, y: g.y + lx * g.sp + ly * g.cp };
  }

  // ---------- Black hole & Big Bang ----------
  holdBlackHole(x, y) {
    if (!this.blackHole) {
      this.blackHole = { x, y, born: this.t, held: this.t, mass: 0, strength: 0, r: 12 };
      // Black hole merobek galaksi & hati menjadi partikel bebas yang bisa ditarik.
      for (const g of this.galaxies) {
        for (const s of g.stars) {
          const p = this.galaxyPos(g, s);
          const k = g.speed * g.dir * 1.2;
          this.particles.push(this.star(p.x, p.y, {
            vx: -(p.y - g.y) * k, vy: (p.x - g.x) * k, drag: 0.97,
            size: s.size, color: s.color, a: s.al,
          }));
        }
        for (const n of g.nebs) {
          const p = this.galaxyPos(g, n);
          this.particles.push(this.neb(p.x, p.y, { size: n.size, color: n.color, a: n.al, life: rand(2, 4) }));
        }
      }
      this.galaxies.length = 0;
      this.shatterHearts(40);
      this.onEvent('blackhole');
    }
    const B = this.blackHole;
    B.x += (x - B.x) * 0.3;
    B.y += (y - B.y) * 0.3;
    B.held = this.t;
  }

  bigBang() {
    const B = this.blackHole;
    if (!B) return;
    this.blackHole = null;
    const n = Math.min(2600, 250 + B.mass * 1.1);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const sp = Math.sqrt(Math.random()) * rand(120, 640);
      this.particles.push(this.star(B.x, B.y, {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.962, life: rand(1.8, 4.5),
        size: Math.random() < 0.1 ? rand(1.8, 3) : rand(0.4, 1.6),
      }));
    }
    for (let i = 0; i < 36; i++) {
      const a = rand(0, TAU), sp = rand(40, 220);
      this.particles.push(this.neb(B.x, B.y, {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.96, life: rand(3, 6),
        size: rand(50, 120), a: rand(0.07, 0.14),
      }));
    }
    const maxR = Math.max(this.W, this.H) * 0.6;
    this.rings.push({ x: B.x, y: B.y, born: this.t, life: 1.2, maxR, color: this.palette.colors[0], w: 6 });
    this.rings.push({ x: B.x, y: B.y, born: this.t + 0.12, life: 1.4, maxR: maxR * 0.7, color: this.palette.colors[2], w: 3 });
    this.flash = 1;
    this.flashAt = { x: B.x, y: B.y };
    if (B.mass > 30) {
      this.pending.push({ at: this.t + 0.5, fn: () => this.spawnGalaxy(B.x, B.y, rand(130, 190), true) });
    }
    this.onEvent('bigbang', { mass: B.mass });
  }

  // ---------- Nebula Heart ----------
  spawnHeart(x, y, size, { live = false, small = false } = {}) {
    const N = small ? 150 : 1000;
    const pts = [];
    for (let i = 0; i < N; i++) {
      const edge = Math.random() < 0.5;
      const k = edge ? rand(0.94, 1.03) : Math.sqrt(Math.random()) * 0.96;
      const [hx, hy] = heartEdgePoint();
      const sa = rand(0, TAU), sr = rand(1.5, 3.2);
      pts.push({
        lx: hx * k + gauss() * 0.015, ly: hy * k + gauss() * 0.015,
        sx: Math.cos(sa) * sr, sy: Math.sin(sa) * sr,
        size: edge ? rand(0.7, 2.1) : rand(0.4, 1.4), color: pick(HEART_COLORS),
        tw: rand(0, TAU), ts: rand(1.5, 4), al: edge ? rand(0.7, 1) : rand(0.4, 0.85),
        dl: rand(0, 0.35), ex: gauss(), ey: gauss(),
      });
    }
    const nebs = [];
    for (let i = 0, n = small ? 5 : 30; i < n; i++) {
      const [hx, hy] = heartEdgePoint();
      const k = Math.sqrt(Math.random()) * 0.8;
      nebs.push({ lx: hx * k, ly: hy * k, size: rand(0.35, 0.6), color: pick(HEART_NEBULA), al: rand(0.06, 0.12) });
    }
    const h = { x, y, size, live, small, pts, nebs, born: this.t, life: small ? 4.5 : 10, vy: small ? -28 : 0 };
    this.hearts.push(h);
    if (this.hearts.length > MAX_HEARTS) this.hearts.shift();
    if (!small) {
      this.rings.push({ x, y, born: this.t, life: 1.1, maxR: size * 2.2, color: '#ff7ad9', w: 4 });
      this.onEvent('heart');
    } else {
      this.sparkle(x, y, 14, 90, HEART_COLORS);
    }
    return h;
  }

  moveHeart(h, x, y, size) {
    h.x += (x - h.x) * 0.35;
    h.y += (y - h.y) * 0.35;
    h.size += (size - h.size) * 0.2;
  }

  heartParticlePos(h, p, age, S, out) {
    const ap = easeOut(clamp01((age - p.dl) / (h.small ? 0.5 : 1.1)));
    const cy = h.y + h.vy * age;
    let x = h.x + p.lx * S + p.sx * h.size * (1 - ap);
    let y = cy + p.ly * S + p.sy * h.size * (1 - ap);
    x += p.ex * out * h.size * 1.2;
    y += p.ey * out * h.size * 1.2 - out * h.size * 0.6;
    return { x, y, ap };
  }

  // Pecahkan semua hati menjadi kelopak cahaya.
  shatterHearts(speed = 260) {
    if (!this.hearts.length) return false;
    for (const h of this.hearts) {
      const age = this.t - h.born;
      for (const p of h.pts) {
        const pos = this.heartParticlePos(h, p, age, h.size, 0);
        const a = Math.atan2(p.ly, p.lx) + gauss() * 0.4;
        const sp = rand(0.3, 1) * speed;
        this.particles.push(this.star(pos.x, pos.y, {
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, drag: 0.965,
          life: rand(1.5, 3.5), size: p.size, color: p.color,
        }));
      }
      if (speed > 100) {
        this.rings.push({ x: h.x, y: h.y, born: this.t, life: 0.8, maxR: h.size * 2, color: '#ff4fb8', w: 3 });
      }
    }
    this.hearts.length = 0;
    return true;
  }

  // ---------- Rasi bintang ----------
  get openConstellation() {
    const c = this.constellations[this.constellations.length - 1];
    return c && !c.lit ? c : null;
  }

  lastStar() {
    const c = this.openConstellation;
    return c ? c.stars[c.stars.length - 1] : null;
  }

  placeStar(x, y) {
    let c = this.openConstellation;
    if (!c) {
      c = { stars: [], lit: false, litAt: 0, wished: false };
      this.constellations.push(c);
      if (this.constellations.length > MAX_CONSTELLATIONS) this.constellations.shift();
    }
    c.stars.push({ x, y, born: this.t, size: rand(0.9, 1.25), tw: rand(0, TAU), color: this.color() });
    this.sparkle(x, y, 16, 110);
    this.rings.push({ x, y, born: this.t, life: 0.6, maxR: 34, color: '#ffffff', w: 1.5 });
    this.onEvent('star', { count: c.stars.length });
  }

  lightConstellation() {
    const c = this.openConstellation;
    if (!c || !c.stars.length) return false;
    c.lit = true;
    c.litAt = this.t;
    c.stars.forEach((s, i) => {
      this.pending.push({ at: this.t + i * 0.16, fn: () => this.sparkle(s.x, s.y, 20, 160) });
    });
    this.onEvent('lit', { count: c.stars.length });
    return true;
  }

  makeWish() {
    const c = this.constellations[this.constellations.length - 1];
    if (!c || !c.lit || c.wished || this.t - c.litAt < 0.5) return false;
    c.wished = true;
    for (let i = 0; i < 8; i++) this.pending.push({ at: this.t + i * 0.22, fn: () => this.shootingStar() });
    for (const s of c.stars) {
      for (let i = 0; i < 10; i++) {
        this.particles.push(this.star(s.x, s.y, {
          vx: gauss() * 30, vy: -rand(40, 140), drag: 0.97, life: rand(1.2, 2.6), size: rand(0.5, 1.6),
        }));
      }
    }
    this.onEvent('wish');
    return true;
  }

  shootingStar() {
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft ? rand(-50, this.W * 0.5) : rand(this.W * 0.5, this.W + 50);
    const y = rand(-40, this.H * 0.35);
    const ang = fromLeft ? rand(0.35, 0.7) : Math.PI - rand(0.35, 0.7);
    const sp = rand(700, 1100);
    const life = rand(0.9, 1.5);
    this.shooting.push({
      x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life, max: life,
      len: rand(120, 220), color: this.color(),
    });
  }

  // ---------- Umum ----------
  clear() {
    if (this.clearing) return;
    this.clearing = true;
  }

  reset() {
    this.particles.length = 0;
    this.galaxies.length = 0;
    this.hearts.length = 0;
    this.constellations.length = 0;
    this.shooting.length = 0;
    this.rings.length = 0;
    this.pending.length = 0;
    this.blackHole = null;
    this.flash = 0;
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    const f60 = dt * 60;

    if (this.pending.length) {
      const due = this.pending.filter((p) => p.at <= t);
      if (due.length) {
        this.pending = this.pending.filter((p) => p.at > t);
        due.forEach((p) => p.fn());
      }
    }

    if (this.blackHole) {
      const B = this.blackHole;
      B.strength = clamp01((t - B.born) / 0.8);
      if (t - B.held > 0.2) this.bigBang();
    }
    const B = this.blackHole;
    const bhDrag = Math.pow(0.985, f60);

    const ps = this.particles;
    let j = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.life -= dt;
      p.age += dt;
      if (p.life <= 0) continue;
      if (B) {
        const dx = B.x - p.x, dy = B.y - p.y;
        const d = Math.hypot(dx, dy) + 0.001;
        if (d < B.r * 0.8) { B.mass++; continue; }
        const acc = (52000 * B.strength) / (d + 60);
        p.vx += ((dx / d) * acc - (dy / d) * acc * 0.55) * dt;
        p.vy += ((dy / d) * acc + (dx / d) * acc * 0.55) * dt;
        p.vx *= bhDrag;
        p.vy *= bhDrag;
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > 900) { p.vx *= 900 / sp; p.vy *= 900 / sp; }
      } else {
        const dr = Math.pow(p.drag, f60);
        p.vx *= dr;
        p.vy *= dr;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ps[j++] = p;
    }
    ps.length = j;
    if (ps.length > MAX_PARTICLES) ps.splice(0, ps.length - MAX_PARTICLES);
    if (B) B.r = 12 + Math.min(46, Math.sqrt(B.mass) * 0.9);

    for (const g of this.galaxies) if (g.dying) g.fade -= dt * 0.8;
    this.galaxies = this.galaxies.filter((g) => g.fade > 0);
    this.hearts = this.hearts.filter((h) => h.live || t - h.born < h.life);

    for (const s of this.shooting) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
    }
    this.shooting = this.shooting.filter((s) => s.life > 0);
    this.rings = this.rings.filter((r) => t - r.born < r.life);
    this.flash *= Math.pow(0.9, f60);

    if (this.clearing) {
      this.fade -= dt * 2.4;
      if (this.fade <= 0) {
        this.reset();
        this.fade = 1;
        this.clearing = false;
      }
    }
  }

  // ---------- Render ----------
  renderAmbient(ctx, k) {
    if (k <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.ambient) {
      const a = k * (0.35 + 0.35 * Math.sin(this.t * s.sp + s.p));
      if (a <= 0.02) continue;
      ctx.globalAlpha = a;
      const R = s.s * 4;
      ctx.drawImage(starSprite(s.c), s.x - R, s.y - R, R * 2, R * 2);
    }
    ctx.restore();
  }

  render(ctx) {
    const t = this.t, F = this.fade;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Awan nebula dulu agar bintang berada di atasnya.
    for (const p of this.particles) {
      if (p.kind !== 'neb') continue;
      const lifeA = p.life === Infinity ? 1 : Math.min(1, p.life / 1.2);
      const a = p.a * lifeA * Math.min(1, p.age / 0.5) * F;
      if (a <= 0.003) continue;
      ctx.globalAlpha = a;
      ctx.drawImage(nebulaSprite(p.color), p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
    }

    for (const g of this.galaxies) this.renderGalaxy(ctx, g);
    for (const h of this.hearts) this.renderHeart(ctx, h);

    for (const p of this.particles) {
      if (p.kind !== 'star') continue;
      const lifeA = p.life === Infinity ? 1 : Math.min(1, p.life / 0.6);
      const tw = 0.7 + 0.3 * Math.sin(t * p.ts + p.tw);
      const a = p.a * lifeA * tw * F;
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      const R = p.size * 4;
      ctx.drawImage(starSprite(p.color), p.x - R, p.y - R, R * 2, R * 2);
    }

    for (const c of this.constellations) this.renderConstellation(ctx, c);
    this.renderShooting(ctx);
    this.renderRings(ctx);
    this.renderBlackHole(ctx);

    if (this.flash > 0.01) {
      const { x, y } = this.flashAt;
      const R = Math.max(this.W, this.H);
      const g = ctx.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, `rgba(255,230,250,${0.55 * this.flash})`);
      g.addColorStop(0.4, `rgba(200,140,255,${0.18 * this.flash})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.W, this.H);
    }
    ctx.restore();
  }

  renderGalaxy(ctx, g) {
    const t = this.t;
    const appear = clamp01((t - g.born) / 0.8);
    const k = appear * g.fade * this.fade;
    if (k <= 0) return;
    for (const n of g.nebs) {
      const p = this.galaxyPos(g, n);
      ctx.globalAlpha = n.al * k;
      ctx.drawImage(nebulaSprite(n.color), p.x - n.size, p.y - n.size, n.size * 2, n.size * 2);
    }
    for (const s of g.stars) {
      const p = this.galaxyPos(g, s);
      const tw = 0.7 + 0.3 * Math.sin(t * s.ts + s.tw);
      ctx.globalAlpha = s.al * tw * k;
      const R = s.size * 4;
      ctx.drawImage(starSprite(s.color), p.x - R, p.y - R, R * 2, R * 2);
    }
  }

  renderHeart(ctx, h) {
    const t = this.t;
    const age = t - h.born;
    if (h.live) h.life = Math.max(h.life, age + 2.5);
    const out = clamp01(1 - (h.life - age) / 1.6);
    const ph = (age * 1.15) % 1;
    const beat = Math.exp(-Math.pow((ph - 0.1) / 0.06, 2)) * 0.09 + Math.exp(-Math.pow((ph - 0.3) / 0.07, 2)) * 0.05;
    const S = h.size * (1 + beat);
    const F = (1 - out) * this.fade;
    const cy = h.y + h.vy * age;

    const na = easeOut(clamp01((age - 0.2) / 1.2));
    for (const n of h.nebs) {
      const sz = n.size * S * 1.6;
      ctx.globalAlpha = n.al * na * F * (1 + beat * 4);
      ctx.drawImage(nebulaSprite(n.color), h.x + n.lx * S - sz, cy + n.ly * S - sz, sz * 2, sz * 2);
    }
    for (const p of h.pts) {
      const pos = this.heartParticlePos(h, p, age, S, out);
      const tw = 0.75 + 0.25 * Math.sin(t * p.ts + p.tw);
      const a = p.al * tw * Math.min(1, pos.ap * 1.5) * F;
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      const R = p.size * 4 * (1 + beat);
      ctx.drawImage(starSprite(p.color), pos.x - R, pos.y - R, R * 2, R * 2);
    }
  }

  renderConstellation(ctx, c) {
    const t = this.t, F = this.fade, S = c.stars;
    ctx.lineCap = 'round';
    for (let i = 1; i < S.length; i++) {
      const a = S[i - 1], b = S[i];
      ctx.beginPath();
      if (!c.lit) {
        ctx.globalAlpha = 0.25 * F;
        ctx.setLineDash([3, 7]);
        ctx.strokeStyle = '#e9dcff';
        ctx.lineWidth = 1;
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }
      const p = easeOut(clamp01((t - c.litAt - i * 0.16) / 0.4));
      if (p <= 0) continue;
      const ex = a.x + (b.x - a.x) * p, ey = a.y + (b.y - a.y) * p;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(ex, ey);
      ctx.globalAlpha = 0.2 * F;
      ctx.strokeStyle = this.palette.colors[0];
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.globalAlpha = 0.85 * F;
      ctx.strokeStyle = '#fff2fb';
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }

    const flare = flareSprite();
    S.forEach((s, i) => {
      const appear = easeOut(clamp01((t - s.born) / 0.4));
      const lit = c.lit ? easeOut(clamp01((t - c.litAt - i * 0.16) / 0.5)) : 0;
      const tw = 0.8 + 0.2 * Math.sin(t * 3 + s.tw);
      const pulse = c.wished ? 1 + 0.15 * Math.sin(t * 4 + s.tw) : 1;
      const r = (4 + lit * 5) * s.size * appear * pulse;
      ctx.globalAlpha = (0.6 + lit * 0.4) * tw * F;
      const R = r * 4;
      ctx.drawImage(starSprite(s.color), s.x - R, s.y - R, R * 2, R * 2);
      const L = r * (3 + lit * 3);
      ctx.globalAlpha = (0.35 + 0.55 * lit) * tw * F;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(t * 0.25 + s.tw);
      ctx.drawImage(flare, -L, -L, L * 2, L * 2);
      ctx.restore();
    });
  }

  renderShooting(ctx) {
    ctx.lineCap = 'round';
    for (const s of this.shooting) {
      const k = clamp01(s.life / s.max) * this.fade;
      const sp = Math.hypot(s.vx, s.vy);
      const tx = s.x - (s.vx / sp) * s.len, ty = s.y - (s.vy / sp) * s.len;
      const g = ctx.createLinearGradient(s.x, s.y, tx, ty);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.3, rgba(s.color, 0.5));
      g.addColorStop(1, rgba(s.color, 0));
      ctx.globalAlpha = k;
      ctx.strokeStyle = g;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.drawImage(starSprite('#ffffff'), s.x - 10, s.y - 10, 20, 20);
    }
  }

  renderRings(ctx) {
    for (const r of this.rings) {
      const p = (this.t - r.born) / r.life;
      if (p < 0) continue;
      const e = easeOut(p);
      ctx.globalAlpha = (1 - p) * 0.8 * this.fade;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = Math.max(0.5, r.w * (1 - p));
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.maxR * e, 0, TAU);
      ctx.stroke();
    }
  }

  renderBlackHole(ctx) {
    const B = this.blackHole;
    if (!B) return;
    const t = this.t;
    const r = B.r * (0.4 + 0.6 * B.strength);
    const disk = (front) => {
      const n = 80;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + t * 2.2;
        if ((Math.sin(a) > 0) !== front) continue;
        const rr = r * (1.5 + (0.9 * ((i * 37) % n)) / n);
        const x = B.x + Math.cos(a) * rr;
        const y = B.y + Math.sin(a) * rr * 0.38;
        const bright = 0.5 + 0.5 * Math.cos(a);
        ctx.globalAlpha = (0.25 + 0.6 * bright) * B.strength;
        const R = rr * 0.22;
        ctx.drawImage(starSprite(i % 3 ? this.palette.colors[0] : '#ffd1f0'), x - R, y - R, R * 2, R * 2);
      }
    };

    ctx.globalCompositeOperation = 'lighter';
    const halo = r * 5;
    ctx.globalAlpha = 0.3 * B.strength;
    ctx.drawImage(nebulaSprite(this.palette.nebula[1] || this.palette.nebula[0]), B.x - halo, B.y - halo, halo * 2, halo * 2);
    disk(false);

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    const g = ctx.createRadialGradient(B.x, B.y, 0, B.x, B.y, r * 1.25);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.75, 'rgba(0,0,0,0.96)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(B.x, B.y, r * 1.25, 0, TAU);
    ctx.fill();

    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.85 * B.strength;
    ctx.strokeStyle = '#ffd6f5';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(B.x, B.y, r, 0, TAU);
    ctx.stroke();
    disk(true);
  }
}
