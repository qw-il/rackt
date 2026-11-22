export type Hsl = { h: number; s: number; l: number };

export type PaletteRaster = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

const NAMED: { name: string; hex: string }[] = [
  { name: "White", hex: "#f6f6f4" },
  { name: "Ivory", hex: "#f3ecdf" },
  { name: "Cream", hex: "#efe2cc" },
  { name: "Stone", hex: "#d9d2c5" },
  { name: "Silver", hex: "#c8c8c8" },
  { name: "Gray", hex: "#8a8680" },
  { name: "Charcoal", hex: "#3c3a37" },
  { name: "Black", hex: "#1a1a1a" },
  { name: "Ink", hex: "#161a22" },
  { name: "Navy", hex: "#1c2744" },
  { name: "Indigo", hex: "#2c3e66" },
  { name: "Denim", hex: "#3e5278" },
  { name: "Cobalt", hex: "#1f4e89" },
  { name: "Sky", hex: "#8eb4d4" },
  { name: "Teal", hex: "#1f6f6a" },
  { name: "Forest", hex: "#1e3d32" },
  { name: "Olive", hex: "#5c6844" },
  { name: "Sage", hex: "#a3b18a" },
  { name: "Khaki", hex: "#b7a88a" },
  { name: "Camel", hex: "#c4a574" },
  { name: "Tan", hex: "#b08968" },
  { name: "Brown", hex: "#6b4423" },
  { name: "Rust", hex: "#a3472d" },
  { name: "Burgundy", hex: "#6e2434" },
  { name: "Blush", hex: "#e7c1b8" },
  { name: "Rose", hex: "#c45c6a" },
  { name: "Red", hex: "#b4232a" },
  { name: "Orange", hex: "#e07a2f" },
  { name: "Marigold", hex: "#e2b13c" },
  { name: "Gold", hex: "#d4b06a" },
  { name: "Yellow", hex: "#e4d27a" },
  { name: "Lavender", hex: "#b7a6d6" },
  { name: "Plum", hex: "#5c3a5e" },
];

export function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => clampByte(n).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const n = parseInt(match[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

/** Chroma-weighted distance so shadows of the same surface stay close. */
export function colorDistance(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
): number {
  const y1 = 0.299 * r1 + 0.587 * g1 + 0.114 * b1;
  const y2 = 0.299 * r2 + 0.587 * g2 + 0.114 * b2;
  const cb1 = 128 - 0.168736 * r1 - 0.331264 * g1 + 0.5 * b1;
  const cb2 = 128 - 0.168736 * r2 - 0.331264 * g2 + 0.5 * b2;
  const cr1 = 128 + 0.5 * r1 - 0.418688 * g1 - 0.081312 * b1;
  const cr2 = 128 + 0.5 * r2 - 0.418688 * g2 - 0.081312 * b2;
  return Math.hypot(cb1 - cb2, cr1 - cr2) * 2.15 + Math.abs(y1 - y2) * 0.32;
}

export function colorName(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "Color";
  let best = NAMED[0];
  let bestDist = Infinity;
  for (const entry of NAMED) {
    const other = hexToRgb(entry.hex);
    if (!other) continue;
    const dist = colorDistance(rgb.r, rgb.g, rgb.b, other.r, other.g, other.b);
    if (dist < bestDist) {
      bestDist = dist;
      best = entry;
    }
  }
  return best.name;
}

export function isNeutral(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  const { s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  return s < 0.14 || l > 0.9 || l < 0.12;
}

export function hueDelta(a: string, b: string): number {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return 0;
  const ha = rgbToHsl(ra.r, ra.g, ra.b).h;
  const hb = rgbToHsl(rb.r, rb.g, rb.b).h;
  const d = Math.abs(ha - hb);
  return Math.min(d, 360 - d);
}

export type Harmony = "neutral" | "monochrome" | "analogous" | "complement" | "clash" | "quiet";

export function harmonyOf(a: string, b: string): Harmony {
  if (isNeutral(a) || isNeutral(b)) return "neutral";
  const d = hueDelta(a, b);
  if (d < 18) return "monochrome";
  if (d < 42) return "analogous";
  if (d >= 150 && d <= 195) return "complement";
  if (d >= 55 && d <= 115) return "clash";
  return "quiet";
}

export function pairScore(a: string, b: string): number {
  const kind = harmonyOf(a, b);
  if (kind === "neutral") return 0.84;
  if (kind === "monochrome") return 0.9;
  if (kind === "analogous") return 0.82;
  if (kind === "complement") return 0.8;
  if (kind === "quiet") return 0.68;
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return 0.4;
  const sa = rgbToHsl(ra.r, ra.g, ra.b).s;
  const sb = rgbToHsl(rb.r, rb.g, rb.b).s;
  if (sa > 0.55 && sb > 0.55) return 0.34;
  return 0.55;
}

export function relationClause(a: string, b: string): string {
  switch (harmonyOf(a, b)) {
    case "neutral":
      return "stay out of each other's way";
    case "monochrome":
      return "read as one color at two depths";
    case "analogous":
      return "sit beside each other on the color wheel";
    case "complement":
      return "are near-complements, lively but balanced";
    case "clash":
      return "compete, so one of them should stay small";
    default:
      return "meet in the middle, neither matchy nor loud";
  }
}

export function harmonyPhrase(a: string, b: string): string {
  return `${colorName(a).toLowerCase()} and ${colorName(b).toLowerCase()} ${relationClause(a, b)}`;
}

export function extractPalette(raster: PaletteRaster, count = 4): string[] {
  const { data, width, height } = raster;
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 8000)));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 200) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      bin.n += 1;
      bin.r += r;
      bin.g += g;
      bin.b += b;
      bins.set(key, bin);
    }
  }
  const ranked = [...bins.values()].sort((a, b) => b.n - a.n);
  const colors: string[] = [];
  for (const bin of ranked) {
    const hex = rgbToHex(bin.r / bin.n, bin.g / bin.n, bin.b / bin.n);
    const tooClose = colors.some((existing) => {
      const prev = hexToRgb(existing);
      const cur = hexToRgb(hex);
      return !!prev && !!cur && colorDistance(prev.r, prev.g, prev.b, cur.r, cur.g, cur.b) < 22;
    });
    if (tooClose) continue;
    colors.push(hex);
    if (colors.length >= count) break;
  }
  return colors;
}
