export const MAX_ACTIVE_PLAYERS = 30;
export const DEFAULT_HP = 25;
export const HP_PER_COIN = 25;
export const AURA_THRESHOLDS = [
  { level: 3, hp: 5000 },
  { level: 2, hp: 3000 },
  { level: 1, hp: 1000 }
];

const ARENA_RADIUS = 18;
const ATTACK_RANGE = 1.65;
const ATTACK_COOLDOWN = 0.82;
const BASE_DAMAGE = 5;

export function normalizeUsername(username) {
  return String(username ?? "").trim().replace(/\s+/g, " ").slice(0, 32);
}

export function auraLevelForHp(hp) {
  return AURA_THRESHOLDS.find((item) => hp >= item.hp)?.level ?? 0;
}

export function scaleForHp(hp) {
  const t = Math.min(1, Math.log10(Math.max(25, hp) / 25) / 2.45);
  return Number((0.78 + t * 1.75).toFixed(3));
}

export class BattleRoyaleGame {
  constructor(options = {}) {
    this.settings = {
      timerEnabled: false,
      timerMinutes: 3,
      resetCountdown: 8,
      ...options.settings
    };
    this.players = new Map();
    this.queue = [];
    this.round = 1;
    this.status = "waiting";
    this.timeLeft = this.settings.timerMinutes * 60;
    this.resetLeft = 0;
    this.winner = null;
    this.lastWinnerRound = 0;
  }

  updateSettings(settings = {}) {
    this.settings = {
      ...this.settings,
      ...settings,
      timerMinutes: clamp(Number(settings.timerMinutes ?? this.settings.timerMinutes), 1, 60),
      resetCountdown: clamp(Number(settings.resetCountdown ?? this.settings.resetCountdown), 2, 120),
      timerEnabled: Boolean(settings.timerEnabled ?? this.settings.timerEnabled)
    };
    if (this.status === "waiting") this.timeLeft = this.settings.timerMinutes * 60;
    return this.snapshot();
  }

  join(username) {
    const name = normalizeUsername(username);
    if (!name) return { ok: false, reason: "username is required" };
    const existing = this.findPlayer(name);
    if (existing) return { ok: true, duplicate: true, player: existing };
    const player = createPlayer(name, DEFAULT_HP);
    if (this.activePlayers().length < MAX_ACTIVE_PLAYERS && this.status !== "winner") {
      this.players.set(name.toLowerCase(), player);
      this.ensureRoundStarted();
      return { ok: true, queued: false, player };
    }
    this.queue.push(player);
    return { ok: true, queued: true, player };
  }

  addCoins(username, coins = 0) {
    const joined = this.join(username);
    if (!joined.ok) return joined;
    const amount = Math.max(0, Math.floor(Number(coins) || 0)) * HP_PER_COIN;
    const player = this.findPlayer(username);
    if (player && amount > 0) {
      player.hp += amount;
      player.maxHp += amount;
      player.scale = scaleForHp(player.hp);
      player.aura = auraLevelForHp(player.hp);
    }
    return { ok: true, hpAdded: amount, player };
  }

  addDummyPlayers(count = 10) {
    const created = [];
    for (let i = 0; i < count; i += 1) {
      const name = `Dummy_${Date.now().toString(36)}_${i + 1}`;
      created.push(this.join(name).player.username);
    }
    return created;
  }

  resetArena() {
    this.players.clear();
    this.status = "waiting";
    this.timeLeft = this.settings.timerMinutes * 60;
    this.resetLeft = 0;
    this.winner = null;
    this.admitQueuedPlayers();
    this.ensureRoundStarted();
  }

  hardReset() {
    this.players.clear();
    this.queue = [];
    this.round += 1;
    this.status = "waiting";
    this.timeLeft = this.settings.timerMinutes * 60;
    this.resetLeft = 0;
    this.winner = null;
  }

  tick(deltaSeconds) {
    const dt = Math.min(0.08, Math.max(0, deltaSeconds));
    if (this.status === "resetting") {
      this.resetLeft -= dt;
      if (this.resetLeft <= 0) {
        this.round += 1;
        this.resetArena();
      }
      return this.snapshot();
    }
    if (this.status === "winner") return this.snapshot();
    this.admitQueuedPlayers();
    this.ensureRoundStarted();
    if (this.status !== "fighting") return this.snapshot();
    if (this.settings.timerEnabled) this.timeLeft = Math.max(0, this.timeLeft - dt);
    this.stepCombat(dt);
    this.removeDeadPlayers();
    this.admitQueuedPlayers();
    this.maybeFinishRound();
    return this.snapshot();
  }

