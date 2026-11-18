/**
 * Entry point. Boot order:
 *   1. publish the API on globalThis  (so other packs can read it at any time)
 *   2. on worldLoad: registry entries, provider probe, log banner
 *   3. commands + script events
 *   4. a 1-tick janitor for bot bookkeeping
 */
import { system, world } from '@minecraft/server';
import * as bots from './api/bots';
import * as cfg from './api/config';
import * as registry from './api/registry';
import * as sites from './api/sites';
import { install, API_VERSION } from './api/global';
import { registerCustomCommands, subscribeScriptEvents } from './commands';
import { petstoreProvider } from './providers/petstore';
import { debug, error, log, setVerbose } from '../shared/log';

const VERSION = '0.2.0';

install(VERSION);
registerCustomCommands();
subscribeScriptEvents();

world.afterEvents.worldLoad.subscribe(() => {
  try {
    setVerbose(cfg.get<boolean>('bridge.log'));

    const available = petstoreProvider.available();
    registry.publish({
      kind: 'provider',
      id: petstoreProvider.id,
      label: 'PvP Practice Bots',
      provider: 'pba-bridge',
      version: 1,
      caps: available ? petstoreProvider.caps : [],
      meta: { available },
    });

    for (const site of sites.fixedSites()) {
      registry.publish({
        kind: 'site',
        id: site.id,
        label: site.label,
        provider: 'pba-bridge',
        version: 1,
        caps: [],
        meta: { current: site.current, edited: site.edited },
      });
    }

    log(
      `v${VERSION} api=${API_VERSION} provider=${cfg.get('bridge.provider')} ` +
      `petstore=${available ? 'ready' : 'not detected'} sites=${sites.fixedSites().length} ` +
      `maps=${sites.mapSites().length} edited=${sites.editedCount()}`,
    );
    log('admin: /pba:menu (or /scriptevent pbac:menu). docs/commands.md has the full syntax.');

    if (!available) {
      log('PvP Practice Bots not detected: spawn requests will fail until it is installed with Beta APIs on.');
    }
  } catch (e) {
    error('worldLoad init failed', e);
  }
});

system.runInterval(() => {
  try {
    bots.tick();
  } catch (e) {
    debug('janitor failed', e);
  }
}, 20);
