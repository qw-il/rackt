import { useState } from "react";
import { useCloset } from "../store";
import type { AiSettings, ProviderId } from "../types";
import { PROVIDERS, testConnection } from "../lib/ai";

export function Settings({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings, garments, clearSamples, notify } = useCloset();
  const [draft, setDraft] = useState<AiSettings>(settings);
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");
  const hasSamples = garments.some((garment) => garment.sample);

  function commit(next: AiSettings) {
    setDraft(next);
    updateSettings(next);
  }

  function choose(provider: ProviderId) {
    if (provider === "custom") {
      commit({ ...draft, provider });
      return;
    }
    commit({
      ...draft,
      provider,
      baseUrl: PROVIDERS[provider].baseUrl,
      model: PROVIDERS[provider].model,
    });
  }

  async function test() {
    setStatus("checking");
    setMessage("");
    try {
      await testConnection(draft);
      setStatus("ok");
      setMessage("Connected. The key works with this model.");
    } catch (reason) {
      setStatus("error");
      setMessage(reason instanceof Error ? reason.message : "Could not connect.");
    }
  }

  return (
    <div className="drawer-root">
      <button type="button" className="scrim" aria-label="Close settings" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="drawer-bar">
          <div>
            <p className="kicker">Settings</p>
            <h2 id="settings-title">A key, if you want one</h2>
          </div>
          <button type="button" className="btn ghost" onClick={onClose}>
            Close
          </button>
        </header>
        <p className="lede tight">
          Atelier already files pieces, pairs colors, and builds outfits on this device. A key is only for naming new photos and writing an extra styling note.
        </p>
        <div className="chips" role="group" aria-label="Provider">
          {(Object.keys(PROVIDERS) as ProviderId[]).map((id) => (
            <button key={id} type="button" className={draft.provider === id ? "chip active" : "chip"} onClick={() => choose(id)}>
              {PROVIDERS[id].label}
            </button>
          ))}
        </div>
        <label className="field">
          <span>API key</span>
          <span className="key-row">
            <input
              type={showKey ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              value={draft.apiKey}
              placeholder="sk-…"
              onChange={(event) => commit({ ...draft, apiKey: event.target.value })}
            />
            <button type="button" className="btn ghost" onClick={() => setShowKey((value) => !value)}>
              {showKey ? "Hide" : "Show"}
            </button>
          </span>
        </label>
        <label className="field">
          <span>Model</span>
          <input value={draft.model} onChange={(event) => commit({ ...draft, model: event.target.value })} />
        </label>
        <label className="field">
          <span>Provider address</span>
          <input value={draft.baseUrl} onChange={(event) => commit({ ...draft, provider: "custom", baseUrl: event.target.value })} />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={draft.tagOnAdd}
            onChange={(event) => commit({ ...draft, tagOnAdd: event.target.checked })}
          />
          <span>When a key is saved, let the model name new pieces.</span>
        </label>
        <p className="hint">
          The key stays in this browser. It is sent only to the address above, and only when you test it, tag a photo, or ask for styling. Photos are included only for tagging.
        </p>
        <div className="row">
          <button type="button" className="btn primary" disabled={!draft.apiKey.trim() || status === "checking"} onClick={() => void test()}>
            {status === "checking" ? "Checking…" : "Test key"}
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              commit({ ...draft, apiKey: "" });
              setStatus("idle");
              setMessage("Key removed from this browser.");
            }}
          >
            Forget key
          </button>
        </div>
        {message && <p className={status === "error" ? "error" : "hint"}>{message}</p>}
        {hasSamples && (
          <div className="settings-block">
            <h3>Studio set</h3>
            <p className="hint">Remove the illustrated stand-ins once your own clothes are in.</p>
            <button
              type="button"
              className="btn"
              onClick={() => {
                void clearSamples().then(() => notify("Studio pieces removed."));
                onClose();
              }}
            >
              Remove studio pieces
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
