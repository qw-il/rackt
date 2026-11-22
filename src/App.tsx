import { useEffect, useRef, useState } from "react";
import { ClosetProvider, useCloset } from "./store";
import { categoryLabel, type ViewId } from "./types";
import { go, readView } from "./nav";
import { Closet } from "./components/Closet";
import { Looks } from "./components/Looks";
import { Builder } from "./components/Builder";
import { Calendar } from "./components/Calendar";
import { Studio, type Draft } from "./components/Studio";
import { Settings } from "./components/Settings";
import { PieceDetail } from "./components/PieceDetail";

const NAV: { id: ViewId; label: string }[] = [
  { id: "closet", label: "Closet" },
  { id: "looks", label: "Looks" },
  { id: "builder", label: "Builder" },
  { id: "calendar", label: "Calendar" },
];

export function App() {
  return (
    <ClosetProvider>
      <Shell />
    </ClosetProvider>
  );
}

function Shell() {
  const closet = useCloset();
  const [view, setView] = useState<ViewId>(readView);
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    document.documentElement.dataset.theme === "light" ? "light" : "dark",
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [studio, setStudio] = useState<{ key: number; file: File | null; refineId: string | null } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  useEffect(() => {
    const sync = () => setView(readView());
    window.addEventListener("hashchange", sync);
    const openSettings = () => setSettingsOpen(true);
    window.addEventListener("atelier-settings", openSettings);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("atelier-settings", openSettings);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (studio) return;
      setSettingsOpen(false);
      setDetailId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [studio]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("atelier-theme", next);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "light" ? "#e6dfd4" : "#0c0d12");
    setTheme(next);
  }

  function openStudio(file: File | null = null, refineId: string | null = null) {
    setStudio({ key: Date.now(), file, refineId });
  }

  async function saveDraft(draft: Draft) {
    if (studio?.refineId) {
      const existing = closet.garments.find((garment) => garment.id === studio.refineId);
      if (!existing) return;
      await closet.updateGarment({
        ...existing,
        name: draft.name,
        category: draft.category,
        note: draft.note,
        colors: draft.colors,
        image: draft.image,
        original: draft.original,
      });
      closet.notify(`Updated ${draft.name}.`);
    } else {
      await closet.addGarment({
        name: draft.name,
        category: draft.category,
        note: draft.note,
        colors: draft.colors,
        image: draft.image,
        original: draft.original,
        sample: false,
      });
      closet.notify(`Filed ${draft.name} under ${categoryLabel(draft.category).toLowerCase()}.`);
    }
    setStudio(null);
    go("closet");
  }

  const refine = studio?.refineId ? closet.garments.find((garment) => garment.id === studio.refineId) : undefined;

  return (
    <div
      className="app"
      onDragEnter={(event) => {
        if (studio || ![...event.dataTransfer.types].includes("Files")) return;
        event.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => {
        if (dragDepth.current > 0) event.preventDefault();
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={(event) => {
        if (dragDepth.current === 0 && event.dataTransfer.files.length === 0) return;
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        if (studio) return;
        const file = [...event.dataTransfer.files].find((item) => item.type.startsWith("image/"));
        if (file) openStudio(file);
      }}
    >
      <header className="topbar">
        <button type="button" className="brand" onClick={() => go("closet")}>
          <span>Atelier</span>
          <small>Wardrobe</small>
        </button>
        <nav className="links" aria-label="Primary">
          {NAV.map((item) => (
            <button key={item.id} type="button" className={view === item.id ? "nav-link active" : "nav-link"} onClick={() => go(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="top-actions">
          <button
            type="button"
            className="btn ghost"
            aria-pressed={theme === "dark"}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggleTheme}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <button type="button" className="btn ghost" onClick={() => setSettingsOpen(true)}>
            {closet.settings.apiKey ? "Key saved" : "API key"}
          </button>
          <button type="button" className="btn primary" onClick={() => openStudio()}>
            Add a piece
          </button>
        </div>
      </header>

      <main>
        {!closet.ready ? (
          <p className="booting">Opening your closet…</p>
        ) : closet.error ? (
          <div className="empty">
            <h2>The closet could not open</h2>
            <p>{closet.error}</p>
          </div>
        ) : (
          <div key={view} className="view">
            {view === "closet" && <Closet onOpen={setDetailId} onAdd={() => openStudio()} />}
            {view === "looks" && <Looks />}
            {view === "builder" && <Builder />}
            {view === "calendar" && <Calendar />}
          </div>
        )}
      </main>

      <nav className="tabbar" aria-label="Primary">
        {NAV.map((item) => (
          <button key={item.id} type="button" className={view === item.id ? "active" : ""} onClick={() => go(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>

      {closet.toast && (
        <div className="toast" role="status">
          {closet.toast.message}
        </div>
      )}
      {dragging && <div className="drag-veil">Drop the photo to add it</div>}
      {studio && (
        <Studio
          key={studio.key}
          file={studio.file}
          refine={
            refine?.original
              ? { original: refine.original, name: refine.name, category: refine.category, note: refine.note }
              : null
          }
          onClose={() => setStudio(null)}
          onSave={saveDraft}
        />
      )}
      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
      {detailId && (
        <PieceDetail
          id={detailId}
          onClose={() => setDetailId(null)}
          onRefine={(id) => {
            setDetailId(null);
            openStudio(null, id);
          }}
        />
      )}
    </div>
  );
}
