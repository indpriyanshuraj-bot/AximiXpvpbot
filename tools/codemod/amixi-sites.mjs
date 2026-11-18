#!/usr/bin/env node
/**
 * Patch a *local copy* of the Amixi behaviour pack so its hardcoded coordinates
 * come from the Practice Bridge, with the original literals as fallbacks.
 *
 * Nothing here redistributes Amixi: it rewrites files on your machine, in
 * place, and keeps a .pba-original backup. If the bridge is not installed the
 * shim degrades to the original values, so the pack behaves exactly as before.
 *
 *   node tools/codemod/amixi-sites.mjs --pack "/path/to/Behavior pack"
 *   node tools/codemod/amixi-sites.mjs --pack "..." --dry
 */
import fs from 'node:fs';
import path from 'node:path';
import { patchAmixiConfig } from './lib.mjs';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const packIndex = args.indexOf('--pack');
const packPath = packIndex >= 0 ? args[packIndex + 1] : args.find(a => !a.startsWith('--'));

if (!packPath) {
  console.error('usage: node tools/codemod/amixi-sites.mjs --pack "<Behaviour pack folder>" [--dry]');
  process.exit(1);
}

const scriptPath = path.join(packPath, 'scripts', 'config.js');
if (!fs.existsSync(scriptPath)) {
  console.error('not an Amixi behaviour pack: ' + scriptPath + ' not found');
  process.exit(1);
}

const original = fs.readFileSync(scriptPath, 'utf8');
const { source, report, leftovers } = patchAmixiConfig(original);

console.log(`\nAmixi site patch ${dry ? '(dry run)' : ''}`);
console.log('  file: ' + scriptPath);
for (const row of report) {
  const mark = row.status === 'patched' || row.status === 'injected' ? '\u2714'
    : row.status === 'already patched' || row.status === 'already present' ? '\u2022' : '\u2716';
  console.log(`  ${mark} ${row.label.padEnd(32)} ${String(row.count).padStart(2)}  ${row.status}`);
}
console.log('\n  remaining hardcoded spots (left alone on purpose, edit the codemod to cover them):');
console.log(`    y: 200 lift hack        ${leftovers.hardcodedY200}`);
console.log(`    summon bot:pvp 2000 ... ${leftovers.summonCoords}`);
console.log(`    .teleport() calls total ${leftovers.teleports}`);

if (dry) {
  console.log('\n  dry run: nothing written');
  process.exit(0);
}

const backup = scriptPath + '.pba-original';
if (!fs.existsSync(backup)) {
  fs.writeFileSync(backup, original);
  console.log('\n  backup written to ' + path.basename(backup));
}
fs.writeFileSync(scriptPath, source);
console.log('  patched in place. Re-run with --dry any time to see what would change.\n');
