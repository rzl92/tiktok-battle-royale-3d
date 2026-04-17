import cors from "cors";
import express from "express";
import helmet from "helmet";
import { BattleRoyaleGame } from "@battle/shared";

export function createApp() {
  const app = express();
  const game = new BattleRoyaleGame();
  const clients = new Set();

  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json({ limit: "128kb" }));

  const publish = () => {
    const payload = `data: ${JSON.stringify(game.snapshot())}\n\n`;
    for (const client of clients) client.write(payload);
  };

  setInterval(() => publish(), 1000).unref();
  let lastTick = Date.now();
  setInterval(() => {
    const now = Date.now();
    game.tick((now - lastTick) / 1000);
    lastTick = now;
    publish();
  }, 50).unref();

  app.get("/", (_req, res) => {
    res.json({
      name: "TikTok Battle Royale 3D Backend",
      status: "ok",
      endpoints: ["/webhook1", "/webhook2", "/state", "/events", "/settings", "/simulate/*"]
    });
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true, uptime: process.uptime(), state: game.snapshot().status });
  });

  app.get("/state", (_req, res) => res.json(game.snapshot()));

  app.get("/events", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    res.write(`data: ${JSON.stringify(game.snapshot())}\n\n`);
    clients.add(res);
    req.on("close", () => clients.delete(res));
  });

  app.get("/webhook1", (req, res) => {
    const result = game.join(req.query.username);
    publish();
    res.status(result.ok ? 200 : 400).json({ ...result, state: game.snapshot() });
  });

  app.get("/webhook2", (req, res) => {
    const result = game.addCoins(req.query.username, req.query.coins);
    publish();
    res.status(result.ok ? 200 : 400).json({ ...result, state: game.snapshot() });
  });

  app.get("/settings", (_req, res) => res.json(game.snapshot().settings));
  app.post("/settings", (req, res) => {
    game.updateSettings(req.body ?? {});
    publish();
    res.json(game.snapshot());
  });

  app.post("/winner/ack", (_req, res) => {
    game.acknowledgeWinner();
    publish();
    res.json(game.snapshot());
  });

  app.post("/reset", (_req, res) => {
    game.hardReset();
    publish();
    res.json(game.snapshot());
  });

  app.post("/simulate/dummies", (req, res) => {
    const created = game.addDummyPlayers(Number(req.body?.count ?? 10));
    publish();
    res.json({ ok: true, created, state: game.snapshot() });
  });

  app.post("/simulate/coins", (req, res) => {
    const result = game.addCoins(req.body?.username, req.body?.coins);
    publish();
    res.status(result.ok ? 200 : 400).json({ ...result, state: game.snapshot() });
  });

  app.post("/simulate/mass", (req, res) => {
    const count = Math.min(100, Math.max(1, Number(req.body?.count ?? 45)));
    const created = game.addDummyPlayers(count);
    publish();
    res.json({ ok: true, created, state: game.snapshot() });
  });

  app.post("/simulate/gameplay", (_req, res) => {
    if (game.snapshot().players.length < 2) game.addDummyPlayers(12);
    for (let i = 0; i < 120; i += 1) game.tick(0.05);
    publish();
    res.json({ ok: true, state: game.snapshot() });
  });

  app.use((_req, res) => res.status(404).json({ ok: false, error: "Not found" }));
  return { app, game };
}
