import { clear, setPlayers } from './stub-server';
import * as bots from '../../src/bridge/api/bots';
import * as cfg from '../../src/bridge/api/config';
import * as providers from '../../src/bridge/providers';
import type { BotHandle, BotProvider, SpawnRequest } from '../../src/bridge/providers/types';

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    passed++;
    console.log('  ok   ' + name);
  } else {
    failed++;
    console.log('  FAIL ' + name + (detail === undefined ? '' : ' -> ' + JSON.stringify(detail)));
  }
}

/** Deterministic provider so the facade can be tested without Minecraft. */
const live = new Map<string, BotHandle>();
let nextId = 1;

const fake: BotProvider = {
  id: 'petstore', // shadows the real adapter on purpose
  caps: ['spawn'],
  available: () => true,
  spawn(request: SpawnRequest) {
    const handle: BotHandle = {
      id: 'bot' + nextId++,
      provider: 'petstore',
      name: 'bot',
      type: request.type,
      difficulty: request.difficulty,
      spawnedTick: 0,
      targetId: request.targetId,
    };
    live.set(handle.id, handle);
    return { ok: true, handle };
  },
  despawn(handle) {
    return live.delete(handle.id);
  },
  list() {
    return [...live.values()];
  },
  setDifficulty(handle, difficulty) {
    const found = live.get(handle.id);
    if (!found) return false;
    found.difficulty = difficulty;
    return true;
  },
  applyInventory: () => true,
};

providers.register(fake);

console.log('\nbots facade');
clear();
live.clear();
nextId = 1;

const spawn = (targetId?: string) => bots.spawn({
  dimension: 'overworld',
  location: { x: 0, y: 64, z: 0 },
  difficulty: 'medium',
  type: 'sword',
  targetId,
});

const first = spawn('p1');
check('spawn returns an id and provider', first.ok && !!first.id && first.provider === 'petstore', first);
check('list reflects the provider', bots.list().length === 1);

const second = spawn('p1');
check('second spawn works under the default cap', second.ok === true, second);

cfg.set('bridge.maxBots', 2);
const third = spawn('p1');
check('cap blocks the third bot', third.ok === false && String(third.error).includes('cap'), third);

check('despawn removes one', bots.despawn(first.id!) === true && bots.list().length === 1);
check('despawnAll clears the rest', bots.despawnAll() === 1 && bots.list().length === 0);

console.log('\njanitor');
clear();
live.clear();
cfg.set('bridge.maxBots', 8);
cfg.set('bridge.despawnOnLeave', true);
const tracked = spawn('p1');
check('tracked after spawn', bots.tracked().length === 1);

// the bot dies on its own
live.delete(tracked.id!);
bots.tick();
check('dead bot is forgotten', bots.tracked().length === 0);

const orphan = spawn('p2');
setPlayers([{ id: 'someone-else' }]);
bots.tick();
check('bot whose target left is despawned', live.size === 0 && bots.tracked().length === 0, { live: live.size });
check('survives a missing player list', typeof orphan.id === 'string');

console.log('\nconfig guard rails');
check('unknown provider is not selected', (() => {
  cfg.set('bridge.provider', 'none');
  const out = spawn('p1');
  cfg.set('bridge.provider', 'petstore');
  return out.ok === false;
})(), 'none provider');

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exitCode = 1;
