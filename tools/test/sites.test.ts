import { clear } from './stub-server';
import * as sites from '../../src/bridge/api/sites';
import * as cfg from '../../src/bridge/api/config';
import { parseVec, format } from '../../src/shared/vec';

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

console.log('\nsites');
clear();
const lobby = sites.fixedSites().find(s => s.id === 'lobby');
check('six fixed sites seeded from Amixi', sites.fixedSites().length === 6, sites.fixedSites().length);
check('lobby default is the Amixi literal', format(lobby!.current) === '0.5 200 0.5', lobby!.current);
// an unedited site hands back the caller's own literal, so a pack that ships
// without the bridge behaves exactly as before
check('unset site returns the caller fallback', format(sites.at('lobby', { x: 1, y: 2, z: 3 })) === '1 2 3');
check('site table still reports the Amixi default', format(sites.fixedSites()[0]!.current) === '0.5 200 0.5');

sites.setFixed('lobby', { x: 10, y: 64, z: -20 });
check('edited site wins', format(sites.at('lobby', { x: 1, y: 2, z: 3 })) === '10 64 -20');
check('edit is flagged', sites.fixedSites().find(s => s.id === 'lobby')!.edited === true);
sites.resetFixed('lobby');
check('reset drops the override', format(sites.at('lobby', { x: 9, y: 9, z: 9 })) === '9 9 9');
check('reset restores the default in the table', format(sites.fixedSites().find(s => s.id === 'lobby')!.current) === '0.5 200 0.5');

console.log('\nmap patching');
clear();
const bridgeTable = [
  { tag: 'bridge0', name: 'Void', pos: { x: 3500, y: 100, z: 2500 }, tp: { x: 3500.5, y: 100, z: 2500.5 }, facing: { x: 3500.5, y: 100, z: 2500.5 } },
  { tag: 'bridge1', name: 'House', pos: { x: 3000, y: 100, z: -5979 }, tp: { x: 3000.5, y: 100, z: -5999.5 }, facing: { x: 3000.5, y: 100, z: -5998.5 } },
];
const patchedNone = sites.patchMaps(bridgeTable, 'bridge');
check('no overrides, nothing changes', patchedNone === 0 && bridgeTable[0]!.tp.x === 3500.5, patchedNone);

sites.moveMap('bridge:bridge0', { x: 100, y: 0, z: -50 });
const patchedOne = sites.patchMaps(bridgeTable, 'bridge');
check('moveMap shifts every field', patchedOne === 3, patchedOne);
check('tp moved with the map', format(bridgeTable[0]!.tp) === '3600.5 100 2450.5', bridgeTable[0]!.tp);
check('facing moved with the map', format(bridgeTable[0]!.facing) === '3600.5 100 2450.5', bridgeTable[0]!.facing);
check('other maps untouched', bridgeTable[1]!.tp.x === 3000.5, bridgeTable[1]!.tp);

sites.setMapField('bridge:bridge1', 'tp', { x: 1, y: 2, z: 3 });
sites.patchMaps(bridgeTable, 'bridge');
check('single field override applies', format(bridgeTable[1]!.tp) === '1 2 3', bridgeTable[1]!.tp);
check('pos kept from default', bridgeTable[1]!.pos.x === 3000, bridgeTable[1]!.pos);

const courses: Record<string, any> = {
  course1: { tag: 'course1', tp: { x: 3009.5, y: 96, z: 1001.5 }, facing: { x: 3009.5, y: 96, z: 1002.5 }, clear: { x: 3009.5, y: 100, z: 1047.5 } },
};
sites.moveMap('parkour:course1', { x: 0, y: 10, z: 0 });
sites.patchCourses(courses, 'parkour');
check('courses patch by tag', courses.course1!.tp.y === 106, courses.course1!.tp);

sites.setMapField('bridge:bridge0', 'pos', { x: 1, y: 2, z: 3 });
check('unknown field rejected', sites.setMapField('bridge:bridge0', 'nope', { x: 1, y: 2, z: 3 }) === false);
check('unknown map rejected', sites.setMapField('bridge:nope', 'pos', { x: 1, y: 2, z: 3 }) === false);

console.log('\nreset');
const cleared = sites.resetAll();
check('resetAll clears overrides', cleared > 0 && sites.editedCount() === 0, cleared);

console.log('\nconfig');
clear();
check('defaults are typed', cfg.get<string>('bridge.provider') === 'petstore');
check('enum rejected', cfg.set('bridge.provider', 'nonsense').ok === false);
check('enum accepted', cfg.set('bridge.provider', 'none').ok === true && cfg.get('bridge.provider') === 'none');
check('int clamped', cfg.set('bridge.maxBots', 999).ok === false);
check('int accepted', cfg.set('bridge.maxBots', 12).ok === true && cfg.get('bridge.maxBots') === 12);
check('unknown key rejected', cfg.set('bridge.nope', 1).ok === false);

console.log('\nvec');
check('parse spaces', JSON.stringify(parseVec('1 2 3')) === '{"x":1,"y":2,"z":3}');
check('parse commas', JSON.stringify(parseVec('1,2,3')) === '{"x":1,"y":2,"z":3}');
check('parse garbage', parseVec('a b c') === null);
check('parse two numbers', parseVec('1 2') === null);

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exitCode = 1;
