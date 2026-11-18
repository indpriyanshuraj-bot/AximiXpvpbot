/**
 * Adapter for "PvP Practice Bots" (petstorebuffet).
 *
 * It does not copy, modify or ship any of that addon's code. It talks to the
 * addon the way the addon already talks to itself:
 *
 *   1. a simulated player named with the bot prefix (`§p§b§rPVP_bot`) and
 *      tagged `PvPbot` — the addon's own tick loop adopts any such player;
 *   2. a `bot_data` dynamic property in the shape its `getBotData()` expects,
 *      written *before* its loop reads it for the first time;
 *   3. the inventory is applied by us, because kit authority stays with Amixi.
 *
 * The one rule that matters: never write `bot_data` after the addon has read
 * it. Their manager caches the parsed object per bot id and writes it back, so
 * a later external write is simply overwritten. Retarget = respawn.
 */
import { EquipmentSlot, GameMode, ItemStack, system, world } from '@minecraft/server';
import type { Container, Entity, Player } from '@minecraft/server';
import { spawnSimulatedPlayer } from '@minecraft/server-gametest';
import * as cfg from '../api/config';
import { debug, error, warn } from '../../shared/log';
import type { BotHandle, BotProvider, Difficulty, SpawnRequest } from './types';

const BOT_PREFIX = '§p§b§rPVP_bot';
const BOT_TAG = 'PvPbot';
const DIFFICULTY_VALUE: Record<Difficulty, number> = { easy: 3, medium: 2, hard: 1, impossible: 0 };

const ARMOR_SLOTS: Record<string, EquipmentSlot> = {
  helmet: EquipmentSlot.Head,
  chestplate: EquipmentSlot.Chest,
  leggings: EquipmentSlot.Legs,
  boots: EquipmentSlot.Feet,
};

/** `list()` parses bot_data per bot; cache it for a few ticks. */
let listCache: { tick: number; bots: BotHandle[] } = { tick: -999, bots: [] };
const LIST_TTL = 10;

export function invalidateList(): void {
  listCache = { tick: -999, bots: [] };
}

function currentTick(): number {
  try {
    return system.currentTick;
  } catch {
    return 0;
  }
}

function rawPlayers(): Player[] {
  const anyWorld = world as unknown as { getRawPlayers?: () => Player[] };
  try {
    if (typeof anyWorld.getRawPlayers === 'function') return anyWorld.getRawPlayers();
  } catch {
    /* fall through */
  }
  return world.getAllPlayers();
}

function entityById(id: string): Entity | undefined {
  try {
    return world.getEntity(id);
  } catch {
    return undefined;
  }
}

function findBot(handle: BotHandle): Player | undefined {
  return rawPlayers().find(p => p.id === handle.id && p.hasTag(BOT_TAG));
}

/** "minecraft:golden_apple:8" -> { typeId, amount } */
function parseItem(spec: string): { typeId: string; amount: number } | null {
  const parts = spec.split(':');
  if (parts.length < 2) return null;
  const amount = parts.length >= 3 ? Math.max(1, parseInt(parts[2]!, 10) || 1) : 1;
  return { typeId: `${parts[0]}:${parts[1]}`, amount };
}

function applyInventory(bot: Player, items: string[], clear: boolean): boolean {
  const container = bot.getComponent('minecraft:inventory')?.container;
  const equippable = bot.getComponent('minecraft:equippable');
  if (!container) return false;

  if (clear) {
    try {
      (container as Container).clearAll();
    } catch {
      /* older engines */
    }
    for (const slot of [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet, EquipmentSlot.Offhand]) {
      try {
        equippable?.setEquipment(slot, undefined);
      } catch {
        /* ignore */
      }
    }
  }

  let slot = 0;
  for (const spec of items) {
    const parsed = parseItem(spec);
    if (!parsed) {
      warn('bad item spec: ' + spec);
      continue;
    }
    let stack: ItemStack;
    try {
      stack = new ItemStack(parsed.typeId, parsed.amount);
    } catch {
      warn('unknown item: ' + parsed.typeId);
      continue;
    }

    const name = parsed.typeId.split(':')[1] ?? '';
    const armorSlot = Object.keys(ARMOR_SLOTS).find(k => name.endsWith(k));
    try {
      if (armorSlot && equippable) {
        equippable.setEquipment(ARMOR_SLOTS[armorSlot]!, stack);
      } else if ((name === 'shield' || name === 'totem_of_undying') && equippable) {
        equippable.setEquipment(EquipmentSlot.Offhand, stack);
      } else if (slot < container.size) {
        container.setItem(slot++, stack);
      }
    } catch (e) {
      debug('failed to place ' + parsed.typeId, e);
    }
  }
  return true;
}

