import type { Category, Garment, Look } from "../types";
import { colorName, harmonyPhrase, isNeutral, pairScore, relationClause } from "./color";

const SLOT_ORDER: Category[] = ["outerwear", "top", "dress", "bottom", "shoes", "bag", "accessory"];

export function paletteOf(garments: Garment[]): string[] {
  const colors: string[] = [];
  for (const garment of garments) {
    for (const color of garment.colors) {
      if (!colors.includes(color)) colors.push(color);
      if (colors.length >= 5) return colors;
    }
  }
  return colors;
}

export function scoreOutfit(garments: Garment[]): number {
  const primaries = garments.map((garment) => garment.colors[0]).filter(Boolean);
  if (primaries.length === 0) return 0;
  if (primaries.length === 1) return 0.7;
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < primaries.length; i++) {
    for (let j = i + 1; j < primaries.length; j++) {
      total += pairScore(primaries[i], primaries[j]);
      pairs += 1;
    }
  }
  let score = total / pairs;
  if (garments.some((garment) => garment.category === "shoes")) score += 0.04;
  if (garments.some((garment) => garment.category === "outerwear")) score += 0.02;
  return Math.max(0, Math.min(1, score));
}

export function titleFor(garments: Garment[]): string {
  const names: string[] = [];
  for (const garment of orderPieces(garments)) {
    const name = garment.colors[0] ? colorName(garment.colors[0]) : "";
    if (name && !names.includes(name)) names.push(name);
    if (names.length === 2) break;
  }
  if (names.length >= 2) return `${names[0]} & ${names[1].toLowerCase()}`;
  if (names.length === 1) return names[0];
  return "Untitled look";
}

export function explainOutfit(garments: Garment[]): string {
  const ordered = orderPieces(garments).filter((garment) => garment.category !== "accessory");
  if (ordered.length === 0) return "Add a piece to start a look.";
  if (ordered.length === 1) {
    return `${ordered[0].name} is on the board. Add a second piece to see how the colors sit.`;
  }
  const [first, second, ...rest] = ordered;
  const a = first.colors[0];
  const b = second.colors[0];
  const relation = a && b ? relationClause(a, b) : "work as a pair";
  const lead = `${first.name} and ${second.name} ${relation}.`;
  const closer = rest
    .slice(0, 2)
    .map((garment) => {
      const quiet = garment.colors[0] && isNeutral(garment.colors[0]);
      return quiet ? `${garment.name} keeps it quiet.` : `The accent is the ${garment.name.toLowerCase()}.`;
    })
    .join(" ");
  return closer ? `${lead} ${closer}` : lead;
}

export function describeSelection(garments: Garment[]): { title: string; why: string; score: number; palette: string[] } {
  return {
    title: titleFor(garments),
    why: explainOutfit(garments),
    score: scoreOutfit(garments),
    palette: paletteOf(garments),
  };
}

export function recommendLooks(garments: Garment[], limit = 6): Look[] {
  const by = group(garments);
  const looks: Look[] = [];
  const seen = new Set<string>();

  const push = (pieces: Garment[]) => {
    const unique = dedupe(pieces);
    if (unique.length < 2) return;
    const key = unique
      .map((piece) => piece.id)
      .sort()
      .join(":");
    if (seen.has(key)) return;
    seen.add(key);
    const described = describeSelection(unique);
    looks.push({
      id: key,
      garmentIds: unique.map((piece) => piece.id),
      title: described.title,
      why: described.why,
      score: described.score,
      palette: described.palette,
    });
  };

  for (const top of by.top) {
    for (const bottom of by.bottom) {
      const shoes = bestCompanion([...by.shoes], [top, bottom]);
      const core = [top, bottom, shoes].filter((piece): piece is Garment => !!piece);
      push(core);
      const layer = bestCompanion(by.outerwear, core);
      if (layer) push([...core, layer]);
    }
  }

  for (const dress of by.dress) {
    const shoes = bestCompanion([...by.shoes], [dress]);
    const core = [dress, shoes].filter((piece): piece is Garment => !!piece);
    push(core);
    const layer = bestCompanion(by.outerwear, core);
    if (layer) push([...core, layer]);
  }

  const ranked = looks.sort((a, b) => b.score - a.score);
  const chosen: Look[] = [];
  const usedTop = new Map<string, number>();
  for (const look of ranked) {
    const anchor = look.garmentIds.find((id) => by.top.some((piece) => piece.id === id) || by.dress.some((piece) => piece.id === id));
    const count = anchor ? (usedTop.get(anchor) ?? 0) : 0;
    if (anchor && count >= 2) continue;
    chosen.push(look);
    if (anchor) usedTop.set(anchor, count + 1);
    if (chosen.length >= limit) break;
  }
  return chosen;
}

export type ColorPair = {
  leftId: string;
  rightId: string;
  sentence: string;
  score: number;
};

export function colorPairings(garments: Garment[], limit = 4): ColorPair[] {
  const pairs: ColorPair[] = [];
  for (let i = 0; i < garments.length; i++) {
    for (let j = i + 1; j < garments.length; j++) {
      const left = garments[i];
      const right = garments[j];
      if (left.category === right.category) continue;
      const a = left.colors[0];
      const b = right.colors[0];
      if (!a || !b) continue;
      const score = pairScore(a, b);
      if (score < 0.66) continue;
      pairs.push({
        leftId: left.id,
        rightId: right.id,
        score,
        sentence: `${left.name} with ${right.name}: ${harmonyPhrase(a, b)}.`,
      });
    }
  }
  return pairs.sort((a, b) => b.score - a.score).slice(0, limit);
}

function bestCompanion(options: Garment[], worn: Garment[]): Garment | undefined {
  let best: Garment | undefined;
  let bestScore = 0.62;
  for (const option of options) {
    const score = scoreOutfit([...worn, option]);
    if (score > bestScore) {
      bestScore = score;
      best = option;
    }
  }
  return best;
}

function group(garments: Garment[]): Record<Category, Garment[]> {
  const empty: Record<Category, Garment[]> = {
    top: [],
    bottom: [],
    dress: [],
    outerwear: [],
    shoes: [],
    bag: [],
    accessory: [],
    other: [],
  };
  for (const garment of garments) empty[garment.category].push(garment);
  return empty;
}

function dedupe(garments: Array<Garment | undefined>): Garment[] {
  const seen = new Set<string>();
  const result: Garment[] = [];
  for (const garment of garments) {
    if (!garment || seen.has(garment.id)) continue;
    seen.add(garment.id);
    result.push(garment);
  }
  return result;
}

export function orderPieces(garments: Garment[]): Garment[] {
  return [...garments].sort((a, b) => SLOT_ORDER.indexOf(a.category) - SLOT_ORDER.indexOf(b.category));
}
