import type { Category } from "../types";
import { categoryLabel } from "../types";

export type Suggestion = {
  category: Category;
  confidence: number;
  reason: string;
};

const FILENAME_RULES: { pattern: RegExp; category: Category }[] = [
  { pattern: /sneaker|shoe|loafer|boot|heel|sandal|mule/i, category: "shoes" },
  { pattern: /jean|trouser|pant|chino|skirt|short/i, category: "bottom" },
  { pattern: /dress|gown|jumpsuit/i, category: "dress" },
  { pattern: /coat|jacket|blazer|parka|overshirt|cardigan|hoodie/i, category: "outerwear" },
  { pattern: /bag|tote|purse|backpack|clutch/i, category: "bag" },
  { pattern: /earring|necklace|scarf|belt|hat|sunglass|hoop|bracelet|watch|ring/i, category: "accessory" },
  { pattern: /\bbeanie\b|\bcaps?\b|\bsocks?\b|\bgloves?\b/i, category: "accessory" },
  { pattern: /\bflannel\b|\bhenley\b|\bsweatshirt\b|\boxford\b|\btee\b/i, category: "top" },
  { pattern: /shirt|tee|t-shirt|top|blouse|camisole|sweater|knit|tank|polo|camis/i, category: "top" },
];

type Box = { x: number; y: number; w: number; h: number };

export function suggestCategory(alpha: Uint8Array, width: number, height: number, filename = ""): Suggestion {
  const fromName = filename ? matchFilename(filename) : null;
  if (fromName) {
    return {
      category: fromName,
      confidence: 0.93,
      reason: `The file name reads as ${categoryLabel(fromName).toLowerCase()}.`,
    };
  }

  const box = bounds(alpha, width, height);
  if (!box || box.w < 2 || box.h < 2) {
    return { category: "other", confidence: 0.3, reason: "Nothing solid showed up after the background lift." };
  }

  const aspect = box.h / box.w;
  const fill = opaqueCount(alpha, width, box) / (box.w * box.h);

  if (hasLegGap(alpha, width, box)) {
    return { category: "bottom", confidence: 0.78, reason: "The lower half splits into legs, so this files as bottoms." };
  }
  if (hasHandle(alpha, width, box)) {
    return { category: "bag", confidence: 0.7, reason: "There's a handle opening near the top, so this files as a bag." };
  }
  if (fill < 0.22) {
    return { category: "accessory", confidence: 0.62, reason: "The shape is small and open, so this files as an accessory." };
  }
  if (aspect < 0.58) {
    return { category: "shoes", confidence: 0.74, reason: "It's wide and low, the usual proportion for shoes." };
  }
  if (aspect >= 1.85 && !shouldersWider(alpha, width, box)) {
    return { category: "dress", confidence: 0.7, reason: "It's long and columnar, so this files as a dress." };
  }
  if (aspect >= 1.45 && shouldersWider(alpha, width, box)) {
    return { category: "outerwear", confidence: 0.64, reason: "Broad shoulders and a longer body read as a layer." };
  }
  if (aspect < 1.28) {
    return { category: "top", confidence: 0.66, reason: "The proportion matches a shirt, knit, or blouse." };
  }
  return { category: "bottom", confidence: 0.58, reason: "The length without a split reads as a skirt or trousers." };
}

function matchFilename(filename: string): Category | null {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  return categoryFromWords(base);
}

export function categoryFromWords(text: string): Category | null {
  for (const rule of FILENAME_RULES) {
    if (rule.pattern.test(text)) return rule.category;
  }
  return null;
}

function bounds(alpha: Uint8Array, width: number, height: number): Box | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x] < 32) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function opaqueCount(alpha: Uint8Array, width: number, box: Box): number {
  let n = 0;
  for (let y = box.y; y < box.y + box.h; y++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      if (alpha[y * width + x] >= 32) n += 1;
    }
  }
  return n;
}

function rowRuns(alpha: Uint8Array, width: number, y: number, x0: number, x1: number): number {
  let runs = 0;
  let on = false;
  for (let x = x0; x <= x1; x++) {
    const opaque = alpha[y * width + x] >= 32;
    if (opaque && !on) runs += 1;
    on = opaque;
  }
  return runs;
}

function spanWidth(alpha: Uint8Array, width: number, y: number, x0: number, x1: number): number {
  let min = x1;
  let max = x0;
  let any = false;
  for (let x = x0; x <= x1; x++) {
    if (alpha[y * width + x] < 32) continue;
    any = true;
    if (x < min) min = x;
    if (x > max) max = x;
  }
  return any ? max - min + 1 : 0;
}

function hasLegGap(alpha: Uint8Array, width: number, box: Box): boolean {
  const y0 = box.y + Math.floor(box.h * 0.55);
  const y1 = box.y + Math.floor(box.h * 0.9);
  let rows = 0;
  let split = 0;
  for (let y = y0; y <= y1; y++) {
    rows += 1;
    if (rowRuns(alpha, width, y, box.x, box.x + box.w - 1) >= 2) split += 1;
  }
  return rows > 4 && split / rows > 0.55;
}

function shouldersWider(alpha: Uint8Array, width: number, box: Box): boolean {
  const shoulderY = box.y + Math.floor(box.h * 0.18);
  const hemY = box.y + Math.floor(box.h * 0.72);
  const shoulder = spanWidth(alpha, width, shoulderY, box.x, box.x + box.w - 1);
  const hem = spanWidth(alpha, width, hemY, box.x, box.x + box.w - 1);
  return shoulder > hem * 1.12 && shoulder > 0;
}

function hasHandle(alpha: Uint8Array, width: number, box: Box): boolean {
  const yStart = box.y + Math.floor(box.h * 0.08);
  const yEnd = box.y + Math.floor(box.h * 0.42);
  let enclosed = 0;
  for (let y = yStart; y <= yEnd; y++) {
    const row = y;
    let x = box.x;
    const x1 = box.x + box.w - 1;
    while (x <= x1 && alpha[row * width + x] < 32) x += 1;
    const left = x;
    while (x <= x1 && alpha[row * width + x] >= 32) x += 1;
    const gapStart = x;
    while (x <= x1 && alpha[row * width + x] < 32) x += 1;
    const gapEnd = x - 1;
    while (x <= x1 && alpha[row * width + x] >= 32) x += 1;
    if (gapEnd < gapStart || left > x1) continue;
    const gap = gapEnd - gapStart + 1;
    if (gap < Math.max(3, box.w * 0.08)) continue;
    if (y <= box.y) continue;
    let covered = 0;
    for (let gx = gapStart; gx <= gapEnd; gx++) {
      if (alpha[(y - 1) * width + gx] >= 32) covered += 1;
    }
    if (covered / gap > 0.7) enclosed += 1;
  }
  return enclosed >= 3;
}
