/**
 * Sites: the coordinates Amixi hardcodes, exposed as editable values.
 *
 * Two kinds:
 *   fixed  — a single point (lobby, FFA spawn, clutch arena, ...)
 *   maps   — a table entry with several points (pos / tp / facing / clear)
 *
 * Storage:
 *   pba:site:<id>   -> { x, y, z }
 *   pba:map:<id>    -> { pos?: Vec3, tp?: Vec3, facing?: Vec3, clear?: Vec3 }
 *
 * The patched Amixi calls `sites.at(id, fallback)` and gets the fallback back
 * whenever this pack is missing or the admin never edited anything. That is
 * what keeps compatibility honest: defaults are the original literals.
 */
import { keysWithPrefix, readJson, removeKey, writeJson } from '../../shared/dp';
import type { Vec3 } from '../../shared/vec';
import { copy, isVec3, round } from '../../shared/vec';
import { FIXED_DEFAULTS, MAP_DEFAULTS } from './site-defaults';

export type MapKind = 'bridge' | 'speedbridge' | 'parkour';

const FIXED_KEY = 'pba:site:';
const MAP_KEY = 'pba:map:';

export interface FixedSite {
  id: string;
  label: string;
  def: Vec3;
  current: Vec3;
  edited: boolean;
}

export interface MapSite {
  id: string;
  kind: MapKind;
  label: string;
  fields: Record<string, Vec3>;
  edited: boolean;
}

const fixedById = new Map(FIXED_DEFAULTS.map(s => [s.id, s]));
const mapById = new Map(MAP_DEFAULTS.map(m => [m.id, m]));

/**
 * Read cache. `at()` sits in teleport paths, so it must not touch dynamic
 * properties on every call. Every write goes through this module, so local
 * invalidation is sufficient; a write from another pack would be seen on the
 * next world load, which is an acceptable trade for the call frequency.
 */
const fixedCache = new Map<string, Vec3 | null>();
const mapCache = new Map<string, Record<string, Vec3>>();

function invalidateFixed(id?: string): void {
  if (id === undefined) fixedCache.clear();
  else fixedCache.delete(id);
}

function invalidateMap(id?: string): void {
  if (id === undefined) mapCache.clear();
  else mapCache.delete(id);
}

function readFixed(id: string): Vec3 | null {
  if (fixedCache.has(id)) return fixedCache.get(id) ?? null;
  const stored = readJson<Vec3 | null>(FIXED_KEY + id, null);
  const value = isVec3(stored) ? stored : null;
  fixedCache.set(id, value);
  return value;
}

// ------------------------------------------------------------------- fixed

export function fixedSites(): FixedSite[] {
  return FIXED_DEFAULTS.map(s => {
    const stored = readFixed(s.id);
    return {
      id: s.id,
      label: s.label,
      def: s.def,
      current: stored ? copy(stored) : s.def,
      edited: stored !== null,
    };
  });
}

export function getFixed(id: string, fallback?: Vec3): Vec3 {
  const stored = readFixed(id);
  if (stored) return copy(stored);
  if (fallback) return copy(fallback);
  const def = fixedById.get(id)?.def;
  return def ? copy(def) : { x: 0, y: 0, z: 0 };
}

/** The call the patched Amixi makes: always safe, always returns a vector. */
export function at(id: string, fallback: Vec3): Vec3 {
  return getFixed(id, fallback);
}

export function setFixed(id: string, value: Vec3): boolean {
  if (!fixedById.has(id) || !isVec3(value)) return false;
  writeJson(FIXED_KEY + id, round(value));
  invalidateFixed(id);
  return true;
}

export function resetFixed(id: string): void {
  removeKey(FIXED_KEY + id);
  invalidateFixed(id);
}

// -------------------------------------------------------------------- maps

export function mapSites(kind?: MapKind): MapSite[] {
  return MAP_DEFAULTS
    .filter(m => (kind ? m.kind === kind : true))
    .map(m => {
      const stored = getMapOverride(m.id);
      const fields: Record<string, Vec3> = {};
      for (const [field, def] of Object.entries(m.fields)) {
        const override = stored[field];
        fields[field] = isVec3(override) ? copy(override) : copy(def);
      }
      return { id: m.id, kind: m.kind, label: m.label, fields, edited: Object.keys(stored).length > 0 };
    });
}

export function getMapOverride(id: string): Record<string, Vec3> {
  const cached = mapCache.get(id);
  if (cached) return cached;
  const stored = readJson<Record<string, Vec3>>(MAP_KEY + id, {});
  const out: Record<string, Vec3> = {};
  for (const [field, value] of Object.entries(stored)) {
    if (isVec3(value)) out[field] = copy(value);
  }
  mapCache.set(id, out);
  return out;
}

export function setMapField(id: string, field: string, value: Vec3): boolean {
  const entry = mapById.get(id);
  if (!entry || !(field in entry.fields) || !isVec3(value)) return false;
  const stored = getMapOverride(id);
  stored[field] = round(value);
  writeJson(MAP_KEY + id, stored);
  invalidateMap(id);
  return true;
}

/** Shift every point of a map by the same delta — the practical way to relocate one. */
export function moveMap(id: string, delta: Vec3): boolean {
  const entry = mapById.get(id);
  if (!entry || !isVec3(delta)) return false;
  const stored = getMapOverride(id);
  for (const [field, def] of Object.entries(entry.fields)) {
    const base = stored[field] ?? def;
    stored[field] = round({ x: base.x + delta.x, y: base.y + delta.y, z: base.z + delta.z });
  }
  writeJson(MAP_KEY + id, stored);
  invalidateMap(id);
  return true;
}

export function resetMap(id: string): void {
  removeKey(MAP_KEY + id);
  invalidateMap(id);
}

export function resetAll(): number {
  let n = 0;
  for (const key of [...keysWithPrefix(FIXED_KEY), ...keysWithPrefix(MAP_KEY)]) {
    removeKey(key);
    n++;
  }
  invalidateFixed();
  invalidateMap();
  return n;
}

/** Exposed for tests and for a future "reload from disk" command. */
export function invalidateAll(): void {
  invalidateFixed();
  invalidateMap();
}

// --------------------------------------------------- patching Amixi's tables

/**
 * Mutates an Amixi table in place. Called by the injected shim, so it must be
 * defensive: a bad override should never stop Amixi from starting.
 */
export function patchMaps(list: unknown, kind: MapKind): number {
  if (!Array.isArray(list)) return 0;
  let patched = 0;
  for (const entry of list) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const tag = typeof record.tag === 'string' ? record.tag : undefined;
    if (!tag) continue;
    const override = getMapOverride(`${kind}:${tag}`);
    for (const [field, value] of Object.entries(override)) {
      record[field] = copy(value);
      patched++;
    }
  }
  return patched;
}

export function patchCourses(courses: unknown, kind: MapKind): number {
  if (typeof courses !== 'object' || courses === null) return 0;
  let patched = 0;
  for (const [key, entry] of Object.entries(courses as Record<string, unknown>)) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const tag = typeof record.tag === 'string' ? record.tag : key;
    const override = getMapOverride(`${kind}:${tag}`);
    for (const [field, value] of Object.entries(override)) {
      record[field] = copy(value);
      patched++;
    }
  }
  return patched;
}

/** Used by the UI to warn about edits that point at nothing. */
export function editedCount(): number {
  return keysWithPrefix(FIXED_KEY).length + keysWithPrefix(MAP_KEY).length;
}
