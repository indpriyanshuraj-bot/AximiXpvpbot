/**
 * Bot facade. Everything above this line speaks in requests and handles;
 * everything below it is a provider (currently: petstore).
 *
 * Bookkeeping lives in memory only — a bot that survives a reload is still
 * adopted by the bot addon, and `list()` reads the world, not this map.
 */
import { EquipmentSlot, world } from '@minecraft/server';
import type { Player } from '@minecraft/server';
import * as cfg from './config';
import * as providers from '../providers';
import type { BotHandle, Difficulty, SpawnRequest } from '../providers/types';
import type { Vec3 } from '../../shared/vec';
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

// --------------------------------------------------------------- duel bridge

/** Amixi mode tags, in the order its own code checks them. */
const MODE_TAGS = [
  'nodebuff', 'boxing', 'sumo', 'midfight', 'builduhc', 'gapple',
  'skywars', 'treasurewars', 'hallfight', 'stickfight', 'combo',
];

/** Amixi spawns bots with a component group name; map that to a difficulty. */
const VARIANT_DIFFICULTY: Record<string, Difficulty> = {
  'bot:dummy': 'easy',
  'bot:easy': 'easy',
  'bot:medium': 'medium',
  'bot:hard': 'hard',
  'bot:god': 'hard',
  'bot:hacker': 'impossible',
  'bot:clutch': 'medium',
  'bot:reduce': 'medium',
  'bot:bow': 'medium',
};

interface ModeEntry {
  type?: string;
  customId?: string;
}

function modeTable(): Record<string, ModeEntry> {
  try {
    const parsed = JSON.parse(cfg.get<string>('bridge.modeMap') || '{}') as Record<string, ModeEntry>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    warn('bridge.modeMap is not valid JSON; using defaults');
    return {};
  }
}

export function modeOf(player: Player): string {
  for (const tag of MODE_TAGS) {
    if (player.hasTag(tag)) return tag;
  }
  return '';
}

export function entryForMode(mode: string): ModeEntry {
  const table = modeTable();
  const entry = table[mode];
  if (entry && (entry.type || entry.customId)) return entry;
  return { type: 'sword' };
}

/** "minecraft:diamond_sword:1" strings, in hotbar order then armour. */
export function inventoryOf(player: Player): string[] {
  const out: string[] = [];
  try {
    const container = player.getComponent('minecraft:inventory')?.container;
    if (container) {
      for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (item) out.push(`${item.typeId}:${item.amount}`);
      }
    }
    const equippable = player.getComponent('minecraft:equippable');
    if (equippable) {
      for (const slot of [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet, EquipmentSlot.Offhand]) {
        const item = equippable.getEquipment(slot);
        if (item) out.push(`${item.typeId}:${item.amount}`);
      }
    }
  } catch (e) {
    debug('could not read inventory', e);
  }
  return out;
}

/**
 * Called by the patched Amixi when it would otherwise `summon bot:pvp ...`.
 * Everything Amixi knows (mode tag, variant) is turned into a spawn request.
 */
export function spawnDuel(
  player: Player,
  variant: string,
  location: Vec3,
): SpawnOutcome {
  const mode = modeOf(player);
  const entry = entryForMode(mode);
  const difficulty = VARIANT_DIFFICULTY[variant] ?? (cfg.get<string>('bridge.difficulty') as Difficulty);

  return spawn({
    dimension: player.dimension.id,
    location,
    difficulty,
    type: entry.type ?? 'sword',
    customId: entry.customId,
    targetId: player.id,
    inventory: cfg.get<boolean>('bridge.copyKit') ? inventoryOf(player) : undefined,
    skin: cfg.get<string>('bridge.skin') || undefined,
    ml: cfg.get<boolean>('bridge.ml'),
  });
}

/** Removes every bridge bot within `radius` of a point. */
export function despawnNear(location: Vec3, radius = 10, dimensionId?: string): number {
  let removed = 0;
  for (const handle of list()) {
    let entity;
    try {
      entity = world.getEntity(handle.id);
    } catch {
      entity = undefined;
    }
    if (!entity?.isValid) continue;
    if (dimensionId && entity.dimension.id !== dimensionId) continue;
    const dx = entity.location.x - location.x;
    const dy = entity.location.y - location.y;
    const dz = entity.location.z - location.z;
    if (Math.hypot(dx, dy, dz) > radius) continue;
    if (despawn(handle.id)) removed++;
  }
  return removed;
}
