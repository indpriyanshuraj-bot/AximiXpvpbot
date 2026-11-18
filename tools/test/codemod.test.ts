import fs from 'node:fs';
import path from 'node:path';
import { patchAmixiConfig } from '../../tools/codemod/lib.mjs';

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

const fixturePath = path.join(process.cwd(), 'tools/test/fixtures/amixi-config-sample.js');
const fixture = fs.readFileSync(fixturePath, 'utf8');

console.log('\ncodemod');
const first = patchAmixiConfig(fixture);
const patched = first.report.filter(r => r.status === 'patched' || r.status === 'injected').length;
check('all 12 edits applied', patched === 12, first.report.filter(r => r.count === 0).map(r => r.label));
check('shim injected once', (first.source.match(/practice-bridge shim/g) ?? []).length === 2, 'marker pair');
check('helper injected inside worldLoad', first.source.includes('function delblock6xAt'));
check('tables patched after definition',
  first.source.indexOf("SITES.patchMaps(bridgeFFAMaps, 'bridge')") > first.source.indexOf('const bridgeFFAMaps'),
  'order');
check('courses patched', first.source.includes("SITES.patchCourses(blockParkourCourses, 'parkour')"));
check('lobby teleport rewritten', first.source.includes("SITES.at('lobby', { x: 0.5, y: 200, z: 0.5 })"));
check('spaced variant rewritten', first.source.includes("SITES.at('lobby_facing', { x: 0.5, y: 200, z: -0.5 }) }"));
check('ffa spawn rewritten', first.source.includes("SITES.at('ffa_spawn', { x: 500.5, y: 100, z: 500.5 })"));
check('clutch arena rewritten', first.source.includes("SITES.at('clutch_arena', { x: 1998.5, y: 100, z: 501.5 })"));
check('clutch blocks call rewritten', first.source.includes('delblock6xAt(hurtEntity, SITES.at(\'clutch_blocks\''));
check('speedbridge literal rewritten', first.source.includes("SITES.at('speedbridge_origin', { x: 1000.5, y: 102, z: -5499.5 })"));
check('speedbridge expression rewritten', !first.source.includes('z: -5500 + 0.5'));
check('fallbacks keep the original literals', first.source.includes('at: (id, fallback) => fallback'));

const second = patchAmixiConfig(first.source);
const reapplied = second.report.filter(r => r.status === 'patched' || r.status === 'injected');
const already = second.report.filter(r => r.status === 'already present' || r.status === 'already patched');
check('idempotent: second pass changes nothing', second.source === first.source, reapplied.map(r => r.label));
check('idempotent: no edit is applied twice', reapplied.length === 0, reapplied.map(r => r.label));
check('idempotent: every edit is recognised as already done', already.length === 12, second.report.map(r => r.status));
check('idempotent: nothing reported missing', second.report.every(r => r.status !== 'not found'), second.report.filter(r => r.status === 'not found'));

const leftovers = first.leftovers;
check('reports the y:200 lift hack', leftovers.hardcodedY200 > 0, leftovers.hardcodedY200);
check('reports the summon site', leftovers.summonCoords === 1, leftovers.summonCoords);

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exitCode = 1;
