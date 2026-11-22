import { useEffect, useState } from "react";
import { useCloset } from "../store";
import type { Category } from "../types";
import { categoryLabel } from "../types";
import { prettyDate } from "../lib/dates";
import { colorName } from "../lib/color";
import { CategoryChips, Swatches } from "./bits";

export function PieceDetail({
  id,
  onClose,
  onRefine,
}: {
  id: string;
  onClose: () => void;
  onRefine: (id: string) => void;
}) {
  const { garments, outfits, days, urls, updateGarment, removeGarment } = useCloset();
  const garment = garments.find((item) => item.id === id);
  const [name, setName] = useState(garment?.name ?? "");
  const [note, setNote] = useState(garment?.note ?? "");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setName(garment?.name ?? "");
    setNote(garment?.note ?? "");
    setConfirming(false);
  }, [garment?.id, garment?.name, garment?.note]);

  if (!garment) return null;

  const worn = days
    .filter((day) => outfits.find((outfit) => outfit.id === day.outfitId)?.garmentIds.includes(garment.id))
    .map((day) => day.date)
    .sort();

  async function saveText(nextName: string, nextNote: string) {
    const trimmed = nextName.trim() || garment!.name;
    if (trimmed === garment!.name && nextNote === garment!.note) return;
    await updateGarment({ ...garment!, name: trimmed, note: nextNote });
  }

  async function setCategory(category: Category) {
    if (category === garment!.category) return;
    await updateGarment({ ...garment!, category });
  }

  return (
    <div className="drawer-root">
      <button type="button" className="scrim" aria-label="Close piece" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="piece-title">
        <header className="drawer-bar">
          <div>
            <p className="kicker">{categoryLabel(garment.category)}</p>
            <h2 id="piece-title">{garment.name}</h2>
          </div>
          <button type="button" className="btn ghost" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="floor detail-photo">{urls[garment.id] && <img src={urls[garment.id]} alt={garment.name} />}</div>
        <label className="field">
          <span>Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => void saveText(name, note)}
          />
        </label>
        <div className="field">
          <span>Category</span>
          <CategoryChips value={garment.category} includeOther onChange={(category) => void setCategory(category)} />
        </div>
        <div className="field">
          <span>Colors</span>
          <div className="color-row">
            <Swatches colors={garment.colors} />
            <p>{garment.colors.map((color) => colorName(color)).join(" · ")}</p>
          </div>
        </div>
        <label className="field">
          <span>Note</span>
          <textarea
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onBlur={() => void saveText(name, note)}
          />
        </label>
        {worn.length > 0 && (
          <div className="field">
            <span>On the calendar</span>
            <p>{worn.map((date) => prettyDate(date)).join(" · ")}</p>
          </div>
        )}
        <div className="row">
          {garment.original && (
            <button type="button" className="btn" onClick={() => onRefine(garment.id)}>
              Refine cutout
            </button>
          )}
          {!confirming ? (
            <button type="button" className="btn ghost" onClick={() => setConfirming(true)}>
              Remove
            </button>
          ) : (
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                void removeGarment(garment.id).then(onClose);
              }}
            >
              Remove for good
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
