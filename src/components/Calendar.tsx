import { useMemo, useState } from "react";
import { useCloset } from "../store";
import { monthGrid, monthLabel, parseKey, prettyDate, todayKey, WEEKDAYS } from "../lib/dates";
import { go } from "../nav";

export function Calendar() {
  const { outfits, days, urls, garments, planDay, clearDay, removeOutfit, setSelection } = useCloset();
  const today = todayKey();
  const initial = parseKey(today);
  const [cursor, setCursor] = useState({ year: initial.getFullYear(), month: initial.getMonth() });
  const [selected, setSelected] = useState(today);
  const cells = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);
  const plan = days.find((day) => day.date === selected);
  const outfit = plan ? outfits.find((item) => item.id === plan.outfitId) : undefined;
  const worn = outfit ? garments.filter((garment) => outfit.garmentIds.includes(garment.id)) : [];

  function shift(delta: number) {
    const next = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
  }

  return (
    <section className="page">
      <header className="page-head">
        <p className="kicker">Calendar</p>
        <h1 className="display">What you'll wear, day by day.</h1>
        <p className="lede">Plan a saved outfit onto a date. The pieces stay linked, so the day still makes sense if you rename them.</p>
      </header>
      <div className="calendar-layout">
        <div className="month">
          <div className="month-bar">
            <button type="button" className="btn ghost" onClick={() => shift(-1)} aria-label="Previous month">
              Prev
            </button>
            <h2>{monthLabel(cursor.year, cursor.month)}</h2>
            <button type="button" className="btn ghost" onClick={() => shift(1)} aria-label="Next month">
              Next
            </button>
          </div>
          <div className="weekdays">
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="days">
            {cells.map((cell) => {
              const dayPlan = days.find((day) => day.date === cell.date);
              const dayOutfit = dayPlan ? outfits.find((item) => item.id === dayPlan.outfitId) : undefined;
              const cover = dayOutfit
                ? garments.find((garment) => garment.id === dayOutfit.garmentIds[0])
                : undefined;
              const classes = [
                "day",
                cell.inMonth ? "" : "muted",
                cell.date === today ? "today" : "",
                cell.date === selected ? "picked" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button key={cell.date} type="button" className={classes} onClick={() => setSelected(cell.date)}>
                  <span className="day-num">{Number(cell.date.slice(-2))}</span>
                  {cover && urls[cover.id] && <img src={urls[cover.id]} alt="" />}
                  {dayOutfit && <span className="day-name">{dayOutfit.name}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <aside className="day-panel">
          <p className="kicker">{selected === today ? "Today" : "Selected"}</p>
          <h2>{prettyDate(selected)}</h2>
          {outfit ? (
            <>
              <p className="panel-name">{outfit.name}</p>
              <p>{outfit.note}</p>
              <div className="panel-pieces">
                {worn.map((garment) => (
                  <img key={garment.id} src={urls[garment.id]} alt={garment.name} />
                ))}
              </div>
              <div className="row">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setSelection(outfit.garmentIds);
                    go("builder");
                  }}
                >
                  Open in builder
                </button>
                <button type="button" className="btn ghost" onClick={() => void clearDay(selected)}>
                  Clear day
                </button>
              </div>
            </>
          ) : (
            <p>Nothing planned. Choose a saved outfit, or build one first.</p>
          )}
          <div className="outfit-pick">
            <h3>Saved outfits</h3>
            {outfits.length === 0 && (
              <p className="hint">
                None yet. <button type="button" className="text-btn" onClick={() => go("looks")}>See looks you can make</button>
              </p>
            )}
            {outfits.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === outfit?.id ? "outfit-choice on" : "outfit-choice"}
                onClick={() => void planDay(selected, item.id)}
              >
                <span>{item.name}</span>
                <span className="choice-meta">{item.garmentIds.length} pieces</span>
              </button>
            ))}
          </div>
          {outfit && (
            <button type="button" className="text-btn danger" onClick={() => void removeOutfit(outfit.id)}>
              Delete this outfit
            </button>
          )}
        </aside>
      </div>
    </section>
  );
}
