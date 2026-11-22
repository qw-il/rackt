import { colorDistance } from "./color";

export type Raster = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export type Rgb = { r: number; g: number; b: number };

/** Sensitivity 0 keeps only a near-exact backdrop. 100 reaches into shadows and similar tones. */
export function thresholdFor(sensitivity: number): number {
  const t = Math.max(0, Math.min(100, sensitivity));
  return 18 + (t / 100) * 92;
}

export function dominantBorderColor(raster: Raster): Rgb {
  const { data, width: w, height: h } = raster;
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
  const step = Math.max(1, Math.floor(Math.max(w, h) / 120));
  const sample = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bin.n += 1;
    bin.r += r;
    bin.g += g;
    bin.b += b;
    bins.set(key, bin);
  };
  for (let x = 0; x < w; x += step) {
    sample(x, 0);
    if (h > 1) sample(x, h - 1);
  }
  for (let y = 0; y < h; y += step) {
    sample(0, y);
    if (w > 1) sample(w - 1, y);
  }
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const bin of bins.values()) {
    if (!best || bin.n > best.n) best = bin;
  }
  if (!best || best.n === 0) return { r: 255, g: 255, b: 255 };
  return { r: best.r / best.n, g: best.g / best.n, b: best.b / best.n };
}

export function removeBackground(raster: Raster, sensitivity = 42): Raster {
  const { width: w, height: h, data } = raster;
  const out = new Uint8ClampedArray(data);
  const bg = dominantBorderColor(raster);
  const threshold = thresholdFor(sensitivity);
  const n = w * h;
  const isBg = new Uint8Array(n);
  const seen = new Uint8Array(n);
  const queue = new Int32Array(n);
  let tail = 0;

  const matches = (p: number) => {
    const i = p * 4;
    return colorDistance(data[i], data[i + 1], data[i + 2], bg.r, bg.g, bg.b) <= threshold;
  };

  const seed = (p: number) => {
    if (p < 0 || p >= n || seen[p]) return;
    seen[p] = 1;
    if (!matches(p)) return;
    isBg[p] = 1;
    queue[tail++] = p;
  };

  for (let x = 0; x < w; x++) {
    seed(x);
    if (h > 1) seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    if (w > 1) seed(y * w + (w - 1));
  }

  let head = 0;
  while (head < tail) {
    const p = queue[head++];
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) seed(p - 1);
    if (x < w - 1) seed(p + 1);
    if (y > 0) seed(p - w);
    if (y < h - 1) seed(p + w);
  }

  for (let p = 0; p < n; p++) {
    const i = p * 4;
    if (isBg[p]) {
      out[i + 3] = 0;
      continue;
    }
    const x = p % w;
    const y = (p - x) / w;
    const near =
      (x > 0 && isBg[p - 1]) ||
      (x < w - 1 && isBg[p + 1]) ||
      (y > 0 && isBg[p - w]) ||
      (y < h - 1 && isBg[p + w]);
    if (!near) continue;
    const dist = colorDistance(data[i], data[i + 1], data[i + 2], bg.r, bg.g, bg.b);
    const soft = threshold * 1.55;
    if (dist >= soft) continue;
    const start = threshold * 0.72;
    const t = (dist - start) / (soft - start);
    out[i + 3] = Math.max(0, Math.min(out[i + 3], Math.round(Math.max(0, Math.min(1, t)) * 255)));
  }

  removeSpecks(out, w, h);
  return { width: w, height: h, data: out };
}

function removeSpecks(out: Uint8ClampedArray, w: number, h: number) {
  const n = w * h;
  const seen = new Uint8Array(n);
  const queue = new Int32Array(n);
  let largest = 0;
  const components: Int32Array[] = [];

  for (let start = 0; start < n; start++) {
    if (seen[start] || out[start * 4 + 3] < 24) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    seen[start] = 1;
    while (head < tail) {
      const p = queue[head++];
      const x = p % w;
      const y = (p - x) / w;
      const next = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const np of next) {
        if (np < 0 || seen[np] || out[np * 4 + 3] < 24) continue;
        seen[np] = 1;
        queue[tail++] = np;
      }
    }
    const comp = queue.slice(0, tail);
    if (comp.length > largest) largest = comp.length;
    components.push(comp);
  }

  const minKeep = Math.max(32, largest * 0.08);
  for (const comp of components) {
    if (comp.length >= minKeep) continue;
    for (const p of comp) out[p * 4 + 3] = 0;
  }
}

export function alphaMask(raster: Raster): Uint8Array {
  const n = raster.width * raster.height;
  const alpha = new Uint8Array(n);
  for (let p = 0; p < n; p++) alpha[p] = raster.data[p * 4 + 3];
  return alpha;
}
