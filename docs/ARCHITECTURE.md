# Architecture

## Runtime

- `backend` runs the authoritative battle simulation.
- `desktop` connects to the backend through Server-Sent Events and renders the latest state in Three.js.
- `shared` contains rules used by backend tests and runtime.

## Persistence

Desktop settings and leaderboard wins are stored in the Tauri app data directory as JSON. If the app is run in a browser during development, it falls back to `localStorage`.

The Hugging Face backend keeps state in memory. This is deliberate: webhook state resets cleanly when the Space restarts and no database is required for deployment.

## Performance Notes

- Maximum 30 active players.
- Waiting queue is not rendered as 3D objects.
- Aura effects use a single lightweight torus per player.
- HP scaling uses logarithmic smoothing with a cap.
- Backend tick rate is 20 Hz and snapshots are cheap JSON payloads.
