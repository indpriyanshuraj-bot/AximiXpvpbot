/**
 * Bot facade. Everything above this line speaks in requests and handles;
 * everything below it is a provider (currently: petstore).
 *
 * Bookkeeping lives in memory only — a bot that survives a reload is still
 * adopted by the bot addon, and `list()` reads the world, not this map.
 */
import { world } from '@minecraft/server';
import * as cfg from './config';
import * as providers from '../providers';
import type { BotHandle, Difficulty, SpawnRequest } from '../providers/types';
import { debug, warn } from '../../shared/log';

const managed = new Map<string, BotHandle>();

export interface SpawnOutcome {
  ok: boolean;
  id?: string;
  provider?: string;
  error?: string;
}

export function spawn(request: SpawnRequest): SpawnOutcome {
  const provider = providers.selected();
  if (!provider) {
    return { ok: false, error: 'no bot provider available (is PvP Practice Bots installed and Beta APIs enabled?)' };
  }

  const cap = cfg.get<number>('bridge.maxBots');
  if (managed.size >= cap) {
    return { ok: false, error: `bot cap reached (${cap})` };
  }

  const result = provider.spawn(request);
  if (!result.ok) return { ok: false, error: result.error };

  managed.set(result.handle.id, result.handle);
  return { ok: true, id: result.handle.id, provider: result.handle.provider };
}

export function despawn(id: string): boolean {
  const handle = managed.get(id);
  const provider = handle ? providers.byId(handle.provider) : providers.selected();
  if (!provider) return false;
  const target = handle ?? provider.list().find(h => h.id === id);
  if (!target) return false;
  const ok = provider.despawn(target);
  managed.delete(id);
  return ok;
}

export function despawnAll(): number {
  let removed = 0;
  for (const provider of providers.all()) {
    if (!provider.available()) continue;
    for (const handle of provider.list()) {
      if (provider.despawn(handle)) removed++;
    }
  }
  managed.clear();
  return removed;
}

/** Live bots, read from the world so externally spawned ones show up too. */
export function list(): BotHandle[] {
  const provider = providers.selected() ?? providers.all().find(p => p.available());
  if (!provider) return [];
  return provider.list();
}

export function setDifficulty(id: string, difficulty: Difficulty): boolean {
  const provider = providers.all().find(p => p.available());
  const handle = list().find(h => h.id === id);
  if (!provider || !handle) return false;
  return provider.setDifficulty(handle, difficulty);
}

export function applyInventory(id: string, items: string[]): boolean {
  const provider = providers.all().find(p => p.available());
  const handle = list().find(h => h.id === id);
  if (!provider || !handle) return false;
  return provider.applyInventory(handle, items);
}

/**
 * Janitor, run once per second. One world scan per run, not one per bot:
 * `list()` parses bot_data for every live bot, so calling it inside the loop
 * turned this into an O(n²) dynamic-property read.
 */
export function tick(): void {
  if (managed.size === 0) return;

  const alive = new Set(list().map(h => h.id));
  const despawnOnLeave = cfg.get<boolean>('bridge.despawnOnLeave');

  let present: Set<string> | undefined;
  if (despawnOnLeave) {
    try {
      present = new Set(world.getAllPlayers().map(p => p.id));
    } catch {
      present = undefined;
    }
  }

  for (const [id, handle] of [...managed]) {
    if (!alive.has(id)) {
      managed.delete(id);
      debug('bot gone', id);
      continue;
    }
    if (present && handle.targetId && !present.has(handle.targetId)) {
      warn('target left, despawning bot', id);
      despawn(id);
    }
  }
}

export function tracked(): BotHandle[] {
  return [...managed.values()];
}
