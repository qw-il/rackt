import { useState } from "react";
import { useCloset } from "../store";
import { todayKey } from "../lib/dates";
import { go } from "../nav";
import { styleAdvice, type RatedOutfit } from "../lib/ai";
import { ProsCons, ScoreMeter } from "./bits";
import type { OutfitReview } from "../types";

type CardLook = {
  title: string;
  garmentIds: string[];
  review: OutfitReview;
};

export function Looks() {
  const { garments, urls, outfits, addOutfit, planDay, setSelection, settings, notify } = useCloset();
  const [asking, setAsking] = useState(false);
  const [intro, setIntro] = useState("");
  const [aiLooks, setAiLooks] = useState<RatedOutfit[]>([]);
  const [aiError, setAiError] = useState("");
  const rated = outfits.filter((outfit) => outfit.review);

  async function ensureOutfit(look: CardLook) {
    const existing = outfits.find((outfit) => sameSet(outfit.garmentIds, look.garmentIds));
    if (existing) return existing;
    return addOutfit({
      name: look.title,
      garmentIds: look.garmentIds,
      note: look.review.summary,
      review: look.review,
    });
  }

  async function plan(look: CardLook) {
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
      );
      setIntro(advice.intro);
      setAiLooks(advice.outfits);
      if (advice.outfits.length === 0) {
        setAiError("The model replied, but not with scored outfits made from this closet.");
      }
    } catch (reason) {
      setAiError(reason instanceof Error ? reason.message : "The model could not answer.");
    } finally {
      setAsking(false);
    }
  }

  return (
    <section className="page">
      <header className="page-head">
        <p className="kicker">Looks</p>
        <h1 className="display">Tonight's edit.</h1>
        <p className="lede">Your model scores each outfit from 1 to 100 and writes the pros and cons.</p>
      </header>

      {!settings.apiKey ? (
        <div className="empty">
          <h2>Add a key to get a score</h2>
          <p>Outfit ideas, the 1 to 100 rating, and the pros and cons are written only by the model you choose.</p>
          <button type="button" className="btn primary" onClick={() => window.dispatchEvent(new CustomEvent("atelier-settings"))}>
            Add an API key
          </button>
        </div>
      ) : (
        <div className="ai-panel">
          <div>
            <p className="kicker">Your model</p>
            <h2>Style this closet</h2>
            <p>Three outfits, each with a score and a list of what works and what does not.</p>
          </div>
          <button type="button" className="btn primary" disabled={asking || garments.length < 2} onClick={() => void ask()}>
            {asking ? "Rating…" : "Style my closet"}
          </button>
          {intro && <p className="ai-intro">{intro}</p>}
          {aiError && <p className="error">{aiError}</p>}
          {aiLooks.length > 0 && (
            <div className="looks">
              {aiLooks.map((look) => (
                <LookCard
                  key={look.ids.join("-")}
                  title={look.title}
                  garmentIds={look.ids}
                  review={look.review}
                  urls={urls}
                  names={namesFor(look.ids, garmentsById(garments))}
                  onBuild={() => {
                    setSelection(look.ids);
                    go("builder");
                  }}
                  onPlan={() => void plan({ title: look.title, garmentIds: look.ids, review: look.review })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {rated.length > 0 && (
        <section className="pairings">
          <div className="section-head">
            <p className="kicker">Saved</p>
            <h2>Already rated</h2>
          </div>
          <div className="looks">
            {rated.map((outfit) => (
              <LookCard
                key={outfit.id}
                title={outfit.name}
                garmentIds={outfit.garmentIds}
                review={outfit.review!}
                urls={urls}
                names={namesFor(outfit.garmentIds, garmentsById(garments))}
                onBuild={() => {
                  setSelection(outfit.garmentIds);
                  go("builder");
                }}
                onPlan={() => void plan({ title: outfit.name, garmentIds: outfit.garmentIds, review: outfit.review! })}
              />
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

function LookCard({
  title,
  garmentIds,
  review,
  urls,
  names,
  onBuild,
  onPlan,
}: {
  title: string;
  garmentIds: string[];
  review: OutfitReview;
  urls: Record<string, string>;
  names: string[];
  onBuild: () => void;
  onPlan: () => void;
}) {
  return (
    <article className="look">
      <header className="look-top">
        <div>
          <h3>{title}</h3>
          <p>{review.summary}</p>
        </div>
        <ScoreMeter score={review.score} />
      </header>
      <div className="look-stage">
        {garmentIds.map((id) => urls[id] && <img key={id} src={urls[id]} alt="" />)}
      </div>
      <p className="hint">{names.join(" · ")}</p>
      <ProsCons pros={review.pros} cons={review.cons} />
      <div className="row">
        <button type="button" className="btn primary" onClick={onPlan}>
          Wear today
        </button>
        <button type="button" className="btn" onClick={onBuild}>
          Edit in builder
        </button>
      </div>
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
