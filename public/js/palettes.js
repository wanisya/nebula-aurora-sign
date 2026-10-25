// Utilitas matematika, palet warna, dan sprite cahaya yang di-cache.

export const TAU = Math.PI * 2;
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function gauss() {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

export const PALETTES = [
  {
    id: 'aurora',
    name: 'Aurora Pink',
    colors: ['#ff7ad9', '#c77dff', '#8fa8ff', '#5ee7ff', '#ffffff', '#ffb3e6'],
    nebula: ['#ff4fb8', '#9d4edd', '#4361ee', '#4cc9f0', '#ff7ad9'],
  },
  {
    id: 'galaxy',
    name: 'Deep Galaxy',
    colors: ['#7b9cff', '#4cc9f0', '#a0c4ff', '#cdb4db', '#ffffff'],
    nebula: ['#3a0ca3', '#4361ee', '#4895ef', '#7209b7'],
  },
  {
    id: 'rose',
    name: 'Cosmic Rose',
    colors: ['#ffafcc', '#ffc8dd', '#ff8fab', '#ffd6a5', '#ffffff'],
    nebula: ['#ff006e', '#ff5d8f', '#ff8fab', '#c9184a'],
  },
  {
    id: 'emerald',
    name: 'Emerald Aurora',
    colors: ['#80ffdb', '#64dfdf', '#72efdd', '#b8f2e6', '#ffffff', '#c3a6ff'],
    nebula: ['#06d6a0', '#118ab2', '#7400b8', '#48bfe3'],
  },
];

export const HEART_COLORS = ['#ff7ad9', '#ff4fb8', '#ffb3e6', '#ff9ecf', '#c77dff', '#ffffff'];
export const HEART_NEBULA = ['#ff4fb8', '#ff2e93', '#c77dff', '#ff7ad9', '#7b5cff'];

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

const cache = new Map();

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

// Bintang: inti putih, halo berwarna.
export function starSprite(color) {
  const key = 's' + color;
  let c = cache.get(key);
  if (c) return c;
  c = makeCanvas(64);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.1, rgba(color, 1));
  grad.addColorStop(0.3, rgba(color, 0.35));
  grad.addColorStop(1, rgba(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  cache.set(key, c);
  return c;
}

// Nebula: awan lembut tanpa inti.
export function nebulaSprite(color) {
  const key = 'n' + color;
  let c = cache.get(key);
  if (c) return c;
  c = makeCanvas(128);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, rgba(color, 0.9));
  grad.addColorStop(0.35, rgba(color, 0.45));
  grad.addColorStop(0.7, rgba(color, 0.12));
  grad.addColorStop(1, rgba(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  cache.set(key, c);
  return c;
}

// Kilau silang untuk bintang rasi.
export function flareSprite() {
  let c = cache.get('flare');
  if (c) return c;
  c = makeCanvas(128);
  const g = c.getContext('2d');
  const h = g.createLinearGradient(0, 0, 128, 0);
  h.addColorStop(0, 'rgba(255,255,255,0)');
  h.addColorStop(0.5, 'rgba(255,255,255,1)');
  h.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = h;
  g.fillRect(0, 63, 128, 2);
  const v = g.createLinearGradient(0, 0, 0, 128);
  v.addColorStop(0, 'rgba(255,255,255,0)');
  v.addColorStop(0.5, 'rgba(255,255,255,1)');
  v.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = v;
  g.fillRect(63, 0, 2, 128);
  cache.set('flare', c);
  return c;
}
