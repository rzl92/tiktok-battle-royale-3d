import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import Arena from "./components/Arena.jsx";
import "./styles.css";

const defaultStore = {
  settings: {
    backendUrl: "http://127.0.0.1:7860",
    timerEnabled: false,
    timerMinutes: 3,
    resetCountdown: 8
  },
  leaderboard: {}
};

function App() {
  const [store, setStore] = useState(defaultStore);
  const [state, setState] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dummyCount, setDummyCount] = useState(12);
  const [coinUser, setCoinUser] = useState("");
  const [coinAmount, setCoinAmount] = useState(1);
  const seenWinner = useRef(null);

  const backendUrl = store.settings.backendUrl.replace(/\/$/, "");

  const saveStore = useCallback(async (nextStore) => {
    setStore(nextStore);
    try {
      await invoke("save_store", { store: nextStore });
    } catch {
      localStorage.setItem("battle-store", JSON.stringify(nextStore));
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const loaded = await invoke("load_store");
        if (mounted) setStore({ ...defaultStore, ...loaded, settings: { ...defaultStore.settings, ...loaded.settings } });
      } catch {
        const cached = localStorage.getItem("battle-store");
        if (cached && mounted) setStore({ ...defaultStore, ...JSON.parse(cached) });
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    fetch(`${backendUrl}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(store.settings)
    }).catch(() => {});
    const events = new EventSource(`${backendUrl}/events`);
    events.onmessage = (event) => setState(JSON.parse(event.data));
    events.onerror = () => {
      fetch(`${backendUrl}/state`)
        .then((res) => res.json())
        .then(setState)
        .catch(() => {});
    };
    return () => events.close();
  }, [backendUrl, store.settings.timerEnabled, store.settings.timerMinutes, store.settings.resetCountdown]);

  useEffect(() => {
    if (!state?.winner || state.winnerRound === seenWinner.current) return;
    seenWinner.current = state.winnerRound;
    const leaderboard = { ...store.leaderboard };
    leaderboard[state.winner.username] = (leaderboard[state.winner.username] ?? 0) + 1;
    saveStore({ ...store, leaderboard });
  }, [state?.winnerRound]);

  const updateSettings = (patch) => {
    const next = { ...store, settings: { ...store.settings, ...patch } };
    saveStore(next);
  };

  const leaderboardRows = useMemo(() => {
    return Object.entries(store.leaderboard)
      .map(([username, wins]) => ({ username, wins }))
      .sort((a, b) => b.wins - a.wins || a.username.localeCompare(b.username))
      .slice(0, 10);
  }, [store.leaderboard]);

  const callBackend = async (path, body = {}) => {
    const res = await fetch(`${backendUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    setState(await res.json().then((data) => data.state ?? data));
  };

  const resetLeaderboard = () => {
    if (confirm("Reset the persistent leaderboard?")) saveStore({ ...store, leaderboard: {} });
  };

  return (
    <main className="min-h-screen bg-[#101113] text-zinc-50">
      <Arena players={state?.players ?? []} status={state?.status ?? "offline"} />
      <button className="gear" onClick={() => setSettingsOpen(true)} aria-label="Open settings">⚙</button>
      <section className="hud top-4 left-4 w-72">
        <p className="label">Timer</p>
        <p className="big">{formatClock(state?.timeLeft ?? store.settings.timerMinutes * 60)}</p>
        <p className="muted">{store.settings.timerEnabled ? "Timer on" : "Timer off"} · {state?.status ?? "connecting"}</p>
      </section>
      <section className="hud top-4 right-4 w-80">
        <p className="label">Queue</p>
        <div className="list">
          {(state?.queue ?? []).slice(0, 12).map((player) => <span key={player.username}>{player.username} · {player.hp} HP</span>)}
          {(state?.queue ?? []).length === 0 && <span className="muted">No one waiting</span>}
        </div>
      </section>
      <section className="hud bottom-4 left-4 w-80">
        <p className="label">Players</p>
        <div className="list">
          {(state?.players ?? []).slice(0, 10).map((player) => <span key={player.id}>{player.username} · {player.hp} HP</span>)}
        </div>
      </section>
      <section className="hud bottom-4 right-4 w-72">
        <p className="label">Leaderboard</p>
        <div className="list">
          {leaderboardRows.map((row) => <span key={row.username}>{row.username} · {row.wins} wins</span>)}
          {leaderboardRows.length === 0 && <span className="muted">No wins yet</span>}
        </div>
      </section>
      {state?.status === "winner" && state.winner && (
        <div className="modal-backdrop">
          <div className="modal">
            <p className="label">Winner</p>
            <h1>{state.winner.username}</h1>
            <p>{state.winner.hp} HP remaining</p>
            <button onClick={() => callBackend("/winner/ack")}>Start reset countdown</button>
          </div>
        </div>
      )}
      {state?.status === "resetting" && <div className="reset-banner">Reset in {state.resetLeft}</div>}
      {settingsOpen && (
        <div className="modal-backdrop">
          <div className="settings modal">
            <div className="settings-head">
              <h2>Settings</h2>
              <button onClick={() => setSettingsOpen(false)}>Close</button>
            </div>
            <label>Backend URL<input value={store.settings.backendUrl} onChange={(e) => updateSettings({ backendUrl: e.target.value })} /></label>
            <label className="row"><input type="checkbox" checked={store.settings.timerEnabled} onChange={(e) => updateSettings({ timerEnabled: e.target.checked })} /> Timer on</label>
            <label>Timer minutes<input type="number" min="1" max="60" value={store.settings.timerMinutes} onChange={(e) => updateSettings({ timerMinutes: Number(e.target.value) })} /></label>
            <label>Reset countdown<input type="number" min="2" max="120" value={store.settings.resetCountdown} onChange={(e) => updateSettings({ resetCountdown: Number(e.target.value) })} /></label>
            <button onClick={resetLeaderboard}>Reset leaderboard</button>
            <hr />
            <h3>Simulation</h3>
            <label>Dummy players<input type="number" min="1" max="100" value={dummyCount} onChange={(e) => setDummyCount(Number(e.target.value))} /></label>
            <button onClick={() => callBackend("/simulate/dummies", { count: dummyCount })}>Add dummy players</button>
            <label>Player username<input value={coinUser} onChange={(e) => setCoinUser(e.target.value)} /></label>
            <label>Coins<input type="number" min="1" value={coinAmount} onChange={(e) => setCoinAmount(Number(e.target.value))} /></label>
            <button onClick={() => callBackend("/simulate/coins", { username: coinUser, coins: coinAmount })}>Add coins</button>
            <button onClick={() => callBackend("/simulate/mass", { count: 45 })}>Mass join test</button>
            <button onClick={() => callBackend("/simulate/gameplay")}>Trigger gameplay test</button>
            <button onClick={() => callBackend("/reset")}>Reset arena</button>
          </div>
        </div>
      )}
    </main>
  );
}

function formatClock(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(value / 60);
  const rest = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

createRoot(document.getElementById("root")).render(<App />);
