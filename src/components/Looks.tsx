import { useMemo, useState } from "react";
import { useCloset } from "../store";
import { todayKey } from "../lib/dates";
import { go } from "../nav";
import { colorPairings, recommendLooks, type ColorPair } from "../lib/stylist";
import { styleAdvice, type StyledOutfit } from "../lib/ai";
import { Score, Swatches } from "./bits";
import type { Look } from "../types";

export function Looks() {
  const { garments, urls, outfits, addOutfit, planDay, setSelection, settings, notify } = useCloset();
  const looks = useMemo(() => recommendLooks(garments, 6), [garments]);
  const pairs = useMemo(() => colorPairings(garments, 4), [garments]);
  const [asking, setAsking] = useState(false);
  const [intro, setIntro] = useState("");
  const [aiLooks, setAiLooks] = useState<StyledOutfit[]>([]);
  const [aiError, setAiError] = useState("");

  async function ensureOutfit(look: { title: string; garmentIds: string[]; why: string }) {
    const existing = outfits.find((outfit) => sameSet(outfit.garmentIds, look.garmentIds));
    if (existing) return existing;
    return addOutfit({ name: look.title, garmentIds: look.garmentIds, note: look.why });
  }

  async function plan(look: { title: string; garmentIds: string[]; why: string }) {
    const outfit = await ensureOutfit(look);
    await planDay(todayKey(), outfit.id);
    notify(`${outfit.name} is on today.`);
    go("calendar");
  }

  async function ask() {
    setAsking(true);
    setAiError("");
    try {
      const advice = await styleAdvice(
        settings,
        garments.map((garment) => ({
          id: garment.id,
          name: garment.name,
          category: garment.category,
          colors: garment.colors,
        })),
        looks.map((look) => ({ title: look.title, ids: look.garmentIds, why: look.why })),
      );
      setIntro(advice.intro);
      setAiLooks(advice.outfits);
      if (!advice.intro && advice.outfits.length === 0) {
        setAiError("The model replied, but not with outfits made from this closet.");
      }
    } catch (reason) {
      setAiError(reason instanceof Error ? reason.message : "The stylist could not answer.");
    } finally {
      setAsking(false);
    }
  }

  return (
    <section className="page">
      <header className="page-head">
        <p className="kicker">Looks</p>
        <h1 className="display">Outfits already in the closet.</h1>
        <p className="lede">
          These are built only from pieces you have. Neutrals carry color, neighbors on the wheel stay related, and loud pairs are marked bold.
        </p>
      </header>

      {looks.length === 0 ? (
        <div className="empty">
          <h2>Not enough pieces yet</h2>
          <p>A look needs a top and a bottom, or a dress. Add those and suggestions appear here.</p>
          <button type="button" className="btn primary" onClick={() => go("closet")}>
            Back to the closet
          </button>
        </div>
      ) : (
        <div className="looks">
          {looks.map((look) => (
            <LookCard
              key={look.id}
              look={look}
              urls={urls}
              names={namesFor(look.garmentIds, garmentsById(garments))}
              onBuild={() => {
                setSelection(look.garmentIds);
                go("builder");
              }}
              onPlan={() => void plan({ title: look.title, garmentIds: look.garmentIds, why: look.why })}
            />
          ))}
        </div>
      )}

      <section className="pairings">
        <div className="section-head">
          <p className="kicker">Color</p>
          <h2>Colors that agree</h2>
        </div>
        {pairs.length === 0 ? (
          <p className="hint">Add pieces in different categories to see which colors belong together.</p>
        ) : (
          <div className="pair-grid">
            {pairs.map((pair) => (
              <PairCard key={`${pair.leftId}-${pair.rightId}`} pair={pair} garments={garments} urls={urls} />
            ))}
          </div>
        )}
      </section>

      <section className="ai-panel">
        <div>
          <p className="kicker">Optional model</p>
          <h2>Ask a stylist</h2>
          <p>
            The pairings above run on this device. If you add a key, a model can rewrite the advice in its own words, still using only your pieces.
          </p>
        </div>
        {settings.apiKey ? (
          <button type="button" className="btn primary" disabled={asking || garments.length < 2} onClick={() => void ask()}>
            {asking ? "Asking…" : "Ask your stylist"}
          </button>
        ) : (
          <button type="button" className="btn" onClick={() => window.dispatchEvent(new CustomEvent("atelier-settings"))}>
            Add an API key
          </button>
        )}
        {intro && <p className="ai-intro">{intro}</p>}
        {aiError && <p className="error">{aiError}</p>}
        {aiLooks.length > 0 && (
          <div className="looks">
            {aiLooks.map((look) => (
              <LookCard
                key={look.ids.join("-")}
                look={{ id: look.ids.join("-"), title: look.title, why: look.why, garmentIds: look.ids, score: 0.8, palette: [] }}
                urls={urls}
                names={namesFor(look.ids, garmentsById(garments))}
                onBuild={() => {
                  setSelection(look.ids);
                  go("builder");
                }}
                onPlan={() => void plan({ title: look.title, garmentIds: look.ids, why: look.why })}
              />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function LookCard({
  look,
  urls,
  names,
  onBuild,
  onPlan,
}: {
  look: Look;
  urls: Record<string, string>;
  names: string[];
  onBuild: () => void;
  onPlan: () => void;
}) {
  return (
    <article className="look">
      <div className="look-figures">
        {look.garmentIds.map((id) => urls[id] && <img key={id} src={urls[id]} alt="" />)}
      </div>
      <div className="look-copy">
        <div className="stage-title">
          <h3>{look.title}</h3>
          {look.score > 0 && <Score value={look.score} />}
        </div>
        <p>{look.why}</p>
        <p className="hint">{names.join(" · ")}</p>
        {look.palette.length > 0 && <Swatches colors={look.palette} />}
        <div className="row">
          <button type="button" className="btn primary" onClick={onPlan}>
            Wear today
          </button>
          <button type="button" className="btn" onClick={onBuild}>
            Edit in builder
          </button>
        </div>
      </div>
    </article>
  );
}

function PairCard({
  pair,
  garments,
  urls,
}: {
  pair: ColorPair;
  garments: { id: string; name: string; colors: string[] }[];
  urls: Record<string, string>;
}) {
  const left = garments.find((garment) => garment.id === pair.leftId);
  const right = garments.find((garment) => garment.id === pair.rightId);
  if (!left || !right) return null;
  return (
    <article className="pair">
      <div className="pair-visual">
        {urls[left.id] && <img src={urls[left.id]} alt="" />}
        {urls[right.id] && <img src={urls[right.id]} alt="" />}
      </div>
      <div className="pair-colors">
        <span style={{ background: left.colors[0] }} />
        <span style={{ background: right.colors[0] }} />
      </div>
      <p>{pair.sentence}</p>
    </article>
  );
}

function garmentsById(garments: { id: string; name: string }[]) {
  return new Map(garments.map((garment) => [garment.id, garment.name]));
}

function namesFor(ids: string[], names: Map<string, string>): string[] {
  return ids.map((id) => names.get(id)).filter((name): name is string => !!name);
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const other = new Set(b);
  return a.every((id) => other.has(id));
}
