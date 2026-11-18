import { clear } from './stub-server';
import * as actions from '../../src/bridge/actions';
import * as sites from '../../src/bridge/api/sites';
import type { Player } from '@minecraft/server';

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

const fakePlayer = {
  id: 'p1',
  name: 'Tester',
  location: { x: 12.5, y: 70, z: -3.5 },
  dimension: { id: 'overworld' },
} as unknown as Player;

console.log('\nactions');
clear();

check('lists every site', actions.listSites().message.split('\n').length === 6);
check('unknown site rejected with the valid ids',
  actions.setSite(fakePlayer, 'nowhere').ok === false &&
  actions.setSite(fakePlayer, 'nowhere').message.includes('lobby'));

const here = actions.setSite(fakePlayer, 'lobby');
check('setSite with no position uses the player', here.ok && here.message.includes('12.5 70 -3.5'), here.message);
check('the override is live', sites.at('lobby', { x: 0, y: 0, z: 0 }).x === 12.5);

const explicit = actions.setSite(fakePlayer, 'ffa_spawn', '1 2 3');
check('setSite accepts coordinates', explicit.ok && sites.at('ffa_spawn', { x: 0, y: 0, z: 0 }).y === 2, explicit.message);
check('setSite rejects garbage', actions.setSite(fakePlayer, 'ffa_spawn', 'a b c').ok === false);

check('bare map tag resolves', actions.findMap('bridge0')?.id === 'bridge:bridge0');
check('full map id resolves', actions.findMap('bridge:bridge0')?.id === 'bridge:bridge0');
check('unknown map is undefined', actions.findMap('bridge99') === undefined);

const moved = actions.mapAction(fakePlayer, 'move', 'bridge0', '100 0 -50');
check('map move applies', moved.ok && sites.mapSites().find(m => m.id === 'bridge:bridge0')!.fields.tp!.x === 3600.5, moved.message);

const tp = actions.mapAction(fakePlayer, 'tp', 'bridge:bridge0');
check('map tp uses the player position', tp.ok && sites.mapSites().find(m => m.id === 'bridge:bridge0')!.fields.tp!.x === 12.5, tp.message);

check('map action rejects nonsense', actions.mapAction(fakePlayer, 'explode', 'bridge0').ok === false);
check('map move needs an offset', actions.mapAction(fakePlayer, 'move', 'bridge0').ok === false);

const resetOne = actions.resetSites('bridge0');
check('reset one map by tag', resetOne.ok && sites.mapSites().find(m => m.id === 'bridge:bridge0')!.fields.tp!.x === 3500.5, resetOne.message);

const resetAll = actions.resetSites('all');
check('reset all clears overrides', resetAll.ok && sites.editedCount() === 0, resetAll.message);
check('reset with no target behaves like all', actions.resetSites(undefined).ok === true);

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exitCode = 1;
