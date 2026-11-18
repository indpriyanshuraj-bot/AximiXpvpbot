/**
 * One implementation per admin action, shared by the custom commands and the
 * script-event fallback so the two surfaces can never drift apart.
 *
 * Every action returns a plain result; the caller decides how to show it.
 */
import type { Player } from '@minecraft/server';
import * as bots from './api/bots';
import * as cfg from './api/config';
import * as sites from './api/sites';
import { format, parseVec, type Vec3 } from '../shared/vec';

export interface ActionResult {
  ok: boolean;
  message: string;
}

const ok = (message: string): ActionResult => ({ ok: true, message });
const fail = (message: string): ActionResult => ({ ok: false, message });

function posOf(player: Player | undefined): Vec3 | undefined {
  return player ? { x: player.location.x, y: player.location.y, z: player.location.z } : undefined;
}

function parseVecText(text: string | undefined): Vec3 | undefined {
  if (!text) return undefined;
  return parseVec(text) ?? undefined;
}

export function listSites(): ActionResult {
  const lines = sites.fixedSites().map(s => `${s.id} = ${format(s.current)}${s.edited ? ' *' : ''}`);
  return ok(lines.join('\n'));
}

export function listMaps(kind?: sites.MapKind): ActionResult {
  const lines = sites.mapSites(kind).map(m => {
    const anchor = m.fields.tp ?? Object.values(m.fields)[0];
    return `${m.id} = ${anchor ? format(anchor) : '?'}${m.edited ? ' *' : ''}`;
  });
  return ok(lines.join('\n'));
}

export function setSite(
  player: Player | undefined,
  id: string,
  position?: Vec3 | string,
): ActionResult {
  const known = sites.fixedSites().find(s => s.id === id);
  if (!known) {
    return fail(`unknown site "${id}". Try: ${sites.fixedSites().map(s => s.id).join(', ')}`);
  }
  const value = typeof position === 'string' ? parseVecText(position) : position ?? posOf(player);
  if (!value) return fail('give three numbers, or stand where you want the site');
  if (!sites.setFixed(id, value)) return fail('could not save ' + id);
  return ok(`${id} = ${format(value)}`);
}

/** Accepts "bridge:bridge0" or the bare tag "bridge0" when it is unambiguous. */
export function findMap(id: string): sites.MapSite | undefined {
  const all = sites.mapSites();
  const exact = all.find(m => m.id === id);
  if (exact) return exact;
  const byTag = all.filter(m => m.id.endsWith(':' + id));
  return byTag.length === 1 ? byTag[0] : undefined;
}

export function mapAction(
  player: Player | undefined,
  action: string,
  id: string,
  arg?: Vec3 | string,
): ActionResult {
  const map = findMap(id);
  if (!map) return fail(`unknown map "${id}". Try /scriptevent pbac:maps`);

  if (action === 'reset') {
    sites.resetMap(map.id);
    return ok(`${map.id} reset`);
  }
  if (action === 'tp' || action === 'spawn') {
    const value = typeof arg === 'string' ? parseVecText(arg) : arg ?? posOf(player);
    if (!value) return fail('stand somewhere, or give three numbers');
    if (!sites.setMapField(map.id, 'tp', value)) return fail('could not set spawn for ' + map.id);
    return ok(`${map.id} spawn = ${format(value)}`);
  }
  if (action === 'move') {
    const delta = typeof arg === 'string' ? parseVecText(arg) : arg;
    if (!delta) return fail('move needs an offset: /pba:map move <id> <dx> <dy> <dz>');
    if (!sites.moveMap(map.id, delta)) return fail('could not move ' + map.id);
    return ok(`${map.id} moved by ${format(delta)}`);
  }
  return fail('action must be move, tp or reset');
}

export function resetSites(target: string | undefined): ActionResult {
  if (target && target !== 'all') {
    if (sites.fixedSites().some(s => s.id === target)) {
      sites.resetFixed(target);
      return ok(`${target} reset`);
    }
    const map = findMap(target);
    if (map) {
      sites.resetMap(map.id);
      return ok(`${map.id} reset`);
    }
    return fail(`unknown site or map "${target}"`);
  }
  const n = sites.resetAll();
  return ok(`cleared ${n} override(s); everything is back to the Amixi defaults`);
}

export function spawnBot(player: Player | undefined, difficulty?: string, type?: string): ActionResult {
  if (!player) return fail('run this as a player');
  const result = bots.spawn({
    dimension: player.dimension.id,
    location: { ...player.location },
    difficulty: (difficulty as never) ?? (cfg.get<string>('bridge.difficulty') as never),
    type: type ?? cfg.get<string>('bridge.type'),
    targetId: player.id,
  });
  return result.ok ? ok(`spawned ${result.provider} bot ${result.id}`) : fail(result.error ?? 'spawn failed');
}

export function clearBots(): ActionResult {
  return ok(`removed ${bots.despawnAll()} bot(s)`);
}

export function status(): ActionResult {
  const live = bots.list();
  const provider = cfg.get<string>('bridge.provider');
  const head = `provider ${provider}, bots ${live.length}, sites edited ${sites.editedCount()}`;
  if (live.length === 0) return ok(head);
  const rows = live.slice(0, 8).map(b => `${b.type} ${b.difficulty} ${b.id.slice(0, 8)}`);
  return ok(head + '\n' + rows.join('\n'));
}

export function setConfig(key: string, value: string): ActionResult {
  const outcome = cfg.set(key, value);
  return outcome.ok ? ok(`${key} = ${String(outcome.value)}`) : fail(outcome.error ?? 'failed');
}

export function listConfig(): ActionResult {
  return ok(cfg.all().map(({ node, value }) => `${node.key} = ${String(value)}`).join('\n'));
}

export { posOf };
