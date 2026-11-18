/** Minimal in-memory stand-in for @minecraft/server, used by the unit tests. */
const props = new Map<string, string | number | boolean>();

export const world = {
  getDynamicProperty(key: string) {
    return props.get(key);
  },
  setDynamicProperty(key: string, value: unknown) {
    if (value === undefined) props.delete(key);
    else props.set(key, value as string | number | boolean);
  },
  getDynamicPropertyIds() {
    return [...props.keys()];
  },
  getDynamicPropertyTotalByteCount() {
    return [...props.values()].join('').length;
  },
  getDimension(id: string) {
    return { id };
  },
  getAllPlayers() {
    return players as never[];
  },
  getPlayers() {
    return players as never[];
  },
  getEntity(id: string) {
    return players.find(p => p.id === id);
  },
};

export const system = {
  currentTick: 0,
  runInterval: () => 0,
  runTimeout: () => 0,
  run: (fn: () => void) => fn(),
  afterEvents: { scriptEventReceive: { subscribe: () => {} } },
  beforeEvents: { startup: { subscribe: () => {} } },
};

let players: Array<{ id: string }> = [];

export function setPlayers(next: Array<{ id: string }>): void {
  players = next;
}

export function clear() {
  props.clear();
  players = [];
}

export class ItemStack {
  constructor(public typeId: string, public amount = 1) {}
}

export const EquipmentSlot = { Head: 'Head', Chest: 'Chest', Legs: 'Legs', Feet: 'Feet', Offhand: 'Offhand' } as const;
export const GameMode = { Survival: 'Survival' } as const;
export class Player {}
