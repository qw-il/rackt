import type { AiSettings, Category, OutfitReview, ProviderId } from "../types";

const STORAGE_KEY = "atelier-settings";

export const PROVIDERS: Record<ProviderId, { label: string; baseUrl: string; model: string }> = {
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4o-mini",
  },
  groq: {
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
  },
  custom: {
    label: "Custom",
    baseUrl: "https://",
    model: "",
  },
};

const CATEGORY_IDS: Category[] = ["top", "bottom", "dress", "outerwear", "shoes", "bag", "accessory", "other"];

export function defaultSettings(): AiSettings {
  return {
    provider: "openai",
    baseUrl: PROVIDERS.openai.baseUrl,
    model: PROVIDERS.openai.model,
    apiKey: "",
    tagOnAdd: true,
  };
}

export function loadSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    const provider = parsed.provider && parsed.provider in PROVIDERS ? parsed.provider : "openai";
    return {
      ...defaultSettings(),
      ...parsed,
      provider,
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : PROVIDERS[provider].baseUrl,
      model: typeof parsed.model === "string" ? parsed.model : PROVIDERS[provider].model,
      tagOnAdd: parsed.tagOnAdd !== false,
    };
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings: AiSettings) {
  const { apiKey, ...rest } = settings;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...rest, apiKey }));
}

export class AiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiError";
  }
}

type ChatMessage = {
  role: "system" | "user";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
};

export async function complete(settings: AiSettings, messages: ChatMessage[]): Promise<string> {
  const key = settings.apiKey.trim();
  if (!key) throw new AiError("Add an API key in settings first.");
  const model = settings.model.trim();
  if (!model) throw new AiError("Add a model name.");
  const base = normalizeBase(settings.baseUrl);

  let response: Response;
  try {
    response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages,
      }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new AiError("The provider took too long to answer.");
    }
    throw new AiError("Could not reach that provider. Check the address.");
  }

  const text = await response.text();
  if (!response.ok) throw new AiError(redact(readableError(text, response.status), key));

  let content = "";
  try {
    const data = JSON.parse(text) as { choices?: { message?: { content?: string } }[] };
    content = data.choices?.[0]?.message?.content ?? "";
  } catch {
    throw new AiError("The provider returned something that wasn't JSON.");
  }
  if (!content.trim()) throw new AiError("The provider returned an empty reply.");
  return content;
}

export async function testConnection(settings: AiSettings): Promise<void> {
  await complete(settings, [{ role: "user", content: "Reply with the single word ready." }]);
}

export async function identifyNamedPiece(
  settings: AiSettings,
  name: string,
): Promise<{ category: Category; color: string; note: string }> {
  const content = await complete(settings, [
    {
      role: "system",
      content:
        'You identify one garment from the name its owner typed. Reply with JSON only: {"category":"top"|"bottom"|"dress"|"outerwear"|"shoes"|"bag"|"accessory"|"other","color":"#rrggbb","note":string}. note is one short sentence. color is a plausible staple hex for that piece. Do not rename it. No markdown.',
    },
    { role: "user", content: name },
  ]);
  const parsed = parseJson(content);
  const rawCategory = typeof parsed.category === "string" ? parsed.category : "other";
  const category = CATEGORY_IDS.includes(rawCategory as Category) ? (rawCategory as Category) : "other";
  const rawColor = typeof parsed.color === "string" ? parsed.color.trim() : "";
  const color = /^#[0-9a-f]{6}$/i.test(rawColor) ? rawColor.toLowerCase() : "#3c3a37";
  const note = typeof parsed.note === "string" ? parsed.note.trim().slice(0, 180) : "";
  return { category, color, note };
}

export async function tagGarment(
  settings: AiSettings,
  dataUrl: string,
): Promise<{ name: string; category: Category; note: string }> {
  const content = await complete(settings, [
    {
      role: "system",
      content:
        'You label one clothing photo for a personal wardrobe. Reply with JSON only: {"name": string, "category": "top"|"bottom"|"dress"|"outerwear"|"shoes"|"bag"|"accessory"|"other", "note": string}. name is 2 to 4 words, specific and plain. note is one short sentence about color or fabric. No markdown.',
    },
    {
      role: "user",
      content: [
        { type: "text", text: "What piece of clothing is this?" },
        { type: "image_url", image_url: { url: dataUrl } },
      ],
    },
  ]);
  const parsed = parseJson(content);
  const rawCategory = typeof parsed.category === "string" ? parsed.category : "other";
  const category = CATEGORY_IDS.includes(rawCategory as Category) ? (rawCategory as Category) : "other";
  const name = typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim().slice(0, 48) : "Untitled piece";
  const note = typeof parsed.note === "string" ? parsed.note.trim().slice(0, 180) : "";
  return { name, category, note };
}

