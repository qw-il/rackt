import { useMemo, useState } from "react";
import { useCloset } from "../store";
import type { Category, Garment } from "../types";
import { categoryLabel } from "../types";
import { todayKey, prettyDate } from "../lib/dates";
import { go } from "../nav";
import { colorName } from "../lib/color";
import { recommendLooks } from "../lib/stylist";
import { Swatches } from "./bits";
import { NameComposer } from "./NameComposer";

const FILTERS: { id: Category | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "top", label: "Tops" },
  { id: "bottom", label: "Bottoms" },
  { id: "dress", label: "Dresses" },
  { id: "outerwear", label: "Outerwear" },
  { id: "shoes", label: "Shoes" },
  { id: "bag", label: "Bags" },
  { id: "accessory", label: "Accessories" },
];

export function Closet({ onOpen, onAdd }: { onOpen: (id: string) => void; onAdd: () => void }) {
  const { garments, urls, outfits, days } = useCloset();
  const [filter, setFilter] = useState<Category | "all">("all");
  const [color, setColor] = useState<string | null>(null);
  const samples = garments.some((garment) => garment.sample);
  const filters = garments.some((garment) => garment.category === "other")
    ? [...FILTERS, { id: "other" as const, label: "Other" }]
    : FILTERS;
  const visible = garments.filter((garment) => {
    if (filter !== "all" && garment.category !== filter) return false;
    if (color && !garment.colors.some((item) => item === color)) return false;
    return true;
  });
  const palette = useMemo(() => collectPalette(garments), [garments]);
  const today = todayKey();
  const plan = days.find((day) => day.date === today);
  const planned = plan ? outfits.find((outfit) => outfit.id === plan.outfitId) : undefined;
  const suggestion = !planned ? recommendLooks(garments, 1)[0] : undefined;

  return (
    <section className="page">
      <header className="page-head">
        <p className="kicker">Closet</p>
        <h1 className="display">The clothes you actually own.</h1>
        <p className="lede">
          {garments.length === 0
            ? "Type a name, or photograph a piece on a plain wall. Either one lands in the closet."
            : `${garments.length} ${garments.length === 1 ? "piece" : "pieces"} on this device${samples ? ", including studio stand-ins" : ""}.`}
        </p>
      </header>

      <div className="today-band">
        <div>
          <p className="kicker">Today · {prettyDate(today)}</p>
          {planned ? (
            <>
              <h2>{planned.name}</h2>
              <p>{planned.note || "Planned from your closet."}</p>
            </>
          ) : suggestion ? (
            <>
              <h2>{suggestion.title}</h2>
              <p>{suggestion.why}</p>
            </>
          ) : (
            <>
              <h2>Nothing planned</h2>
              <p>Add a couple of pieces and a look will land here.</p>
            </>
          )}
        </div>
        <div className="today-actions">
          {planned ? (
            <button type="button" className="btn" onClick={() => go("calendar")}>
              Open the calendar
            </button>
          ) : (
            <button type="button" className="btn" onClick={() => go("looks")}>
              See looks you can make
            </button>
          )}
          <button type="button" className="btn primary" onClick={onAdd}>
            Add a piece
          </button>
        </div>
      </div>

      <NameComposer />

      {samples && (
        <div className="banner">
          <p>
            The illustrated pieces are a studio set, so the builder and calendar work before you take a photo. Your photographs stay in this browser.
          </p>
        </div>
      )}

      <div className="toolbar">
        <div className="chips" role="tablist" aria-label="Filter by category">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              className={filter === item.id ? "chip active" : "chip"}
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {palette.length > 0 && (
          <div className="color-filter" aria-label="Filter by color">
            <button type="button" className={!color ? "swatch-btn swatch-text active" : "swatch-btn swatch-text"} onClick={() => setColor(null)} aria-pressed={!color}>
              Any
            </button>
            {palette.map((swatch) => (
              <button
                key={swatch}
                type="button"
                className={color === swatch ? "swatch-btn active" : "swatch-btn"}
                style={{ background: swatch }}
                aria-label={colorName(swatch)}
                aria-pressed={color === swatch}
                onClick={() => setColor((current) => (current === swatch ? null : swatch))}
              />
            ))}
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="empty">
          <h2>{garments.length === 0 ? "Your closet is empty" : "Nothing in this filter"}</h2>
          <p>{garments.length === 0 ? "Use a plain background. A wall, a bedsheet, or the floor is enough." : "Clear the filter or add a piece in this category."}</p>
          <button type="button" className="btn primary" onClick={onAdd}>
            Photograph a piece
          </button>
        </div>
      ) : (
        <div className="grid">
          {visible.map((garment, index) => (
            <article key={garment.id} className="piece" style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}>
              <button type="button" className="piece-hit" onClick={() => onOpen(garment.id)}>
                <span className="piece-media">
                  {urls[garment.id] && <img src={urls[garment.id]} alt="" />}
                </span>
                <span className="piece-copy">
                  <span className="piece-name">{garment.name}</span>
                  <span className="piece-cat">{categoryLabel(garment.category)}</span>
                </span>
                <Swatches colors={garment.colors.slice(0, 3)} />
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function collectPalette(garments: Garment[]): string[] {
  const seen: string[] = [];
  for (const garment of garments) {
    const color = garment.colors[0];
    if (!color || seen.includes(color)) continue;
    seen.push(color);
    if (seen.length >= 8) break;
  }
  return seen;
}
