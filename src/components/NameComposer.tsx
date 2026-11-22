import { useEffect, useRef, useState } from "react";
import { useCloset } from "../store";
import type { Category } from "../types";
import { categoryLabel } from "../types";
import { identifyNamedPiece } from "../lib/ai";
import { namedGarment, PIECE_COLORS, presentName, readNamedPiece } from "../lib/namedPiece";
import { findPiecePhoto, type PiecePhoto } from "../lib/webImage";
import { CategoryChips } from "./bits";

export function NameComposer({ onAdded }: { onAdded?: () => void }) {
  const { addGarment, notify, settings } = useCloset();
  const [text, setText] = useState("");
  const [categoryPick, setCategoryPick] = useState<Category | null>(null);
  const [colorPick, setColorPick] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [photo, setPhoto] = useState<PiecePhoto | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [looking, setLooking] = useState(false);
  const [miss, setMiss] = useState(false);
  const request = useRef(0);
  const pending = useRef<Promise<PiecePhoto | null> | null>(null);
  const guess = readNamedPiece(text);
  const typed = presentName(text);
  const category = categoryPick ?? (typed ? guess.category : null);
  const color = colorPick ?? guess.color;
  const swatches = PIECE_COLORS.some((swatch) => swatch.hex === color)
    ? PIECE_COLORS
    : [{ name: "Suggested", hex: color }, ...PIECE_COLORS];
  const preview = photoUrl;

  useEffect(() => {
    if (!photo) {
      setPhotoUrl("");
      return;
    }
    const url = URL.createObjectURL(photo.blob);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  useEffect(() => {
    setPhoto(null);
    setMiss(false);
    if (typed.trim().length < 3 || !category) {
      setLooking(false);
      pending.current = null;
      return;
    }
    const id = ++request.current;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (controller.signal.aborted) return;
      setLooking(true);
      const job = findPiecePhoto(typed, category, controller.signal).catch(() => null);
      pending.current = job;
      void job.then((found) => {
        if (request.current !== id || controller.signal.aborted) return;
        setPhoto(found);
        setMiss(!found);
        setLooking(false);
        pending.current = null;
      });
    }, 450);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [typed, category]);

  async function identify() {
    if (!typed || !category) return;
    setReading(true);
    setMessage("");
    try {
      const found = await identifyNamedPiece(settings, typed);
      setCategoryPick(found.category);
      setColorPick(found.color);
      setNote(found.note);
      setMessage(found.note || "The model suggested a category and a color.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "The model could not read that name.");
    } finally {
      setReading(false);
    }
  }

  async function add() {
    if (!typed || !category) return;
    setSaving(true);
    try {
      let found = photo;
      if (!found?.blob && pending.current) {
        setLooking(true);
        found = await pending.current;
        setPhoto(found);
        setLooking(false);
      }
      if (!found?.blob) {
        setMiss(true);
        setMessage("No online photo for that name.");
        return;
      }
      const colors = colorPick ? [color] : found.colors.length ? found.colors : [color];
      const garment = await addGarment(
        namedGarment(text, category, color, note || `Photo from ${found.host}.`, found.blob, colors),
      );
      notify(`Added ${garment.name} to ${categoryLabel(garment.category).toLowerCase()}.`);
      setText("");
      setCategoryPick(null);
      setColorPick(null);
      setNote("");
      setMessage("");
      setPhoto(null);
      setMiss(false);
      pending.current = null;
      onAdded?.();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not add that piece.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className={preview ? "composer has-preview" : "composer"}
      onSubmit={(event) => {
        event.preventDefault();
        void add();
      }}
    >
      {preview && (
        <div className="composer-preview">
          <img src={preview} alt="" />
        </div>
      )}
      <div>
        <p className="kicker">Type a piece</p>
        <h2>Add something you own by name.</h2>
        <label className="field">
          <span>Name</span>
          <input
            value={text}
            placeholder="Knickerbocker Catskills"
            aria-label="Piece name"
            onChange={(event) => {
              setText(event.target.value);
              setCategoryPick(null);
              setColorPick(null);
              setNote("");
              setMessage("");
              setPhoto(null);
              setMiss(false);
            }}
          />
        </label>
        <div className="field">
          <span>Category</span>
          <CategoryChips
            value={category}
            includeOther
            onChange={(next) => {
              setCategoryPick(next);
              setMessage("");
            }}
          />
          <p className="hint">
            {looking
              ? "Looking up an online photo."
              : photo
                ? `Photo from ${photo.host}. ${categoryPick ? `Saving as ${categoryLabel(categoryPick).toLowerCase()}.` : guess.reason}`
                : miss
                  ? "No online photo for that name. Try a more specific one."
                  : "Only an online photo can be added. A word like jacket or loafer also files the category."}
          </p>
        </div>
        <div className="field">
          <span>Color</span>
          <div className="color-filter" role="group" aria-label="Piece color">
            {swatches.map((swatch) => (
              <button
                key={swatch.hex}
                type="button"
                className={color === swatch.hex ? "swatch-btn active" : "swatch-btn"}
                style={{ background: swatch.hex }}
                aria-label={swatch.name}
                aria-pressed={color === swatch.hex}
                onClick={() => setColorPick(swatch.hex)}
              />
            ))}
          </div>
        </div>
        <div className="row">
          <button type="submit" className="btn primary" disabled={!photo || looking || saving}>
            {looking ? "Looking up a photo…" : saving ? "Adding…" : "Add to wardrobe"}
          </button>
          {settings.apiKey && (
            <button type="button" className="btn" disabled={!typed || reading} onClick={() => void identify()}>
              {reading ? "Reading the name…" : "Ask the model"}
            </button>
          )}
        </div>
        {message && <p className="hint">{message}</p>}
      </div>
    </form>
  );
}
