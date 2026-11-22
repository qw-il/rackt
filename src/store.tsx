import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AiSettings, DayPlan, Garment, Outfit } from "./types";
import { loadSettings, saveSettings } from "./lib/ai";
import { deleteDay, deleteGarment, deleteOutfit, loadCloset, saveDay, saveGarment, saveOutfit } from "./lib/db";
import { createSampleGarments } from "./lib/samples";

const READY_KEY = "atelier-ready";

let bootPromise: Promise<Awaited<ReturnType<typeof loadCloset>>> | null = null;

function loadAndSeed(): Promise<Awaited<ReturnType<typeof loadCloset>>> {
  bootPromise ??= seedCloset().catch((error: unknown) => {
    bootPromise = null;
    throw error;
  });
  return bootPromise;
}

async function seedCloset() {
  let closet = await loadCloset();
  if (!localStorage.getItem(READY_KEY) && closet.garments.length === 0) {
    for (const sample of await createSampleGarments()) await saveGarment(sample);
    localStorage.setItem(READY_KEY, "1");
    closet = await loadCloset();
  } else if (!localStorage.getItem(READY_KEY)) {
    localStorage.setItem(READY_KEY, "1");
  }
  const seen = new Set<string>();
  let removed = false;
  for (const garment of closet.garments) {
    if (!garment.sample) continue;
    if (seen.has(garment.name)) {
      await deleteGarment(garment.id);
      removed = true;
    } else {
      seen.add(garment.name);
    }
  }
  return removed ? loadCloset() : closet;
}

type Toast = { id: number; message: string };

type ClosetStore = {
  ready: boolean;
  error: string;
  garments: Garment[];
  outfits: Outfit[];
  days: DayPlan[];
  settings: AiSettings;
  urls: Record<string, string>;
  selection: string[];
  toast: Toast | null;
  setSelection: (ids: string[]) => void;
  notify: (message: string) => void;
  addGarment: (input: Omit<Garment, "id" | "createdAt">) => Promise<Garment>;
  updateGarment: (garment: Garment) => Promise<void>;
  removeGarment: (id: string) => Promise<void>;
  addOutfit: (input: Omit<Outfit, "id" | "createdAt">) => Promise<Outfit>;
  removeOutfit: (id: string) => Promise<void>;
  planDay: (date: string, outfitId: string) => Promise<void>;
  clearDay: (date: string) => Promise<void>;
  updateSettings: (settings: AiSettings) => void;
  clearSamples: () => Promise<void>;
};

const ClosetContext = createContext<ClosetStore | null>(null);

