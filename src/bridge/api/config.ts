/**
 * Bridge settings. Small on purpose: everything an admin might reasonably
 * change about *how bots are requested*, not about how they fight (that lives
 * in the bot pack's own tuning).
 */
import { readJson, removeKey, writeJson } from '../../shared/dp';

export type NodeType = 'bool' | 'int' | 'number' | 'enum' | 'string';

export interface ConfigNode {
  key: string;
  label: string;
  type: NodeType;
  def: boolean | number | string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  help?: string;
}

export const DIFFICULTIES = ['easy', 'medium', 'hard', 'impossible'] as const;
export const BOT_TYPES = ['sword', 'axe', 'mace', 'uhc', 'crystal', 'cart'] as const;

export const NODES: ConfigNode[] = [
  {
    key: 'bridge.provider', label: 'Bot provider', type: 'enum', def: 'petstore',
    options: [
      { value: 'petstore', label: 'PvP Practice Bots (simulated player)' },
      { value: 'none', label: 'None (spawn requests fail)' },
    ],
    help: 'Which installed addon actually creates the bot.',
  },
  {
    key: 'bridge.difficulty', label: 'Default difficulty', type: 'enum', def: 'medium',
    options: DIFFICULTIES.map(d => ({ value: d, label: d })),
  },
  {
    key: 'bridge.type', label: 'Default bot type', type: 'enum', def: 'sword',
    options: BOT_TYPES.map(t => ({ value: t, label: t })),
  },
  {
    key: 'bridge.mlDisabled', label: 'Disable bot ML brain', type: 'bool', def: true,
    help: 'Keeps the learning system out of the way for practice bots.',
  },
  {
    key: 'bridge.maxBots', label: 'Max bots this bridge will track', type: 'int', def: 8, min: 1, max: 32,
  },
  {
    key: 'bridge.clearInventory', label: 'Clear inventory before applying a kit', type: 'bool', def: true,
  },
  {
    key: 'bridge.despawnOnLeave', label: 'Despawn a bot when its target leaves', type: 'bool', def: true,
  },
  {
    key: 'bridge.log', label: 'Verbose logging', type: 'bool', def: false,
  },
];

const byKey = new Map(NODES.map(n => [n.key, n]));
const PREFIX = 'pba:cfg:';

/** Values are read on every spawn request and in the UI; cache them. */
const cache = new Map<string, boolean | number | string>();

function invalidate(key?: string): void {
  if (key === undefined) cache.clear();
  else cache.delete(key);
}

export function node(key: string): ConfigNode | undefined {
  return byKey.get(key);
}

export function get<T extends boolean | number | string>(key: string): T {
  const n = byKey.get(key);
  if (!n) return undefined as unknown as T;

  const cached = cache.get(key);
  if (cached !== undefined) return cached as T;

  const stored = readJson<unknown>(PREFIX + key, null);
  let value: boolean | number | string;
  if (stored === null || stored === undefined) {
    value = n.def;
  } else if (n.type === 'bool') {
    value = typeof stored === 'boolean' ? stored : Boolean(stored);
  } else if (n.type === 'int' || n.type === 'number') {
    const num = Number(stored);
    value = Number.isFinite(num) ? num : n.def;
  } else {
    value = String(stored);
  }
  cache.set(key, value);
  return value as T;
}

export function set(key: string, raw: unknown): { ok: boolean; error?: string; value?: unknown } {
  const n = byKey.get(key);
  if (!n) return { ok: false, error: 'unknown key ' + key };

  let value: boolean | number | string;
  if (n.type === 'bool') {
    value = typeof raw === 'boolean' ? raw : String(raw) === 'true';
  } else if (n.type === 'int' || n.type === 'number') {
    const num = Number(raw);
    if (!Number.isFinite(num)) return { ok: false, error: n.label + ' must be a number' };
    if (n.min !== undefined && num < n.min) return { ok: false, error: n.label + ' must be >= ' + n.min };
    if (n.max !== undefined && num > n.max) return { ok: false, error: n.label + ' must be <= ' + n.max };
    value = n.type === 'int' ? Math.round(num) : num;
  } else if (n.type === 'enum') {
    const allowed = n.options?.map(o => o.value) ?? [];
    if (!allowed.includes(String(raw))) return { ok: false, error: n.label + ' must be one of ' + allowed.join(', ') };
    value = String(raw);
  } else {
    value = String(raw);
  }

  writeJson(PREFIX + key, value);
  invalidate(key);
  return { ok: true, value };
}

export function reset(key: string): void {
  removeKey(PREFIX + key);
  invalidate(key);
}

export function invalidateAll(): void {
  invalidate();
}

export function all(): { node: ConfigNode; value: boolean | number | string }[] {
  return NODES.map(n => ({ node: n, value: get(n.key) }));
}
