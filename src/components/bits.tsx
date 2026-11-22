import type { Category, Garment } from "../types";
import { CATEGORIES, categoryLabel } from "../types";
import { colorName } from "../lib/color";

export function Swatches({ colors, label }: { colors: string[]; label?: string }) {
  if (colors.length === 0) return null;
  return (
    <span className="swatches" aria-label={label ?? "Colors"}>
      {colors.map((color) => (
        <span key={color} className="swatch" style={{ background: color }} title={colorName(color)} />
      ))}
    </span>
  );
}

export function CategoryChips({
  value,
  onChange,
  includeOther = false,
}: {
  value: Category | "all" | null;
  onChange: (category: Category) => void;
  includeOther?: boolean;
}) {
  const categories = includeOther ? CATEGORIES : CATEGORIES.filter((category) => category.id !== "other");
  return (
    <div className="chips" role="group" aria-label="Category">
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          className={value === category.id ? "chip active" : "chip"}
          aria-pressed={value === category.id}
          onClick={() => onChange(category.id)}
        >
          {category.label}
        </button>
      ))}
    </div>
  );
}

export function PieceFigure({ garment, url, className }: { garment: Garment; url?: string; className?: string }) {
  return (
    <span className={className ?? "figure"}>
      {url ? <img src={url} alt="" /> : <span className="figure-fallback">{categoryLabel(garment.category)}</span>}
    </span>
  );
}

export function Score({ value }: { value: number }) {
  const tone = value >= 0.78 ? "Easy" : value >= 0.62 ? "Works" : "Bold";
  return <span className={`score score-${tone.toLowerCase()}`}>{tone}</span>;
}
