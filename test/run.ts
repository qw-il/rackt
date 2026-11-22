import { colorDistance, colorName, extractPalette, harmonyOf, pairScore, rgbToHex } from "../src/lib/color";
import { removeBackground, type Raster } from "../src/lib/background";
import { suggestCategory } from "../src/lib/categorize";
import { presentName, readNamedPiece } from "../src/lib/namedPiece";
import { parseBingImagePage, pieceSearchQueries, rankPieceImages } from "../src/lib/webImage";
import { colorPairings, recommendLooks } from "../src/lib/stylist";
import { clampScore, normalizeBase, normalizeReview, parseJson } from "../src/lib/ai";
import type { Garment } from "../src/types";

let failed = 0;

function assert(condition: unknown, message: string) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL ${message}`);
  }
}

function raster(width: number, height: number, paint: (x: number, y: number) => [number, number, number, number]): Raster {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = paint(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  return { width, height, data };
}

function alphaAt(image: Raster, x: number, y: number) {
  return image.data[(y * image.width + x) * 4 + 3];
}

const photo = raster(80, 80, (x, y) => {
  const shirt = x > 22 && x < 58 && y > 18 && y < 64;
  if (!shirt) {
    const shadow = y > 60 && x > 20 && x < 62;
    return shadow ? [226, 226, 226, 255] : [248, 248, 248, 255];
  }
  return [176, 48, 42, 255];
});
const cut = removeBackground(photo, 46);
assert(alphaAt(cut, 2, 2) === 0, "corner background is removed");
assert(alphaAt(cut, 40, 40) > 200, "shirt interior stays opaque");
assert(cut.data[(40 * 80 + 40) * 4] > 140, "shirt stays red");
assert(alphaAt(cut, 40, 70) === 0, "connected gray shadow is removed");

const palette = extractPalette(cut, 3);
assert(palette.length >= 1, "palette finds the shirt color");
assert(colorName(palette[0]).length > 0, "palette color has a name");
assert(pairScore("#1e2a44", "#efe2cc") > 0.7, "navy and cream score as an easy pair");
assert(harmonyOf("#b4232a", "#1f6f6a") === "complement", "red and teal read as complements");
assert(colorDistance(255, 255, 255, 250, 250, 250) < colorDistance(255, 255, 255, 180, 30, 30), "near-whites are closer than red");

const mask = (width: number, height: number, paint: (x: number, y: number) => boolean) => {
  const alpha = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) alpha[y * width + x] = paint(x, y) ? 255 : 0;
  }
  return alpha;
};

const shoes = mask(100, 40, (x, y) => y > 10 && y < 30 && x > 8 && x < 92);
assert(suggestCategory(shoes, 100, 40).category === "shoes", "wide low shape files as shoes");

const pants = mask(80, 140, (x, y) => {
  const waist = y < 36 && x > 18 && x < 62;
  const left = y >= 28 && x > 16 && x < 34;
  const right = y >= 28 && x > 46 && x < 64;
  return waist || left || right;
});
assert(suggestCategory(pants, 80, 140).category === "bottom", "split legs file as bottoms");

const dress = mask(70, 160, (x, y) => x > 18 && x < 52 && y > 8 && y < 150);
assert(suggestCategory(dress, 70, 160).category === "dress", "long column files as a dress");

const named = suggestCategory(mask(10, 10, () => true), 10, 10, "holiday-jeans.png");
assert(named.category === "bottom", "filename jeans files as bottoms");
assert(rgbToHex(255, 0, 0) === "#ff0000", "hex encoding");

const closet: Garment[] = [
  piece("top", "Ivory camisole", ["#f3ecdf"]),
  piece("top", "Navy oxford", ["#1e2a44"]),
  piece("bottom", "Cream trousers", ["#efe2cc"]),
  piece("bottom", "Indigo jeans", ["#2c3e66"]),
  piece("shoes", "Black loafers", ["#1a1a1a"]),
  piece("dress", "Burgundy slip", ["#6e2434"]),
];
const looks = recommendLooks(closet, 4);
assert(looks.length >= 3, "stylist returns several looks");
assert(looks.every((look) => look.garmentIds.every((id) => closet.some((item) => item.id === id))), "looks only use owned ids");
assert(looks.every((look) => look.score >= looks[looks.length - 1].score - 0.001), "looks are ranked by score");
assert(colorPairings(closet, 3).length > 0, "color pairings are suggested");
assert(parseJson('```json\n{"intro":"Quiet navy."}\n```').intro === "Quiet navy.", "json fences parse");
assert(clampScore("104") === 100, "scores clamp to 100");
assert(clampScore(0) === 1, "scores clamp to 1");
assert(clampScore("nope") === null, "a missing score is rejected");
const review = normalizeReview({ score: 82.4, summary: "  Clean. ", pros: ["Navy holds", ""], cons: "not a list" });
assert(review?.score === 82 && review.summary === "Clean." && review.pros.length === 1 && review.cons.length === 0, "reviews keep a score, a summary, and string lists");
assert(normalizeBase("https://api.openai.com/v1") === "https://api.openai.com/v1", "openai base is preserved");
assert(normalizeBase("https://example.com") === "https://example.com/v1", "bare host gains /v1");
let blocked = false;
try {
  normalizeBase("http://evil.example/v1");
} catch {
  blocked = true;
}
assert(blocked, "non-local http is refused");
assert(presentName("knickerbocker catskills") === "Knickerbocker Catskills", "typed names are title cased");
assert(presentName("Navy Oxford") === "Navy Oxford", "mixed-case names stay as typed");
const typed = readNamedPiece("knickerbocker catskills");
assert(typed.category === "other", "an unrecognized name still has a category");
assert(typed.color === "#3c3a37", "an unrecognized name gets a wearable default color");
assert(readNamedPiece("black loafers").category === "shoes", "loafer files as shoes");
assert(readNamedPiece("black loafers").color === "#1a1a1a", "black is read from the name");
assert(readNamedPiece("navy oxford").category === "top", "oxford files as a top");
assert(pieceSearchQueries("black loafers", "shoes")[0] === "black loafers shoes", "a loafer search also says shoes");
assert(pieceSearchQueries("knickerbocker catskills", "other")[0] === "knickerbocker catskills", "an unknown name is searched as typed");
const listing = [
  '[![Image 1](https://th.bing.com/th/id/OIP.coat?w=200&h=200)](https://www.bing.com/images/search?mediaurl=https%3A%2F%2Fshop.example%2Fcoat.jpg&q=coat)1200×1800[theruggedsociety.com](https://theruggedsociety.com/products/knickerbocker-catskills-canvas-coat)',
  '[![Image 2](https://th.bing.com/th/id/OIP.seal?w=200&h=200)](https://www.bing.com/images/search?mediaurl=https%3A%2F%2Fflags.example%2Fseal.jpg&q=navy)900×900[clipground.com](https://clipground.com/navy-symbol-clipart.html)',
  '[![Image 3](https://th.bing.com/th/id/OIP.wide?w=200&h=200)](https://www.bing.com/images/search?mediaurl=https%3A%2F%2Fshop.example%2Fwide.jpg&q=wide)2400×400[shop.example](https://shop.example/knickerbocker-banner)',
].join("\n");
const hits = parseBingImagePage(listing);
assert(hits.length === 3 && hits[0].host === "theruggedsociety.com", "image results keep the page and the thumbnail");
assert(rankPieceImages(hits, "knickerbocker catskills")[0]?.page.includes("catskills-canvas-coat"), "a typed name prefers the matching product photo");
const oxford = rankPieceImages(hits, "navy oxford");
assert(oxford.length === 1 && oxford[0].page.includes("canvas-coat"), "seals and banners are skipped, and a real photo can still be used");

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("ok");

function piece(category: Garment["category"], name: string, colors: string[]): Garment {
  return {
    id: name,
    name,
    category,
    colors,
    note: "",
    createdAt: 0,
    sample: false,
    image: new Blob(),
  };
}
