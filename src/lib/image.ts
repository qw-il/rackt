import { alphaMask, removeBackground, type Raster } from "./background";
import { suggestCategory, type Suggestion } from "./categorize";
import { extractPalette } from "./color";

export async function fileToRaster(file: Blob, maxEdge = 1100): Promise<Raster> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This photo format isn't supported. Try a JPEG or PNG.");
  }
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("This browser can't read the photo.");
    ctx.drawImage(bitmap, 0, 0, width, height);
    const image = ctx.getImageData(0, 0, width, height);
    return { width, height, data: image.data };
  } finally {
    bitmap.close();
  }
}

export function rasterToCanvas(raster: Raster): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = raster.width;
  canvas.height = raster.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't draw the cutout.");
  const copy = new Uint8ClampedArray(raster.data);
  ctx.putImageData(new ImageData(copy, raster.width, raster.height), 0, 0);
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not save the image."));
    }, type, quality);
  });
}

export async function rasterToPng(raster: Raster): Promise<Blob> {
  return canvasToBlob(rasterToCanvas(raster), "image/png");
}

export async function rasterToJpeg(raster: Raster, quality = 0.86): Promise<Blob> {
  return canvasToBlob(rasterToCanvas(raster), "image/jpeg", quality);
}

export type Cutout = Suggestion & {
  removed: Raster;
  colors: string[];
};

export function cutoutFromRaster(raster: Raster, sensitivity: number, filename = ""): Cutout {
  const removed = removeBackground(raster, sensitivity);
  const colors = extractPalette(removed, 4);
  const suggestion = suggestCategory(alphaMask(removed), removed.width, removed.height, filename);
  return { removed, colors, ...suggestion };
}

export async function rasterToDataUrl(raster: Raster, maxEdge = 512): Promise<string> {
  const scale = Math.min(1, maxEdge / Math.max(raster.width, raster.height));
  const width = Math.max(1, Math.round(raster.width * scale));
  const height = Math.max(1, Math.round(raster.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare the photo for the stylist.");
  ctx.fillStyle = "#f4efe6";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(rasterToCanvas(raster), 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.72);
}
