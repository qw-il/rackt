import { useEffect, useMemo, useState } from "react";
import { useCloset } from "../store";
import type { Garment } from "../types";
import { CATEGORIES } from "../types";
import { orderPieces } from "../lib/stylist";
import type { OutfitReview } from "../types";
import { rateOutfit } from "../lib/ai";
import { ProsCons, ScoreMeter, Swatches } from "./bits";

const SLOTS = CATEGORIES.filter((category) => category.id !== "other");

export function Builder() {
  const { garments, urls, outfits, selection, setSelection, addOutfit, settings, notify } = useCloset();
  const [name, setName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rating, setRating] = useState(false);
  const [review, setReview] = useState<OutfitReview | null>(null);
  const [rateError, setRateError] = useState("");
  const selected = useMemo(
    () => orderPieces(garments.filter((garment) => selection.includes(garment.id))),
    [garments, selection],
  );
  const palette = useMemo(() => {
    const colors: string[] = [];
    for (const garment of selected) {
      for (const color of garment.colors) {
        if (!colors.includes(color)) colors.push(color);
      }
    }
    return colors.slice(0, 5);
  }, [selected]);

  useEffect(() => {
    if (!nameEdited) setName(selected.length ? selected.slice(0, 2).map((garment) => garment.name).join(" & ") : "");
  }, [nameEdited, selected]);

  function toggle(garment: Garment) {
    setSelection(toggleSelection(selection, garment, garments));
    setNameEdited(false);
    setReview(null);
    setRateError("");
  }

  async function rate() {
    if (!settings.apiKey) {
      window.dispatchEvent(new CustomEvent("atelier-settings"));
      return;
    }
    if (selected.length < 2) return;
    setRating(true);
    setRateError("");
    try {
      const result = await rateOutfit(
        settings,
        selected.map((garment) => ({
          id: garment.id,
          name: garment.name,
          category: garment.category,
          colors: garment.colors,
        })),
      );
      setReview(result.review);
      if (!nameEdited) setName(result.title);
    } catch (reason) {
      setRateError(reason instanceof Error ? reason.message : "The model could not rate this outfit.");
    } finally {
      setRating(false);
    }
  }

  async function save() {
    if (selected.length < 2) return;
    setSaving(true);
    try {
      const outfit = await addOutfit({
        name: name.trim() || "Untitled look",
        garmentIds: selected.map((garment) => garment.id),
        note: review?.summary ?? "",
        review: review ?? undefined,
      });
      notify(`Saved ${outfit.name}.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page">
      <header className="page-head">
        <p className="kicker">Builder</p>
        <h1 className="display">Put a look on the board.</h1>
        <p className="lede">One piece per category. The model rates the finished outfit from 1 to 100 and lists pros and cons.</p>
      </header>
      <div className="builder">
        <div className="stage-card">
          <div className="stage" aria-label="Outfit board">
            <div className="body-glow" />
            {selected.map((garment) => (
              <img
                key={garment.id}
                src={urls[garment.id]}
                alt={garment.name}
                className={`placed placed-${garment.category}`}
              />
            ))}
            {selected.length === 0 && <p className="stage-empty">Choose pieces from the rail.</p>}
          </div>
          <div className="stage-copy">
            <div className="stage-title">
              <h2>{name || "Unrated look"}</h2>
              {review && <ScoreMeter score={review.score} />}
            </div>
            <p>{review?.summary || "Rate this combination. Advice comes from the model, not a built-in color chart."}</p>
            <Swatches colors={palette} />
            {review && <ProsCons pros={review.pros} cons={review.cons} />}
            {rateError && <p className="error">{rateError}</p>}
            <label className="field">
              <span>Outfit name</span>
              <input
                value={name}
                placeholder="Name this look"
                onChange={(event) => {
                  setNameEdited(true);
                  setName(event.target.value);
                }}
              />
            </label>
            <div className="row">
              <button type="button" className="btn" disabled={selected.length < 2 || rating} onClick={() => void rate()}>
                {rating ? "Rating…" : settings.apiKey ? "Rate this outfit" : "Add a key to rate"}
              </button>
              <button type="button" className="btn primary" disabled={selected.length < 2 || saving} onClick={() => void save()}>
                {saving ? "Saving…" : "Save outfit"}
              </button>
              <button
                type="button"
                className="btn ghost"
                disabled={selected.length === 0}
                onClick={() => {
                  setSelection([]);
                  setNameEdited(false);
                  setReview(null);
                  setRateError("");
                }}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
        <div className="rail">
          {outfits.length > 0 && (
            <section className="rail-group">
              <h3>Saved</h3>
              <div className="saved-row">
                {outfits.map((outfit) => (
                  <button
                    key={outfit.id}
                    type="button"
                    className="chip"
                    onClick={() => {
                      setSelection(outfit.garmentIds);
                      setName(outfit.name);
                      setNameEdited(true);
                      setReview(outfit.review ?? null);
                      setRateError("");
                    }}
                  >
                    {outfit.name}
                  </button>
                ))}
              </div>
            </section>
          )}
          {SLOTS.map((slot) => {
            const pieces = garments.filter((garment) => garment.category === slot.id);
            if (pieces.length === 0) return null;
            return (
              <section key={slot.id} className="rail-group">
                <h3>{slot.label}</h3>
                <div className="rail-row">
                  {pieces.map((garment) => {
                    const on = selection.includes(garment.id);
                    return (
                      <button
                        key={garment.id}
                        type="button"
                        className={on ? "rail-piece on" : "rail-piece"}
                        aria-pressed={on}
                        onClick={() => toggle(garment)}
                      >
                        <span className="rail-media">{urls[garment.id] && <img src={urls[garment.id]} alt="" />}</span>
                        <span>{garment.name}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {garments.length === 0 && <p className="hint">Add pieces to the closet before building a look.</p>}
        </div>
      </div>
    </section>
  );
}

function toggleSelection(selection: string[], garment: Garment, garments: Garment[]): string[] {
  if (selection.includes(garment.id)) return selection.filter((id) => id !== garment.id);
  if (garment.category === "accessory") {
    const accessories = selection.filter((id) => garments.find((item) => item.id === id)?.category === "accessory");
    const next = [...selection, garment.id];
    if (accessories.length < 2) return next;
    return next.filter((id) => id !== accessories[0]);
  }
  return [...selection.filter((id) => garments.find((item) => item.id === id)?.category !== garment.category), garment.id];
}