  acknowledgeWinner() {
    if (this.status === "winner") {
      this.status = "resetting";
      this.resetLeft = this.settings.resetCountdown;
    }
    return this.snapshot();
  }

  snapshot() {
    const active = this.activePlayers().map(toPublicPlayer).sort((a, b) => b.hp - a.hp);
    return {
      round: this.round,
      status: this.status,
      timeLeft: Math.ceil(this.timeLeft),
      resetLeft: Math.ceil(this.resetLeft),
      maxActive: MAX_ACTIVE_PLAYERS,
      settings: { ...this.settings },
      winner: this.winner,
      winnerRound: this.lastWinnerRound,
      players: active,
      queue: this.queue.map((player) => ({ username: player.username, hp: Math.ceil(player.hp) }))
    };
  }

  findPlayer(username) {
    const key = normalizeUsername(username).toLowerCase();
    return this.players.get(key) ?? this.queue.find((player) => player.username.toLowerCase() === key);
  }

  activePlayers() {
    return [...this.players.values()].filter((player) => player.alive);
  }

  admitQueuedPlayers() {
    while (this.activePlayers().length < MAX_ACTIVE_PLAYERS && this.queue.length > 0 && this.status !== "winner") {
      const player = this.queue.shift();
      placePlayer(player);
      this.players.set(player.username.toLowerCase(), player);
    }
  }

  ensureRoundStarted() {
    if (this.status === "waiting" && this.activePlayers().length >= 2) {
      this.status = "fighting";
      this.timeLeft = this.settings.timerMinutes * 60;
    }
  }

  stepCombat(dt) {
    const active = this.activePlayers();
    for (const player of active) {
      const target = nearestEnemy(player, active);
      if (!target) continue;
      player.target = target.id;
      const dx = target.x - player.x;
      const dz = target.z - player.z;
      const distance = Math.max(0.001, Math.hypot(dx, dz));
      const speed = 4.1 / Math.sqrt(player.scale);
      if (distance > ATTACK_RANGE) {
        player.x += (dx / distance) * speed * dt;
        player.z += (dz / distance) * speed * dt;
      } else {
        player.cooldown -= dt;
        if (player.cooldown <= 0) {
          target.hp -= BASE_DAMAGE + Math.min(20, Math.floor(player.hp / 700));
          player.cooldown = ATTACK_COOLDOWN;
        }
      }
      const distFromCenter = Math.hypot(player.x, player.z);
      if (distFromCenter > ARENA_RADIUS) {
        player.x = (player.x / distFromCenter) * ARENA_RADIUS;
        player.z = (player.z / distFromCenter) * ARENA_RADIUS;
      }
      player.scale = scaleForHp(player.hp);
      player.aura = auraLevelForHp(player.hp);
    }
  }

  removeDeadPlayers() {
    for (const [key, player] of this.players) {
      if (player.hp <= 0) this.players.delete(key);
    }
  }

  maybeFinishRound() {
    const active = this.activePlayers();
    if (active.length === 0) return;
    if (!this.settings.timerEnabled && active.length === 1 && this.queue.length === 0) {
      this.finish(active[0]);
      return;
    }
    if (this.settings.timerEnabled && this.timeLeft <= 0) {
      const winner = [...active].sort((a, b) => b.hp - a.hp)[0];
      this.finish(winner);
    }
  }

  finish(player) {
    this.status = "winner";
    this.winner = { username: player.username, hp: Math.ceil(player.hp) };
    this.lastWinnerRound = this.round;
  }
}

function createPlayer(username, hp) {
  const player = {
    id: cryptoId(),
    username,
    hp,
    maxHp: hp,
    alive: true,
    cooldown: Math.random() * ATTACK_COOLDOWN,
    x: 0,
    z: 0,
    target: null,
    scale: scaleForHp(hp),
    aura: auraLevelForHp(hp)
  };
  placePlayer(player);
  return player;
}

function placePlayer(player) {
  const angle = Math.random() * Math.PI * 2;
  const radius = 4 + Math.random() * (ARENA_RADIUS - 5);
  player.x = Math.cos(angle) * radius;
  player.z = Math.sin(angle) * radius;
}

function nearestEnemy(player, players) {
  let best = null;
  let bestDistance = Infinity;
  for (const other of players) {
    if (other.id === player.id) continue;
    const distance = (other.x - player.x) ** 2 + (other.z - player.z) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = other;
    }
  }
  return best;
}

function toPublicPlayer(player) {
  return {
    id: player.id,
    username: player.username,
    hp: Math.max(0, Math.ceil(player.hp)),
    x: Number(player.x.toFixed(3)),
    z: Number(player.z.toFixed(3)),
    scale: player.scale,
    aura: player.aura,
    target: player.target
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function cryptoId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
