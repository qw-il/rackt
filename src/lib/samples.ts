import type { Category, Garment } from "../types";

type SampleSpec = {
  name: string;
  category: Category;
  colors: string[];
  note: string;
  body: string;
};

function svg(body: string): Blob {
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 520" fill="none">${body}<ellipse cx="200" cy="478" rx="92" ry="12" fill="rgba(28,25,21,0.08)"/></svg>`;
  return new Blob([doc], { type: "image/svg+xml" });
}

const SAMPLES: SampleSpec[] = [
  {
    name: "Ivory camisole",
    category: "top",
    colors: ["#f3ecdf", "#e4d9c8"],
    note: "A thin warm white, easy with navy or denim.",
    body: `
      <path fill="#f3ecdf" d="M148 92c16 30 88 30 104 0l16 12-18 72 20 246H130l20-246-18-72 16-12z"/>
      <path d="M168 104c14 18 50 18 64 0" stroke="#e0d4c4" stroke-width="3" stroke-linecap="round"/>
      <path d="M200 128v286" stroke="#e7dccb" stroke-width="2"/>
    `,
  },
  {
    name: "Black fine knit",
    category: "top",
    colors: ["#1c1c1c", "#3a3a3a"],
    note: "A close black knit. It will quiet almost any color next to it.",
    body: `
      <path fill="#1b1b1b" d="M132 96 86 132 48 116l26 74 48-24v246h156V166l48 24 26-74-38 16-46-36c-18 28-86 28-104 0z"/>
      <path d="M156 108c16 20 72 20 88 0" stroke="#3a3a3a" stroke-width="3" stroke-linecap="round"/>
      <path d="M86 140c18 16 22 34 10 48M314 140c-18 16-22 34-10 48" stroke="#2e2e2e" stroke-width="2" stroke-linecap="round"/>
    `,
  },
  {
    name: "Navy oxford",
    category: "top",
    colors: ["#1e2a44", "#f4efe6"],
    note: "Crisp navy with an open collar. A classic with cream.",
    body: `
      <path fill="#1e2a44" d="M126 104 78 140 44 124l28 78 46-26 6 236h152l6-236 46 26 28-78-34 16-48-36-24 20h-52l-24-20z"/>
      <path fill="#f3ecdf" d="M168 112l32 42 32-42 16 86-48 30-48-30z"/>
      <path d="M200 168v210" stroke="#c9bfb0" stroke-width="2"/>
      <circle cx="200" cy="196" r="2.2" fill="#1e2a44"/>
      <circle cx="200" cy="224" r="2.2" fill="#1e2a44"/>
      <circle cx="200" cy="252" r="2.2" fill="#1e2a44"/>
      <path d="M78 148c20 18 24 40 8 56M322 148c-20 18-24 40-8 56" stroke="#162033" stroke-width="2" stroke-linecap="round"/>
    `,
  },
  {
    name: "Olive overshirt",
    category: "outerwear",
    colors: ["#5c6844", "#d9d3c4"],
    note: "An unlined overshirt. Wear it open over ivory or black.",
    body: `
      <path fill="#5c6844" d="M122 92 74 128 40 112l30 80 44-24v214h172V168l44 24 30-80-34 16-48-36-22 18h-48l-22-18z"/>
      <path fill="#e7e1d4" d="M170 108l30 36 30-36 10 78-40 24-40-24z"/>
      <path d="M200 150v220" stroke="#3f492f" stroke-width="2"/>
      <path d="M74 136c18 16 24 38 10 54M326 136c-18 16-24 38-10 54" stroke="#3f492f" stroke-width="2" stroke-linecap="round"/>
    `,
  },
  {
    name: "Camel coat",
    category: "outerwear",
    colors: ["#c4a574", "#8c6b3e"],
    note: "A long camel coat. It warms navy, black, and cream.",
    body: `
      <path fill="#c4a574" d="M118 78 68 118 34 100l32 86 42-22v268h186V164l42 22 32-86-34 18-50-40-20 22h-56l-20-22z"/>
      <path fill="#a68452" d="M166 96l34 48 34-48 14 96-48 36-48-36z"/>
      <path d="M200 168v250" stroke="#8d6a3c" stroke-width="2.4"/>
      <path d="M70 126c22 20 28 46 12 66M330 126c-22 20-28 46-12 66" stroke="#8d6a3c" stroke-width="2" stroke-linecap="round"/>
    `,
  },
  {
    name: "Cream trousers",
    category: "bottom",
    colors: ["#e7dccb", "#cfc3ae"],
    note: "Straight cream trousers. They take navy, olive, and black cleanly.",
    body: `
      <path fill="#e7dccb" d="M118 78h164l10 26-16 292h-52l-10-168-10 168h-52L108 104z"/>
      <path d="M132 104h136" stroke="#d5c8b4" stroke-width="4" stroke-linecap="round"/>
      <path d="M154 118v250M246 118v250" stroke="#ddd1c0" stroke-width="2"/>
    `,
  },
  {
    name: "Indigo jeans",
    category: "bottom",
    colors: ["#2c3e66", "#1c2744"],
    note: "Straight indigo. A neutral in practice, especially with ivory and camel.",
    body: `
      <path fill="#2c3e66" d="M116 76h168l12 28-18 300h-54l-12-176-12 176h-54L104 104z"/>
      <path d="M130 102h140" stroke="#243454" stroke-width="5" stroke-linecap="round"/>
      <path d="M148 124h34l-4 28h-26z" fill="none" stroke="#8ea0c4" stroke-width="2"/>
      <path d="M156 150v230M244 150v230" stroke="#243454" stroke-width="2"/>
    `,
  },
  {
    name: "Black satin skirt",
    category: "bottom",
    colors: ["#161616", "#3a3a3a"],
    note: "A quiet A-line. It makes burgundy, ivory, and gold look dressed.",
    body: `
      <path fill="#171717" d="M142 108h116l48 286H94z"/>
      <path d="M154 108h92" stroke="#3a3a3a" stroke-width="4" stroke-linecap="round"/>
      <path d="M168 150c40 30 70 120 78 220" stroke="#2a2a2a" stroke-width="2"/>
    `,
  },
  {
    name: "Burgundy slip",
    category: "dress",
    colors: ["#6e2434", "#92293a"],
    note: "A long slip. Pair it with black shoes, or the camel coat when it's cool.",
    body: `
      <path fill="#6e2434" d="M152 74c18 28 78 28 96 0l14 14-10 84 36 270H112l36-270-10-84 14-14z"/>
      <path d="M170 88c12 16 48 16 60 0" stroke="#92293a" stroke-width="3" stroke-linecap="round"/>
      <path d="M200 120v310" stroke="#5a1d2b" stroke-width="2" opacity="0.45"/>
    `,
  },
  {
    name: "White sneakers",
    category: "shoes",
    colors: ["#f7f5f2", "#1c1c1c"],
    note: "Clean white leather. They keep a tailored pair from feeling formal.",
    body: `
      <path fill="#f7f5f2" d="M78 268c28-62 78-78 132-48 36 12 78 10 112 32 8 28-6 58-48 66H128c-36 4-62-12-50-50z"/>
      <path fill="#1c1c1c" d="M86 312c40 10 196 8 236-8 6 16-6 32-36 36H126c-34 2-50-12-40-28z"/>
      <path d="M150 250c18 16 40 18 62 8" stroke="#e4e0d8" stroke-width="3" stroke-linecap="round"/>
      <path d="M118 292h150" stroke="#dedad3" stroke-width="3" stroke-linecap="round"/>
    `,
  },
  {
    name: "Black loafers",
    category: "shoes",
    colors: ["#1a1a1a", "#3f3f3f"],
    note: "A low black loafer. The default shoe for navy, cream, and camel.",
    body: `
      <path fill="#1a1a1a" d="M86 286c22-48 70-62 124-36 34 14 74 12 108 30 6 22-8 48-46 54H132c-34 2-58-14-46-48z"/>
      <path fill="#2c2c2c" d="M96 318c36 8 188 6 220-6 4 12-8 26-34 28H130c-28 0-44-10-34-22z"/>
      <path d="M168 270c22 8 48 6 70-6" stroke="#3d3d3d" stroke-width="3" stroke-linecap="round"/>
    `,
  },
  {
    name: "Tan tote",
    category: "bag",
    colors: ["#b08968", "#8c6a4a"],
    note: "An unstructured tan tote. It echoes camel and cream.",
    body: `
      <path d="M150 168c2-46 98-46 100 0" stroke="#b08968" stroke-width="12" stroke-linecap="round"/>
      <path fill="#b08968" d="M118 186h164l-18 236H136z"/>
      <path d="M146 214h108" stroke="#c6a88a" stroke-width="3" stroke-linecap="round"/>
      <path d="M154 250c30 40 62 40 92 0" stroke="#8d6848" stroke-width="2" opacity="0.7"/>
    `,
  },
  {
    name: "Gold hoops",
    category: "accessory",
    colors: ["#d4b06a", "#f0e2b8"],
    note: "Small gold hoops. They warm black, navy, and burgundy.",
    body: `
      <circle cx="156" cy="250" r="42" stroke="#d4b06a" stroke-width="12"/>
      <circle cx="244" cy="250" r="42" stroke="#d4b06a" stroke-width="12"/>
      <path d="M138 232c10-16 28-22 40-12" stroke="#f3e6c4" stroke-width="3" stroke-linecap="round"/>
      <path d="M226 232c10-16 28-22 40-12" stroke="#f3e6c4" stroke-width="3" stroke-linecap="round"/>
    `,
  },
];

export async function createSampleGarments(): Promise<Garment[]> {
  const now = Date.now();
  return SAMPLES.map((sample, index) => ({
    id: crypto.randomUUID(),
    name: sample.name,
    category: sample.category,
    colors: sample.colors,
    note: sample.note,
    createdAt: now - index * 1000,
    sample: true,
    image: svg(sample.body),
  }));
}

export const STUDIO_SHOTS = [
  { src: "/studio/shirt.png", label: "Rust shirt on plaster" },
  { src: "/studio/jeans.png", label: "Indigo jeans on a floor" },
  { src: "/studio/sneaker.png", label: "White sneaker on seamless" },
] as const;
