/**
 * The global list. Any installed pack may publish entries here; the bridge
 * merges them with its own and hands the union to whoever asks (the sites UI,
 * a queue menu, another addon through `globalThis.__pba`).
 *
 * Entry key: pba:reg:<kind>:<id>
 */
import { keysWithPrefix, readJson, removeKey, writeJson } from '../../shared/dp';

export type RegistryKind = 'provider' | 'kit' | 'mode' | 'map' | 'site' | string;

export interface RegistryEntry {
  kind: RegistryKind;
  id: string;
  label: string;
  provider: string;
  version: number;
  caps: string[];
  meta?: Record<string, unknown>;
}

const PREFIX = 'pba:reg:';

function keyFor(kind: string, id: string): string {
  return `${PREFIX}${kind}:${id}`;
}

export function publish(entry: RegistryEntry): void {
  writeJson(keyFor(entry.kind, entry.id), { ...entry, publishedAt: Date.now() });
}

export function unpublish(kind: string, id: string): void {
  removeKey(keyFor(kind, id));
}

export function list(kind: string): RegistryEntry[] {
  const out: RegistryEntry[] = [];
  for (const key of keysWithPrefix(`${PREFIX}${kind}:`)) {
    const entry = readJson<RegistryEntry | null>(key, null);
    if (entry && typeof entry.id === 'string') out.push(entry);
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

export function kinds(): string[] {
  const seen = new Set<string>();
  for (const key of keysWithPrefix(PREFIX)) {
    const rest = key.slice(PREFIX.length);
    const kind = rest.slice(0, rest.indexOf(':'));
    if (kind) seen.add(kind);
  }
  return [...seen].sort();
}

export function everything(): Record<string, RegistryEntry[]> {
  const out: Record<string, RegistryEntry[]> = {};
  for (const kind of kinds()) out[kind] = list(kind);
  return out;
}