export type RatedOutfit = { title: string; ids: string[]; review: OutfitReview };

const RATE_SHAPE =
  '{"title": string, "score": number, "summary": string, "pros": string[], "cons": string[]}. score is an integer from 1 to 100. summary is one sentence. pros and cons are three short, specific points each.';

export function clampScore(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(number)) return null;
  return Math.max(1, Math.min(100, Math.round(number)));
}

export function normalizeReview(value: unknown): OutfitReview | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const score = clampScore(record.score);
  if (score === null) return null;
  return {
    score,
    summary: clip(record.summary, 220),
    pros: clipList(record.pros),
    cons: clipList(record.cons),
  };
}

export async function rateOutfit(
  settings: AiSettings,
  pieces: { id: string; name: string; category: string; colors: string[] }[],
): Promise<{ title: string; review: OutfitReview }> {
  const content = await complete(settings, [
    {
      role: "system",
      content: `You rate one real outfit made only from the pieces given. Reply with JSON only: ${RATE_SHAPE} Do not invent pieces. No markdown.`,
    },
    { role: "user", content: JSON.stringify({ pieces }) },
  ]);
  const parsed = parseJson(content);
  const review = normalizeReview(parsed);
  if (!review) throw new AiError("The model did not return a score from 1 to 100.");
  return { title: clip(parsed.title, 48) || "Rated look", review };
}

export async function styleAdvice(
  settings: AiSettings,
  pieces: { id: string; name: string; category: string; colors: string[] }[],
): Promise<{ intro: string; outfits: RatedOutfit[] }> {
  const owned = new Set(pieces.map((piece) => piece.id));
  const content = await complete(settings, [
    {
      role: "system",
      content:
        'You are the only stylist for this wardrobe. Use only the piece ids provided. Reply with JSON only: {"intro": string, "outfits": [{"title": string, "ids": string[], "score": number, "summary": string, "pros": string[], "cons": string[]}]}. Return 3 outfits. score is an integer from 1 to 100. summary is one sentence. pros and cons are three short points each. Do not invent pieces. No markdown.',
    },
    {
      role: "user",
      content: JSON.stringify({
        pieces,
        ask: "Build three outfits from these pieces. Rate each from 1 to 100 and list pros and cons.",
      }),
    },
  ]);
  const parsed = parseJson(content);
  const intro = clip(parsed.intro, 280);
  const outfits: RatedOutfit[] = [];
  const raw = Array.isArray(parsed.outfits) ? parsed.outfits : [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const ids = Array.isArray(record.ids) ? record.ids.filter((id): id is string => typeof id === "string" && owned.has(id)) : [];
    const review = normalizeReview(record);
    if (ids.length < 2 || !review) continue;
    outfits.push({
      title: clip(record.title, 48) || "Suggested look",
      ids: [...new Set(ids)].slice(0, 6),
      review,
    });
  }
  return { intro, outfits };
}

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function clipList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim().slice(0, 140))
    .slice(0, 4);
}

export function parseJson(text: string): Record<string, unknown> {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return asRecord(JSON.parse(trimmed));
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return asRecord(JSON.parse(trimmed.slice(start, end + 1)));
      } catch {
        /* fall through */
      }
    }
  }
  throw new AiError("The reply wasn't usable JSON.");
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AiError("The reply wasn't usable JSON.");
  }
  return value as Record<string, unknown>;
}

export function normalizeBase(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new AiError("The provider address isn't a valid URL.");
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (!(url.protocol === "https:" || (url.protocol === "http:" && local))) {
    throw new AiError("Use an https address, or http://localhost for a model on this machine.");
  }
  let path = url.pathname.replace(/\/+$/, "");
  if (!path.includes("/v1")) path = `${path}/v1`;
  return `${url.origin}${path}`;
}

function readableError(text: string, status: number): string {
  try {
    const data = JSON.parse(text) as { error?: { message?: string } | string };
    const message = typeof data.error === "string" ? data.error : data.error?.message;
    if (message) return message.slice(0, 180);
  } catch {
    /* ignore */
  }
  if (status === 401 || status === 403) return "The key was refused. Check it and the model name.";
  if (status === 429) return "The provider is rate limiting requests. Wait a moment and try again.";
  return `The provider returned status ${status}.`;
}

function redact(message: string, key: string): string {
  if (key.length < 6) return message;
  return message.split(key).join("••••");
}
