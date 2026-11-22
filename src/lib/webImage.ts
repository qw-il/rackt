import type { Category } from "../types";
import { categoryLabel } from "../types";
import type { Raster } from "./background";
import { extractPalette } from "./color";
import { cutoutFromRaster, fileToRaster, rasterToPng } from "./image";

export type BingHit = {
  thumb: string;
  width: number;
  height: number;
  host: string;
  page: string;
  media: string;
};

export type PiecePhoto = {
  blob: Blob;
  colors: string[];
  host: string;
};

const COLOR_WORDS = new Set([
  "ivory", "cream", "white", "black", "charcoal", "navy", "indigo", "denim", "olive", "forest",
  "green", "sage", "camel", "tan", "khaki", "brown", "rust", "orange", "burgundy", "wine", "maroon",
  "gray", "grey", "silver", "gold", "blue", "red", "pink", "blush", "yellow", "purple",
]);

const STOP_WORDS = new Set(["the", "and", "for", "with", "from", "mens", "men", "womens", "women", "pair", "your"]);

const CATEGORY_NOUN: Record<Category, string> = {
  top: "shirt",
  bottom: "trousers",
  dress: "dress",
  outerwear: "jacket",
  shoes: "shoes",
  bag: "bag",
  accessory: "accessory",
  other: "clothing",
};

const JUNK = /wallpaper|clipart|clipground|logo|quotes|insignia|\bseal\b|\bflag\b|naval|navy\.mil|military|aircraft|cosplay|badge|emblem|\bvector\b|\bicon\b|\bmap\b/i;

const HIT = /\[!\[[^\]]*\]\((https:\/\/th\.bing\.com\/th\/id\/[^)\s]+)\)\]\((https:\/\/www\.bing\.com\/images\/search\?[^)\s]+)\)\s*(\d+)[×x](\d+)\[([^\]]+)\]\((https?:\/\/[^)\s]+)/g;

export function pieceSearchQueries(name: string, category: Category): string[] {
  const cleaned = name.trim().replace(/\s+/g, " ");
  if (category === "other") return [cleaned];
  const noun = CATEGORY_NOUN[category] || categoryLabel(category).toLowerCase();
  if (new RegExp(`\\b${noun}\\b`, "i").test(cleaned)) return [cleaned];
  return [`${cleaned} ${noun}`, cleaned];
}

export function parseBingImagePage(markdown: string): BingHit[] {
  const hits: BingHit[] = [];
  for (const match of markdown.matchAll(HIT)) {
    const thumb = match[1];
    if (!thumb.includes("/OIP.") && !thumb.includes("/OIG.")) continue;
    let media = "";
    try {
      media = decodeURIComponent(new URL(match[2]).searchParams.get("mediaurl") ?? "");
    } catch {
      media = "";
    }
    let page = match[6];
    try {
      page = decodeURIComponent(page);
    } catch {
      page = match[6];
    }
    hits.push({
      thumb,
      width: Number(match[3]),
      height: Number(match[4]),
      host: match[5],
      page,
      media,
    });
  }
  if (hits.length > 0) return hits;
  const loose = /https:\/\/th\.bing\.com\/th\/id\/OIP\.[^)\s"']+/g;
  for (const match of markdown.matchAll(loose)) {
    hits.push({
      thumb: match[0],
      width: 800,
      height: 800,
      host: "bing.com",
      page: match[0],
      media: match[0],
    });
  }
  return hits;
}

