import type { Category, Garment } from "../types";
import { categoryLabel } from "../types";
import { categoryFromWords } from "./categorize";
import { hexToRgb, rgbToHex } from "./color";

export const PIECE_COLORS: { name: string; hex: string }[] = [
  { name: "Ivory", hex: "#f3ecdf" },
  { name: "Cream", hex: "#efe2cc" },
  { name: "White", hex: "#f6f6f4" },
  { name: "Black", hex: "#1a1a1a" },
  { name: "Charcoal", hex: "#3c3a37" },
  { name: "Navy", hex: "#1e2a44" },
  { name: "Indigo", hex: "#2c3e66" },
  { name: "Olive", hex: "#5c6844" },
  { name: "Forest", hex: "#1e3d32" },
  { name: "Sage", hex: "#a3b18a" },
  { name: "Camel", hex: "#c4a574" },
  { name: "Tan", hex: "#b08968" },
  { name: "Brown", hex: "#6b4423" },
  { name: "Rust", hex: "#a3472d" },
  { name: "Burgundy", hex: "#6e2434" },
  { name: "Gray", hex: "#8a8680" },
  { name: "Gold", hex: "#d4b06a" },
  { name: "Blue", hex: "#1f4e89" },
  { name: "Red", hex: "#b4232a" },
  { name: "Blush", hex: "#e7c1b8" },
];

const DEFAULT_COLOR = "#3c3a37";

const COLOR_WORDS: { pattern: RegExp; hex: string }[] = [
  { pattern: /\bivory\b/i, hex: "#f3ecdf" },
  { pattern: /\bcream\b/i, hex: "#efe2cc" },
  { pattern: /\bwhite\b/i, hex: "#f6f6f4" },
  { pattern: /\bblack\b/i, hex: "#1a1a1a" },
  { pattern: /\bcharcoal\b/i, hex: "#3c3a37" },
  { pattern: /\bnavy\b/i, hex: "#1e2a44" },
  { pattern: /\bindigo\b|\bdenim\b/i, hex: "#2c3e66" },
  { pattern: /\bolive\b/i, hex: "#5c6844" },
  { pattern: /\bforest\b|\bgreen\b/i, hex: "#1e3d32" },
  { pattern: /\bsage\b/i, hex: "#a3b18a" },
  { pattern: /\bcamel\b/i, hex: "#c4a574" },
  { pattern: /\btan\b|\bkhaki\b/i, hex: "#b08968" },
  { pattern: /\bbrown\b/i, hex: "#6b4423" },
  { pattern: /\brust\b|\borange\b/i, hex: "#a3472d" },
  { pattern: /\bburgundy\b|\bwine\b|\bmaroon\b/i, hex: "#6e2434" },
  { pattern: /\bgr[ae]y\b|\bsilver\b/i, hex: "#8a8680" },
  { pattern: /\bgold\b/i, hex: "#d4b06a" },
  { pattern: /\bblue\b/i, hex: "#1f4e89" },
  { pattern: /\bred\b/i, hex: "#b4232a" },
  { pattern: /\bpink\b|\bblush\b/i, hex: "#e7c1b8" },
];

export type NamedGuess = {
  category: Category;
  color: string;
  reason: string;
};

export function presentName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  const mixed = trimmed !== trimmed.toLowerCase() && trimmed !== trimmed.toUpperCase();
  if (mixed) return trimmed;
  return trimmed
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export function readNamedPiece(raw: string): NamedGuess {
  const text = raw.trim();
  const category = categoryFromWords(text);
  const color = colorFromWords(text) ?? DEFAULT_COLOR;
  if (!category) {
    return {
      category: "other",
      color,
      reason: "Nothing in the name says which category, so it starts in Other.",
    };
  }
  const tone = PIECE_COLORS.find((entry) => entry.hex === color)?.name;
  const colorBit = tone && color !== DEFAULT_COLOR ? ` ${tone.toLowerCase()}` : "";
  return {
    category,
    color,
    reason: `This reads as ${categoryLabel(category).toLowerCase()}${colorBit}.`,
  };
}

export function namedGarment(
  raw: string,
  category: Category,
  color: string,
  note = "",
  image?: Blob,
  colors?: string[],
): Omit<Garment, "id" | "createdAt"> {
  const name = presentName(raw);
  return {
    name,
    category,
    colors: colors && colors.length > 0 ? colors : [color],
    note,
    sample: false,
    image: image ?? silhouette(category, color),
  };
}

function colorFromWords(text: string): string | null {
  for (const entry of COLOR_WORDS) {
    if (entry.pattern.test(text)) return entry.hex;
  }
  return null;
}

function shade(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(rgb.r * amount, rgb.g * amount, rgb.b * amount);
}

function svgMarkup(category: Category, fill: string): string {
  const ink = shade(fill, 0.72);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 520" fill="none">${shapes(category, fill, ink)}<ellipse cx="200" cy="478" rx="92" ry="12" fill="rgba(28,25,21,0.08)"/></svg>`;
}

function silhouette(category: Category, fill: string): Blob {
  return new Blob([svgMarkup(category, fill)], { type: "image/svg+xml" });
}

export function namedPreview(category: Category, color: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup(category, color))}`;
}

function shapes(category: Category, fill: string, ink: string): string {
  switch (category) {
    case "bottom":
      return `<path fill="${fill}" d="M118 78h164l10 26-16 292h-52l-10-168-10 168h-52L108 104z"/><path d="M132 104h136" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>`;
    case "dress":
      return `<path fill="${fill}" d="M152 74c18 28 78 28 96 0l14 14-10 84 36 270H112l36-270-10-84 14-14z"/><path d="M170 88c12 16 48 16 60 0" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
    case "outerwear":
      return `<path fill="${fill}" d="M118 78 68 118 34 100l32 86 42-22v268h186V164l42 22 32-86-34 18-50-40-20 22h-56l-20-22z"/><path d="M200 168v250" stroke="${ink}" stroke-width="2"/>`;
    case "shoes":
      return `<path fill="${fill}" d="M78 268c28-62 78-78 132-48 36 12 78 10 112 32 8 28-6 58-48 66H128c-36 4-62-12-50-50z"/><path fill="${ink}" d="M86 312c40 10 196 8 236-8 6 16-6 32-36 36H126c-34 2-50-12-40-28z"/>`;
    case "bag":
      return `<path d="M150 168c2-46 98-46 100 0" stroke="${fill}" stroke-width="12" stroke-linecap="round"/><path fill="${fill}" d="M118 186h164l-18 236H136z"/>`;
    case "accessory":
      return `<circle cx="156" cy="250" r="42" stroke="${fill}" stroke-width="12"/><circle cx="244" cy="250" r="42" stroke="${fill}" stroke-width="12"/>`;
    case "other":
      return `<path fill="${fill}" d="M118 168h164c10 0 16 8 14 18l-18 196c-2 18-14 28-32 28H154c-18 0-30-10-32-28l-18-196c-2-10 4-18 14-18z"/><path d="M150 206h100M146 244h112" stroke="${ink}" stroke-width="3" stroke-linecap="round" opacity="0.65"/>`;
    default:
      return `<path fill="${fill}" d="M132 96 86 132 48 116l26 74 48-24v246h156V166l48 24 26-74-38 16-46-36c-18 28-86 28-104 0z"/><path d="M156 108c16 20 72 20 88 0" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
  }
}