export function ClosetProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [garments, setGarments] = useState<Garment[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [days, setDays] = useState<DayPlan[]>([]);
  const [settings, setSettings] = useState<AiSettings>(() => loadSettings());
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState<string[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const urlsRef = useRef<Map<string, { blob: Blob; url: string }>>(new Map());
  const toastTimer = useRef<number>(0);

  const notify = useCallback((message: string) => {
    const id = Date.now();
    setToast({ id, message });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 3400);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const closet = await loadAndSeed();
        if (cancelled) return;
        setGarments(sortGarments(closet.garments));
        setOutfits([...closet.outfits].sort((a, b) => b.createdAt - a.createdAt));
        setDays(closet.days);
        setReady(true);
      } catch (reason) {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : "The wardrobe could not be opened.");
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const map = urlsRef.current;
    const alive = new Set(garments.map((garment) => garment.id));
    for (const [id, entry] of map) {
      if (alive.has(id)) continue;
      URL.revokeObjectURL(entry.url);
      map.delete(id);
    }
    const next: Record<string, string> = {};
    for (const garment of garments) {
      const prev = map.get(garment.id);
      if (!prev || prev.blob !== garment.image) {
        if (prev) URL.revokeObjectURL(prev.url);
        const url = URL.createObjectURL(garment.image);
        map.set(garment.id, { blob: garment.image, url });
      }
      next[garment.id] = map.get(garment.id)!.url;
    }
    setUrls(next);
  }, [garments]);

  useEffect(() => {
    const map = urlsRef.current;
    return () => {
      for (const entry of map.values()) URL.revokeObjectURL(entry.url);
      map.clear();
      window.clearTimeout(toastTimer.current);
    };
  }, []);

  const addGarment = useCallback(async (input: Omit<Garment, "id" | "createdAt">) => {
    const garment: Garment = { ...input, id: crypto.randomUUID(), createdAt: Date.now() };
    await saveGarment(garment);
    setGarments((prev) => sortGarments([garment, ...prev]));
    return garment;
  }, []);

  const updateGarment = useCallback(async (garment: Garment) => {
    await saveGarment(garment);
    setGarments((prev) => sortGarments(prev.map((item) => (item.id === garment.id ? garment : item))));
  }, []);

  const removeGarment = useCallback(
    async (id: string) => {
      await deleteGarment(id);
      const removedOutfitIds: string[] = [];
      for (const outfit of outfits) {
        if (!outfit.garmentIds.includes(id)) continue;
        const garmentIds = outfit.garmentIds.filter((item) => item !== id);
        if (garmentIds.length === 0) {
          await deleteOutfit(outfit.id);
          removedOutfitIds.push(outfit.id);
        } else {
          await saveOutfit({ ...outfit, garmentIds });
        }
      }
      for (const day of days) {
        if (removedOutfitIds.includes(day.outfitId)) await deleteDay(day.date);
      }
      setGarments((prev) => prev.filter((item) => item.id !== id));
      setSelection((prev) => prev.filter((item) => item !== id));
      setOutfits((prev) =>
        prev
          .map((outfit) => ({ ...outfit, garmentIds: outfit.garmentIds.filter((item) => item !== id) }))
          .filter((outfit) => outfit.garmentIds.length > 0),
      );
      setDays((prev) => prev.filter((day) => !removedOutfitIds.includes(day.outfitId)));
    },
    [outfits, days],
  );

  const addOutfit = useCallback(async (input: Omit<Outfit, "id" | "createdAt">) => {
    const outfit: Outfit = { ...input, id: crypto.randomUUID(), createdAt: Date.now() };
    await saveOutfit(outfit);
    setOutfits((prev) => [outfit, ...prev]);
    return outfit;
  }, []);

  const removeOutfit = useCallback(async (id: string) => {
    await deleteOutfit(id);
    setOutfits((prev) => prev.filter((outfit) => outfit.id !== id));
    const affected = days.filter((day) => day.outfitId === id);
    for (const day of affected) await deleteDay(day.date);
    setDays((prev) => prev.filter((day) => day.outfitId !== id));
  }, [days]);

  const planDay = useCallback(async (date: string, outfitId: string) => {
    const day = { date, outfitId };
    await saveDay(day);
    setDays((prev) => [...prev.filter((item) => item.date !== date), day]);
  }, []);

  const clearDay = useCallback(async (date: string) => {
    await deleteDay(date);
    setDays((prev) => prev.filter((item) => item.date !== date));
  }, []);

  const updateSettings = useCallback((next: AiSettings) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  const clearSamples = useCallback(async () => {
    const sampleIds = new Set(garments.filter((garment) => garment.sample).map((garment) => garment.id));
    for (const id of sampleIds) await deleteGarment(id);
    const removedOutfitIds: string[] = [];
    for (const outfit of outfits) {
      if (!outfit.garmentIds.some((id) => sampleIds.has(id))) continue;
      const garmentIds = outfit.garmentIds.filter((id) => !sampleIds.has(id));
      if (garmentIds.length === 0) {
        await deleteOutfit(outfit.id);
        removedOutfitIds.push(outfit.id);
      } else {
        await saveOutfit({ ...outfit, garmentIds });
      }
    }
    for (const day of days) {
      if (removedOutfitIds.includes(day.outfitId)) await deleteDay(day.date);
    }
    setGarments((prev) => prev.filter((garment) => !sampleIds.has(garment.id)));
    setSelection((prev) => prev.filter((id) => !sampleIds.has(id)));
    setOutfits((prev) =>
      prev
        .map((outfit) => ({ ...outfit, garmentIds: outfit.garmentIds.filter((id) => !sampleIds.has(id)) }))
        .filter((outfit) => outfit.garmentIds.length > 0),
    );
    setDays((prev) => prev.filter((day) => !removedOutfitIds.includes(day.outfitId)));
  }, [garments, outfits, days]);

  const value = useMemo<ClosetStore>(
    () => ({
      ready,
      error,
      garments,
      outfits,
      days,
      settings,
      urls,
      selection,
      toast,
      setSelection,
      notify,
      addGarment,
      updateGarment,
      removeGarment,
      addOutfit,
      removeOutfit,
      planDay,
      clearDay,
      updateSettings,
      clearSamples,
    }),
    [
      ready,
      error,
      garments,
      outfits,
      days,
      settings,
      urls,
      selection,
      toast,
      notify,
      addGarment,
      updateGarment,
      removeGarment,
      addOutfit,
      removeOutfit,
      planDay,
      clearDay,
      updateSettings,
      clearSamples,
    ],
  );

  return <ClosetContext.Provider value={value}>{children}</ClosetContext.Provider>;
}

export function useCloset(): ClosetStore {
  const store = useContext(ClosetContext);
  if (!store) throw new Error("useCloset must be used inside ClosetProvider");
  return store;
}

function sortGarments(garments: Garment[]): Garment[] {
  return [...garments].sort((a, b) => b.createdAt - a.createdAt);
}