export function rankPieceImages(hits: BingHit[], name: string, allowUnmatched = true): BingHit[] {
  const tokens = distinctiveTokens(name);
  const usable = hits.filter((hit) => {
    if (hit.width < 240 || hit.height < 240) return false;
    const aspect = hit.width / hit.height;
    if (aspect > 2.4 || aspect < 0.35) return false;
    return !JUNK.test(`${hit.host} ${hit.page} ${hit.media}`);
  });
  const ranked = usable
    .map((hit, index) => ({ hit, index, score: matchScore(hit, tokens) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const matched = ranked.filter((item) => item.score > 0);
  const chosen = matched.length > 0 ? matched : allowUnmatched ? ranked : [];
  return chosen.map((item) => item.hit);
}

export function largerThumb(url: string): string {
  if (!url.includes("th.bing.com/th/id/")) return url;
  const parsed = new URL(url);
  parsed.searchParams.set("w", "720");
  parsed.searchParams.set("h", "720");
  return parsed.toString();
}

export function parseCommonsPages(payload: unknown): BingHit[] {
  if (!payload || typeof payload !== "object") return [];
  const pages = (payload as { query?: { pages?: Record<string, CommonsPage> } }).query?.pages;
  if (!pages) return [];
  const hits: BingHit[] = [];
  for (const page of Object.values(pages)) {
    const info = page.imageinfo?.[0];
    const thumb = info?.thumburl;
    if (!thumb || (info?.mime && !info.mime.startsWith("image/"))) continue;
    const title = page.title?.replace(/^File:/, "") ?? "Commons photo";
    hits.push({
      thumb,
      width: info?.thumbwidth || info?.width || 800,
      height: info?.thumbheight || info?.height || 800,
      host: "commons.wikimedia.org",
      page: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title ?? title)}`,
      media: info?.descriptionurl || thumb,
    });
  }
  return hits;
}

export async function findPiecePhoto(name: string, category: Category, signal?: AbortSignal): Promise<PiecePhoto | null> {
  const queries = pieceSearchQueries(name, category);
  for (const query of queries) {
    const photo = await firstDownloaded(await bingHits(query, signal), name, signal, true);
    if (photo) return photo;
  }
  for (const query of queries) {
    const photo = await firstDownloaded(await commonsHits(query, signal), name, signal, false);
    if (photo) return photo;
  }
  return null;
}

async function bingHits(query: string, signal?: AbortSignal): Promise<BingHit[]> {
  const target = `https://www.bing.com/images/search?${new URLSearchParams({ q: query, form: "HDRSC2" })}`;
  const response = await fetch(`https://r.jina.ai/${target}`, {
    signal: limitSignal(signal, 18000),
    referrerPolicy: "no-referrer",
    headers: { Accept: "text/plain" },
  });
  if (!response.ok) return [];
  return parseBingImagePage(await response.text());
}

async function commonsHits(query: string, signal?: AbortSignal): Promise<BingHit[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: "6",
    gsrlimit: "8",
    prop: "imageinfo",
    iiprop: "url|mime|size",
    iiurlwidth: "800",
  });
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    signal: limitSignal(signal, 12000),
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) return [];
  return parseCommonsPages(await response.json());
}

async function firstDownloaded(
  hits: BingHit[],
  name: string,
  signal: AbortSignal | undefined,
  allowUnmatched: boolean,
): Promise<PiecePhoto | null> {
  for (const hit of rankPieceImages(hits, name, allowUnmatched).slice(0, 5)) {
    const photo = await downloadHit(hit, signal);
    if (photo) return photo;
  }
  return null;
}

type CommonsPage = {
  title?: string;
  imageinfo?: {
    thumburl?: string;
    descriptionurl?: string;
    mime?: string;
    width?: number;
    height?: number;
    thumbwidth?: number;
    thumbheight?: number;
  }[];
};

function limitSignal(parent: AbortSignal | undefined, ms: number): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const stop = () => {
    clearTimeout(timer);
    controller.abort();
  };
  parent?.addEventListener("abort", stop, { once: true });
  controller.signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
  return controller.signal;
}

function distinctiveTokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word) && !COLOR_WORDS.has(word));
}

function matchScore(hit: BingHit, tokens: string[]): number {
  if (tokens.length === 0) return 1;
  const hay = `${hit.page} ${hit.media} ${hit.host}`.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    const stem = token.endsWith("s") ? token.slice(0, -1) : token;
    if (hay.includes(token) || (stem.length >= 4 && hay.includes(stem))) score += token.length;
  }
  return score;
}

async function downloadHit(hit: BingHit, signal?: AbortSignal): Promise<PiecePhoto | null> {
  try {
    const response = await fetch(largerThumb(hit.thumb), { signal: limitSignal(signal, 8000), referrerPolicy: "no-referrer" });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith("image/") || blob.size < 4000) return null;
    const raster = await fileToRaster(blob, 900);
    if (isFlat(raster)) return null;
    let kept = raster;
    let image = blob;
    if (borderIsPlain(raster)) {
      const cut = cutoutFromRaster(raster, 42, hit.page);
      const ratio = opaqueRatio(cut.removed);
      if (ratio > 0.08 && ratio < 0.86) {
        kept = cut.removed;
        image = await rasterToPng(cut.removed);
      }
    }
    let host = hit.host;
    try {
      host = new URL(hit.page).hostname.replace(/^www\./, "");
    } catch {
      host = hit.host;
    }
    return { blob: image, colors: extractPalette(kept, 3), host };
  } catch {
    return null;
  }
}

function isFlat(raster: Raster): boolean {
  return spread(samples(raster, false)) < 10;
}

function borderIsPlain(raster: Raster): boolean {
  return spread(samples(raster, true)) < 16;
}

function samples(raster: Raster, borderOnly: boolean): number[] {
  const { data, width, height } = raster;
  const values: number[] = [];
  const step = Math.max(1, Math.floor(Math.max(width, height) / 70));
  const take = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    if (data[i + 3] < 200) return;
    values.push(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
  };
  if (borderOnly) {
    for (let x = 0; x < width; x += step) {
      take(x, 0);
      if (height > 1) take(x, height - 1);
    }
    for (let y = 0; y < height; y += step) {
      take(0, y);
      if (width > 1) take(width - 1, y);
    }
    return values;
  }
  for (let y = 0; y < height; y += step * 2) {
    for (let x = 0; x < width; x += step * 2) take(x, y);
  }
  return values;
}

function spread(values: number[]): number {
  if (values.length < 8) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function opaqueRatio(raster: Raster): number {
  const { data } = raster;
  let seen = 0;
  let opaque = 0;
  const step = Math.max(1, Math.floor(data.length / 4 / 5000));
  for (let i = 0; i < data.length; i += step * 4) {
    seen += 1;
    if (data[i + 3] > 24) opaque += 1;
  }
  return seen === 0 ? 0 : opaque / seen;
}
