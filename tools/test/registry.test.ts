import { clear } from './stub-server';
import * as registry from '../../src/bridge/api/registry';
import * as cfg from '../../src/bridge/api/config';

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    passed++;
    console.log('  ok   ' + name);
  } else {
    failed++;
    console.log('  FAIL ' + name + (detail === undefined ? '' : ' -> ' + JSON.stringify(detail)));
  }
}

console.log('\nregistry');
clear();

registry.publish({ kind: 'provider', id: 'petstore', label: 'PvP Practice Bots', provider: 'pba-bridge', version: 1, caps: ['spawn'] });
registry.publish({ kind: 'site', id: 'lobby', label: 'Lobby', provider: 'pba-bridge', version: 1, caps: [] });
registry.publish({ kind: 'site', id: 'ffa_spawn', label: 'FFA', provider: 'pba-bridge', version: 1, caps: [] });

check('list by kind', registry.list('site').length === 2);
check('sorted by label', registry.list('site')[0]!.id === 'ffa_spawn', registry.list('site').map(s => s.id));
check('kinds discovered', registry.kinds().join(',') === 'provider,site', registry.kinds());
check('everything groups', Object.keys(registry.everything()).length === 2);

registry.publish({ kind: 'site', id: 'lobby', label: 'Lobby v2', provider: 'pba-bridge', version: 2, caps: [] });
check('republish overwrites', registry.list('site').find(s => s.id === 'lobby')!.label === 'Lobby v2');

registry.unpublish('site', 'lobby');
check('unpublish removes', registry.list('site').length === 1);

console.log('\nconfig');
clear();
check('provider default', cfg.get('bridge.provider') === 'petstore');
check('enum rejects unknown', cfg.set('bridge.provider', 'wat').ok === false);
check('bool coerces from string', cfg.set('bridge.log', 'true').ok && cfg.get('bridge.log') === true);
check('int rounds', cfg.set('bridge.maxBots', 7.6).ok && cfg.get('bridge.maxBots') === 8);
check('int floor respected', cfg.set('bridge.maxBots', 0).ok === false);
check('unknown key rejected', cfg.set('bridge.nope', 1).ok === false);
cfg.set('bridge.difficulty', 'hard');
check('value is cached then reset', (() => {
  cfg.reset('bridge.difficulty');
  return cfg.get('bridge.difficulty') === 'medium';
})());
check('all() covers every node', cfg.all().length === cfg.NODES.length);

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exitCode = 1;
