/** Thin JSON-over-dynamic-properties helpers. Every key is namespaced by callers. */
import { world } from '@minecraft/server';
import { error } from './log';

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = world.getDynamicProperty(key);
    if (typeof raw !== 'string') return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    world.setDynamicProperty(key, JSON.stringify(value));
  } catch (e) {
    error('failed to write ' + key, e);
  }
}

export function removeKey(key: string): void {
  try {
    world.setDynamicProperty(key, undefined);
  } catch (e) {
    error('failed to remove ' + key, e);
  }
}

export function keysWithPrefix(prefix: string): string[] {
  try {
    return world.getDynamicPropertyIds().filter(k => k.startsWith(prefix));
  } catch {
    return [];
  }
}
