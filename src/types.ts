export const CATEGORIES = [
  { id: "top", label: "Tops" },
  { id: "bottom", label: "Bottoms" },
  { id: "dress", label: "Dresses" },
  { id: "outerwear", label: "Outerwear" },
  { id: "shoes", label: "Shoes" },
  { id: "bag", label: "Bags" },
  { id: "accessory", label: "Accessories" },
  { id: "other", label: "Other" },
] as const;

export type Category = (typeof CATEGORIES)[number]["id"];

export type Garment = {
  id: string;
  name: string;
  category: Category;
  colors: string[];
  note: string;
  createdAt: number;
  sample: boolean;
  image: Blob;
  original?: Blob;
};

export type OutfitReview = {
  score: number;
  summary: string;
  pros: string[];
  cons: string[];
};

export type Outfit = {
  id: string;
  name: string;
  garmentIds: string[];
  note: string;
  createdAt: number;
  review?: OutfitReview;
};

export type DayPlan = {
  date: string;
  outfitId: string;
};

export type ProviderId = "openai" | "openrouter" | "groq" | "custom";

export type AiSettings = {
  provider: ProviderId;
  baseUrl: string;
  model: string;
  apiKey: string;
  tagOnAdd: boolean;
};

export type Look = {
  id: string;
  garmentIds: string[];
  title: string;
  why: string;
  score: number;
  palette: string[];
};

export type ViewId = "closet" | "looks" | "builder" | "calendar";

export function categoryLabel(id: Category): string {
  return CATEGORIES.find((category) => category.id === id)?.label ?? "Other";
}