export const petstoreProvider: BotProvider = {
  id: 'petstore',
  caps: ['spawn', 'despawn', 'list', 'difficulty', 'inventory', 'tuning'],

  available(): boolean {
    try {
      // Their manager installs world.getRawPlayers on load; its presence means
      // the bot addon is installed and has initialised.
      return typeof (world as unknown as { getRawPlayers?: unknown }).getRawPlayers === 'function';
    } catch {
      return false;
    }
  },

  spawn(request: SpawnRequest) {
    try {
      const dimension = world.getDimension(request.dimension);
      const bot = spawnSimulatedPlayer(
        { x: request.location.x, y: request.location.y, z: request.location.z, dimension },
        BOT_PREFIX,
        GameMode.Survival,
      );

      bot.addTag(BOT_TAG);
      bot.nameTag = request.name ?? BOT_PREFIX;

      const profile = {
        linked_player: request.targetId ?? 'player',
        difficulty: DIFFICULTY_VALUE[request.difficulty] ?? 2,
        type: request.type,
        action: 'none',
        is_eating: false,
        isPearling: false,
        lastAttack: 0,
        lastPearl: 0,
        jumpDelay: 0,
        default_name: bot.nameTag,
        ignoredTag: request.ignoreTag ?? null,
        customId: null,
        error: '',
        mlOverride: false,
        mlDisabled: cfg.get<boolean>('bridge.mlDisabled'),
        mlRole: 'attack',
      };
      bot.setDynamicProperty('bot_data', JSON.stringify(profile));

      if (request.inventory?.length) {
        applyInventory(bot, request.inventory, cfg.get<boolean>('bridge.clearInventory'));
      }

      const handle: BotHandle = {
        id: bot.id,
        provider: 'petstore',
        name: bot.nameTag,
        type: request.type,
        difficulty: request.difficulty,
        spawnedTick: 0,
        targetId: request.targetId,
      };
      invalidateList();
      debug('spawned petstore bot', handle.id, request.type, request.difficulty);
      return { ok: true, handle };
    } catch (e) {
      error('spawn failed', e);
      return { ok: false, error: 'spawn failed: ' + (e instanceof Error ? e.message : String(e)) };
    }
  },

  despawn(handle: BotHandle): boolean {
    const bot = findBot(handle);
    if (!bot) return false;
    invalidateList();
    try {
      // disconnect() is a SimulatedPlayer method; Player does not declare it
      (bot as unknown as { disconnect?: () => void }).disconnect?.();
      return true;
    } catch {
      try {
        bot.remove();
        return true;
      } catch {
        return false;
      }
    }
  },

  list(): BotHandle[] {
    const tick = currentTick();
    if (tick - listCache.tick < LIST_TTL && listCache.bots.length > 0) return listCache.bots;
    const bots = rawPlayers()
      .filter(p => p.hasTag(BOT_TAG))
      .map(p => {
        let type = 'sword';
        let difficulty: Difficulty = 'medium';
        try {
          const raw = p.getDynamicProperty('bot_data');
          if (typeof raw === 'string') {
            const data = JSON.parse(raw) as { type?: string; difficulty?: number };
            type = data.type ?? type;
            const reverse = (Object.keys(DIFFICULTY_VALUE) as Difficulty[]).find(k => DIFFICULTY_VALUE[k] === data.difficulty);
            difficulty = reverse ?? difficulty;
          }
        } catch {
          /* keep defaults */
        }
        return {
          id: p.id,
          provider: 'petstore',
          name: p.nameTag,
          type,
          difficulty,
          spawnedTick: 0,
        } satisfies BotHandle;
      });
    listCache = { tick, bots };
    return bots;
  },

  setDifficulty(handle: BotHandle, difficulty: Difficulty): boolean {
    const bot = findBot(handle);
    if (!bot) return false;
    try {
      const raw = bot.getDynamicProperty('bot_data');
      if (typeof raw !== 'string') return false;
      const data = JSON.parse(raw) as Record<string, unknown>;
      data.difficulty = DIFFICULTY_VALUE[difficulty] ?? 2;
      bot.setDynamicProperty('bot_data', JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  },

  applyInventory(handle: BotHandle, items: string[]): boolean {
    const bot = findBot(handle);
    if (!bot) return false;
    return applyInventory(bot, items, cfg.get<boolean>('bridge.clearInventory'));
  },
};

export { entityById };
