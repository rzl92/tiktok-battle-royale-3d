import assert from "node:assert/strict";
import test from "node:test";
import { BattleRoyaleGame, DEFAULT_HP, HP_PER_COIN, MAX_ACTIVE_PLAYERS } from "@battle/shared";

test("webhook rules join unique users and queue extras", () => {
  const game = new BattleRoyaleGame();
  for (let i = 0; i < MAX_ACTIVE_PLAYERS + 2; i += 1) game.join(`p${i}`);
  game.join("p1");
  const state = game.snapshot();
  assert.equal(state.players.length, MAX_ACTIVE_PLAYERS);
  assert.equal(state.queue.length, 2);
});

test("coins create missing players and add hp", () => {
  const game = new BattleRoyaleGame();
  const result = game.addCoins("coinhero", 3);
  assert.equal(result.player.hp, DEFAULT_HP + 3 * HP_PER_COIN);
});
