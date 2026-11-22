import { useEffect, useRef, useState } from "react";
import type { Category } from "../types";
import { categoryLabel } from "../types";
import { colorName } from "../lib/color";
import { tagGarment } from "../lib/ai";
import { cutoutFromRaster, fileToRaster, rasterToDataUrl, rasterToJpeg, rasterToPng, type Cutout } from "../lib/image";
import type { Raster } from "../lib/background";
import { STUDIO_SHOTS } from "../lib/samples";
import { useCloset } from "../store";
import { CategoryChips, Swatches } from "./bits";
import { NameComposer } from "./NameComposer";

export type Draft = {
  name: string;
  category: Category;
  note: string;
  colors: string[];
  image: Blob;
  original: Blob;
};

type Refine = {
  original: Blob;
  name: string;
  category: Category;
  note: string;
};

const SINGULAR: Record<Category, string> = {
  top: "top",
  bottom: "bottom",
  dress: "dress",
  outerwear: "layer",
  shoes: "shoes",
  bag: "bag",
  accessory: "accessory",
  other: "piece",
};

export function Studio({
  file,
  refine,
  onClose,
  onSave,
}: {
  file: File | null;
  refine: Refine | null;
  onClose: () => void;
  onSave: (draft: Draft) => Promise<void>;
}) {
  const { settings } = useCloset();
  const [phase, setPhase] = useState<"pick" | "camera" | "working" | "review">(file || refine ? "working" : "pick");
  const [error, setError] = useState("");
  const [raster, setRaster] = useState<Raster | null>(null);
  const [original, setOriginal] = useState<Blob | null>(refine?.original ?? null);
  const [filename, setFilename] = useState(file?.name ?? "");
  const [sensitivity, setSensitivity] = useState(46);
  const [cut, setCut] = useState<Cutout | null>(null);
  const [preview, setPreview] = useState("");
  const [name, setName] = useState(refine?.name ?? "");
  const [category, setCategory] = useState<Category>(refine?.category ?? "top");
  const [note, setNote] = useState(refine?.note ?? "");
  const [nameSource, setNameSource] = useState<"auto" | "user" | "ai">(refine ? "user" : "auto");
  const [categorySource, setCategorySource] = useState<"auto" | "user" | "ai">(refine ? "user" : "auto");
  const [aiLine, setAiLine] = useState("");
  const [saving, setSaving] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const tagged = useRef(false);
  const nameSourceRef = useRef(nameSource);
  const categorySourceRef = useRef(categorySource);
  nameSourceRef.current = nameSource;
  categorySourceRef.current = categorySource;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (file) void develop(file, file.name);
    else if (refine) void develop(refine.original, "");
    return () => stopCamera();
    // The studio is remounted for each session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!raster) return;
    const next = cutoutFromRaster(raster, sensitivity, filename);
    setCut(next);
    if (categorySource === "auto") setCategory(next.category);
    if (nameSource === "auto") setName(autoName(next.colors[0], categorySource === "auto" ? next.category : category));
    let url = "";
    let cancelled = false;
    void rasterToPng(next.removed).then((blob) => {
      if (cancelled) return;
      url = URL.createObjectURL(blob);
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return url;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [raster, sensitivity, filename, nameSource, categorySource, category]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function develop(blob: Blob, nextName: string) {
    setPhase("working");
    setError("");
    setFilename(nextName);
    try {
      const nextRaster = await fileToRaster(blob, 1100);
      const jpeg = await rasterToJpeg(nextRaster, 0.86);
      setRaster(nextRaster);
      setOriginal(jpeg);
      setPhase("review");
      if (settings.apiKey && settings.tagOnAdd && !tagged.current && !refine) {
        tagged.current = true;
        void askModel(nextRaster);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The photo could not be read.");
      setPhase("pick");
    }
  }

  async function askModel(source: Raster) {
    setAiLine("Reading the piece…");
    try {
      const first = cutoutFromRaster(source, sensitivity, filename);
      const dataUrl = await rasterToDataUrl(first.removed, 512);
      const tag = await tagGarment(settings, dataUrl);
      setName((current) => (nameSourceRef.current === "user" ? current : tag.name));
      setNameSource((current) => (current === "user" ? current : "ai"));
      setCategory((current) => (categorySourceRef.current === "user" ? current : tag.category));
      setCategorySource((current) => (current === "user" ? current : "ai"));
      if (tag.note) setNote((current) => current || tag.note);
      setAiLine("Named with your model. Change anything before saving.");
    } catch (reason) {
      setAiLine(reason instanceof Error ? reason.message : "The model could not read this piece.");
    }
  }

  async function startCamera() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser has no camera. Upload a photo instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setPhase("camera");
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setError("Camera permission was blocked. You can still upload a photo.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function shutter() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1200;
    canvas.height = video.videoHeight || 1600;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    stopCamera();
    canvas.toBlob((blob) => {
      if (blob) void develop(blob, "");
    }, "image/jpeg", 0.92);
  }

  async function useShot(src: string) {
    setPhase("working");
    setError("");
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error("The studio photo is missing.");
      const blob = await response.blob();
      await develop(blob, "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not open that studio photo.");
      setPhase("pick");
    }
  }

  async function save() {
    if (!cut || !original) return;
    setSaving(true);
    try {
      const image = await rasterToPng(cut.removed);
      await onSave({
        name: name.trim() || autoName(cut.colors[0], category),
        category,
        note: note.trim(),
        colors: cut.colors,
        image,
        original,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save this piece.");
      setSaving(false);
    }
  }

  return (
    <div className="studio" role="dialog" aria-modal="true" aria-labelledby="studio-title">
      <header className="studio-bar">
        <div>
          <p className="kicker">{refine ? "Refine" : "New piece"}</p>
          <h2 id="studio-title">{phase === "review" ? name || "Untitled piece" : "Photograph a piece"}</h2>
        </div>
        <button type="button" className="btn ghost" onClick={onClose}>
          Close
        </button>
      </header>

      {phase === "camera" ? (
        <div className="camera">
          <video ref={videoRef} playsInline muted autoPlay />
          <div className="camera-controls">
            <button type="button" className="btn ghost" onClick={() => { stopCamera(); setPhase("pick"); }}>
              Back
            </button>
            <button type="button" className="shutter" onClick={shutter} aria-label="Take photo" />
          </div>
        </div>
      ) : phase === "working" ? (
        <div className="working">
          <div className="sweep" />
          <p>Lifting the background…</p>
        </div>
      ) : phase === "review" && cut ? (
        <div className="studio-body">
          <div className="floor stage-preview">
            {preview && <img src={preview} alt="Cutout of the piece" />}
          </div>
          <div className="studio-form">
            <label className="field">
              <span>Name</span>
              <input
                value={name}
                onChange={(event) => {
                  setNameSource("user");
                  setName(event.target.value);
                }}
              />
            </label>
            <div className="field">
              <span>Category</span>
              <CategoryChips
                value={category}
                includeOther
                onChange={(next) => {
                  setCategorySource("user");
                  setCategory(next);
                }}
              />
              <p className="hint">{aiLine || cut.reason}</p>
            </div>
            <label className="field">
              <span>Background reach · {sensitivity}</span>
              <input
                type="range"
                min={8}
                max={90}
                value={sensitivity}
                onChange={(event) => setSensitivity(Number(event.target.value))}
              />
              <p className="hint">Higher reaches into shadows. Lower if a light garment starts to disappear.</p>
            </label>
            <div className="field">
              <span>Colors found</span>
              <div className="color-row">
                <Swatches colors={cut.colors} />
                <p>{cut.colors.map((color) => colorName(color)).join(" · ") || "No strong color yet"}</p>
              </div>
            </div>
            <label className="field">
              <span>Note</span>
              <textarea value={note} rows={3} onChange={(event) => setNote(event.target.value)} placeholder="Fabric, fit, when you wear it" />
            </label>
            {error && <p className="error">{error}</p>}
            <button type="button" className="btn primary wide" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : refine ? "Update cutout" : `Add to ${categoryLabel(category).toLowerCase()}`}
            </button>
          </div>
        </div>
      ) : (
        <div className="picker">
          <div
            className="drop"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const next = [...event.dataTransfer.files].find((item) => item.type.startsWith("image/"));
              if (next) void develop(next, next.name);
            }}
          >
            <p className="kicker">Plain background</p>
            <h3>A wall, a sheet, or the floor.</h3>
            <p>The cutout follows the backdrop in from the edges, so a busy room will leave more behind. You can pull the reach slider after.</p>
            <div className="row">
              <button type="button" className="btn primary" onClick={() => void startCamera()}>
                Take a photo
              </button>
              <label className="btn">
                Upload
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => {
                    const next = event.target.files?.[0];
                    if (next) void develop(next, next.name);
                  }}
                />
              </label>
            </div>
            {error && <p className="error">{error}</p>}
          </div>
          <NameComposer onAdded={onClose} />
          <div className="shots">
            <p className="kicker">Or develop a studio photo</p>
            <div className="shot-row">
              {STUDIO_SHOTS.map((shot) => (
                <button key={shot.src} type="button" className="shot" onClick={() => void useShot(shot.src)}>
                  <img src={shot.src} alt="" />
                  <span>{shot.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function autoName(color: string | undefined, category: Category): string {
  const tone = color ? colorName(color) : "New";
  return `${tone} ${SINGULAR[category]}`;
}
