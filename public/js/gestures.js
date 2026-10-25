// Mengubah 21 titik landmark menjadi gestur: point, pinch, fist, open, peace,
// plus deteksi "hati dua tangan".

import { dist } from './palettes.js';

const TIP = [4, 8, 12, 16, 20];
const PIP = [3, 6, 10, 14, 18];
const STABLE_FRAMES = 3;

export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

export const GESTURE_LABEL = {
  point: '☝️ Tunjuk',
  pinch: '🤏 Cubit',
  fist: '✊ Kepal',
  open: '🖐️ Buka',
  peace: '✌️ Peace',
  other: '🤚 Tangan',
  none: '…',
};

const lerp = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

function classify(pts, size, st) {
  const wrist = pts[0];
  const ext = [1, 2, 3, 4].map((f) => dist(pts[TIP[f]], wrist) > dist(pts[PIP[f]], wrist) * 1.12);
  const n = ext.filter(Boolean).length;
  const pinchD = dist(pts[4], pts[8]) / size;
  const indexReach = dist(pts[8], wrist) / size;

  // Histeresis: lebih mudah "tetap mencubit" daripada "mulai mencubit".
  st.pinched = st.pinched ? pinchD < 0.42 : pinchD < 0.26 && indexReach > 1.0;

  if (st.pinched) return 'pinch';
  if (n === 0) return 'fist';
  if (ext[0] && n === 1) return 'point';
  if (ext[0] && ext[1] && n === 2) return 'peace';
  if (n === 4) return 'open';
  return 'other';
}

// result: hasil MediaPipe. toScreen: konversi landmark ternormalisasi -> piksel layar.
// store: Map untuk menyimpan state tiap tangan antarframe.
export function analyzeHands(result, toScreen, store) {
  const hands = [];
  const seen = new Set();
  const lms = result?.landmarks || [];
  const hd = result?.handedness || result?.handednesses || [];

  lms.forEach((lm, i) => {
    let key = hd[i]?.[0]?.categoryName || 'Hand';
    if (seen.has(key)) key += i;
    seen.add(key);

    const pts = lm.map(toScreen);
    const size = dist(pts[0], pts[9]) || 1;
    let st = store.get(key);
    if (!st) {
      st = { raw: 'none', count: 0, stable: 'none', pinched: false, tip: null, pinchPt: null, palm: null };
      store.set(key, st);
    }

    const raw = classify(pts, size, st);
    if (raw === st.raw) st.count++;
    else { st.raw = raw; st.count = 1; }
    const before = st.stable;
    if (st.count >= STABLE_FRAMES) st.stable = raw;

    const palmRaw = [0, 5, 9, 13, 17].reduce((a, k) => ({ x: a.x + pts[k].x / 5, y: a.y + pts[k].y / 5 }), { x: 0, y: 0 });
    const pinchRaw = lerp(pts[4], pts[8], 0.5);
    st.prevTip = st.tip;
    st.tip = st.tip ? lerp(st.tip, pts[8], 0.55) : { ...pts[8] };
    st.pinchPt = st.pinchPt ? lerp(st.pinchPt, pinchRaw, 0.5) : pinchRaw;
    st.palm = st.palm ? lerp(st.palm, palmRaw, 0.5) : palmRaw;

    hands.push({
      key, pts, size, st,
      gesture: st.stable,
      entered: st.stable !== before,
      tip: st.tip,
      pinchPt: st.pinchPt,
      palm: st.palm,
    });
  });

  for (const key of [...store.keys()]) if (!seen.has(key)) store.delete(key);
  return hands;
}

// Dua tangan membentuk hati: kedua ujung telunjuk bersentuhan di atas,
// kedua ujung jempol bersentuhan di bawah.
export function detectHeartPair(hands) {
  if (hands.length !== 2) return null;
  const [a, b] = hands;
  const s = (a.size + b.size) / 2;
  const iA = a.pts[8], iB = b.pts[8], tA = a.pts[4], tB = b.pts[4];
  if (dist(iA, iB) > s * 0.6) return null;
  if (dist(tA, tB) > s * 0.6) return null;
  const topY = (iA.y + iB.y) / 2;
  const botY = (tA.y + tB.y) / 2;
  if (botY - topY < s * 0.35) return null;
  return {
    x: (iA.x + iB.x + tA.x + tB.x) / 4,
    y: (topY + botY) / 2,
    size: Math.max(60, (botY - topY) * 0.95 + s * 0.4),
  };
}
