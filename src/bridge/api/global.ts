/**
 * The standard API, published on globalThis.
 *
 * Bedrock runs every behaviour pack's script in the same JS realm, so a
 * patched pack can call into this object directly — synchronously, with no
 * scriptevent round trip. The object is also the contract other addons can
 * rely on, which is why it is versioned and deliberately small.
 *
 * A caller must always tolerate it being absent:
 *   const sites = globalThis.__pba?.sites;
 *   const pos = sites ? sites.at('lobby', { x: 0.5, y: 200, z: 0.5 }) : { x: 0.5, y: 200, z: 0.5 };
 */
import * as bots from './bots';
import * as config from './config';
import * as registry from './registry';
import * as sites from './sites';

export const API_VERSION = 1;

export interface PbaApi {
  api: number;
  version: string;
  sites: {
    at(id: string, fallback: { x: number; y: number; z: number }): { x: number; y: number; z: number };
    list(): ReturnType<typeof sites.fixedSites>;
    maps(kind?: sites.MapKind): ReturnType<typeof sites.mapSites>;
    patchMaps(list: unknown, kind: sites.MapKind): number;
    patchCourses(courses: unknown, kind: sites.MapKind): number;
    edited(): number;
  };
  bots: {
    spawn(request: Parameters<typeof bots.spawn>[0]): ReturnType<typeof bots.spawn>;
    /** Called by patched Amixi instead of `summon bot:pvp`. */
    spawnDuel(player: unknown, variant: string, location: { x: number; y: number; z: number }): ReturnType<typeof bots.spawn>;
    despawn(id: string): boolean;
    despawnNear(location: { x: number; y: number; z: number }, radius?: number, dimensionId?: string): number;
    despawnAll(): number;
    list(): ReturnType<typeof bots.list>;
    mode(player: unknown): string;
  };
  config: {
    get(key: string): boolean | number | string;
    set(key: string, value: unknown): ReturnType<typeof config.set>;
  };
  registry: {
    list(kind: string): ReturnType<typeof registry.list>;
    everything(): ReturnType<typeof registry.everything>;
  };
}

let installed: PbaApi | undefined;

export function install(version: string): PbaApi {
  const api: PbaApi = {
    api: API_VERSION,
    version,
    sites: {
      at: sites.at,
      list: sites.fixedSites,
      maps: sites.mapSites,
      patchMaps: sites.patchMaps,
      patchCourses: sites.patchCourses,
      edited: sites.editedCount,
    },
    bots: {
      spawn: bots.spawn,
      spawnDuel: bots.spawnDuel,
      despawn: bots.despawn,
      despawnNear: bots.despawnNear,
      despawnAll: bots.despawnAll,
      list: bots.list,
      mode: bots.modeOf,
    },
    config: {
      get: config.get,
      set: config.set,
    },
    registry: {
      list: registry.list,
      everything: registry.everything,
    },
  };
  (globalThis as unknown as { __pba?: PbaApi }).__pba = api;
  installed = api;
  return api;
}

export function current(): PbaApi | undefined {
  return installed ?? (globalThis as unknown as { __pba?: PbaApi }).__pba;
}
