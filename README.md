---
title: TikTok Battle Royale 3D Backend
emoji: ⚔️
colorFrom: green
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
---

# TikTok Battle Royale 3D

Lightweight desktop-first 3D TikTok battle royale.

The frontend is a Tauri desktop app using React, Vite, Tailwind, and Three.js. The backend is a small Node.js and Express service designed for Hugging Face Spaces with Docker.

## Folder Structure

```text
backend/   Express webhook API, battle loop, SSE snapshots
desktop/   Tauri desktop app, React UI, Three.js arena
shared/    Shared game rules and simulation engine
storage/   Local development storage placeholder
docs/      Deployment and architecture notes
```

## Local Run

Install dependencies:

```powershell
npm.cmd install
```

Run the backend:

```powershell
npm.cmd run backend:dev
```

Run the desktop app in another terminal:

```powershell
npm.cmd run desktop:dev
```

The desktop app defaults to `http://127.0.0.1:7860`. Settings and the persistent leaderboard are stored as a local JSON file through Tauri.

## Build Desktop App

Tauri requires Rust and the system WebView dependencies.

```powershell
npm.cmd run desktop:build
```

## Hugging Face Backend Deployment

1. Create a new Hugging Face Space.
2. Choose Docker as the Space SDK.
3. Push this repository to the Space remote, or upload the project files.
4. Hugging Face builds `Dockerfile` and serves the backend on port `7860`.

The backend is intentionally API-only. The frontend remains a desktop app.

## Webhooks

Join or create a player:

```text
GET /webhook1?username={username}
```

Add coins:

```text
GET /webhook2?username={username}&coins={coins}
```

Rules:

- Default HP is `25`.
- `1` coin adds `25` HP.
- Missing users are created first with `25` HP, then receive coin HP.
- Usernames are unique across active arena players and the waiting queue.
- The arena holds `30` active players.
- Extra players wait in the visible queue and enter automatically when slots open.

Examples:

```text
http://127.0.0.1:7860/webhook1?username=Rizal
http://127.0.0.1:7860/webhook2?username=Rizal&coins=4
```

## API

```text
GET  /health
GET  /state
GET  /events
GET  /settings
POST /settings
POST /winner/ack
POST /reset
POST /simulate/dummies
POST /simulate/coins
POST /simulate/mass
POST /simulate/gameplay
```

`/events` streams state snapshots to the desktop app with Server-Sent Events.

## Architecture Summary

The backend owns the battle state, accepts TikTok webhook calls, runs a fixed lightweight simulation loop, and streams snapshots. The desktop app renders only the latest snapshot, keeps settings and leaderboard locally, and sends simulation/settings actions to the backend.

The Three.js scene uses primitives only: a circular arena, capsule players, simple aura rings, capped HP scaling, and one render loop. This keeps the app stable with 30 active players.
