import { useEffect, useMemo, useState } from "react";
import { useCloset } from "../store";
import type { Garment } from "../types";
import { CATEGORIES } from "../types";
import { describeSelection, orderPieces } from "../lib/stylist";
import { Score, Swatches } from "./bits";

const SLOTS = CATEGORIES.filter((category) => category.id !== "other");

export function Builder() {
  const { garments, urls, outfits, selection, setSelection, addOutfit, notify } = useCloset();
  const [name, setName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const selected = useMemo(
    () => orderPieces(garments.filter((garment) => selection.includes(garment.id))),
    [garments, selection],
  );
  const described = useMemo(() => describeSelection(selected), [selected]);

  useEffect(() => {
    if (!nameEdited) setName(selected.length ? described.title : "");
  }, [described.title, nameEdited, selected.length]);

  function toggle(garment: Garment) {
    setSelection(toggleSelection(selection, garment, garments));
    setNameEdited(false);
  }

  async function save() {
    if (selected.length < 2) return;
    setSaving(true);
    try {
      const outfit = await addOutfit({
        name: name.trim() || described.title,
        garmentIds: selected.map((garment) => garment.id),
        note: described.why,
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
        <p className="lede">One piece per category, two accessories. The note updates as the colors change.</p>
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
              <h2>{described.title}</h2>
              {selected.length > 1 && <Score value={described.score} />}
            </div>
            <p>{described.why}</p>
            <Swatches colors={described.palette} />
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
