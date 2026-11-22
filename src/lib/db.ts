import type { DayPlan, Garment, Outfit } from "../types";

const DB_NAME = "atelier";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("garments")) db.createObjectStore("garments", { keyPath: "id" });
      if (!db.objectStoreNames.contains("outfits")) db.createObjectStore("outfits", { keyPath: "id" });
      if (!db.objectStoreNames.contains("days")) db.createObjectStore("days", { keyPath: "date" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the wardrobe."));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The wardrobe could not be read."));
  });
}

async function withStore<T>(
  name: "garments" | "outfits" | "days",
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | void> {
  const db = await openDb();
  try {
    const tx = db.transaction(name, mode);
    const result = fn(tx.objectStore(name));
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Could not save to the wardrobe."));
      tx.onabort = () => reject(tx.error ?? new Error("The wardrobe save was cancelled."));
    });
    const value = result ? await requestToPromise(result) : undefined;
    await done;
    return value;
  } finally {
    db.close();
  }
}

export async function loadCloset(): Promise<{ garments: Garment[]; outfits: Outfit[]; days: DayPlan[] }> {
  const db = await openDb();
  try {
    const tx = db.transaction(["garments", "outfits", "days"], "readonly");
    const garments = requestToPromise(tx.objectStore("garments").getAll() as IDBRequest<Garment[]>);
    const outfits = requestToPromise(tx.objectStore("outfits").getAll() as IDBRequest<Outfit[]>);
    const days = requestToPromise(tx.objectStore("days").getAll() as IDBRequest<DayPlan[]>);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Could not read the wardrobe."));
    });
    return {
      garments: await garments,
      outfits: await outfits,
      days: await days,
    };
  } finally {
    db.close();
  }
}

export function saveGarment(garment: Garment): Promise<void> {
  return withStore("garments", "readwrite", (store) => {
    store.put(garment);
  }).then(() => undefined);
}

export function deleteGarment(id: string): Promise<void> {
  return withStore("garments", "readwrite", (store) => {
    store.delete(id);
  }).then(() => undefined);
}

export function saveOutfit(outfit: Outfit): Promise<void> {
  return withStore("outfits", "readwrite", (store) => {
    store.put(outfit);
  }).then(() => undefined);
}

export function deleteOutfit(id: string): Promise<void> {
  return withStore("outfits", "readwrite", (store) => {
    store.delete(id);
  }).then(() => undefined);
}

export function saveDay(day: DayPlan): Promise<void> {
  return withStore("days", "readwrite", (store) => {
    store.put(day);
  }).then(() => undefined);
}

export function deleteDay(date: string): Promise<void> {
  return withStore("days", "readwrite", (store) => {
    store.delete(date);
  }).then(() => undefined);
}
