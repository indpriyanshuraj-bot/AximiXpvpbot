#!/usr/bin/env node
/**
 * Regenerate src/bridge/api/site-defaults.ts from a local Amixi pack.
 * Run this after an Amixi update so the defaults still match what ships.
 *
 *   node tools/codemod/extract-defaults.mjs --pack "<Behaviour pack folder>"
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const index = args.indexOf('--pack');
const packPath = index >= 0 ? args[index + 1] : args.find(a => !a.startsWith('--'));
if (!packPath) {
  console.error('usage: node tools/codemod/extract-defaults.mjs --pack "<Behaviour pack folder>"');
  process.exit(1);
}

const source = fs.readFileSync(path.join(packPath, 'scripts', 'config.js'), 'utf8').replace(/\r\n/g, '\n');

function block(marker) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error('missing ' + marker);
  const openIndex = Math.min(
    ...[source.indexOf('[', start), source.indexOf('{', start)].filter(i => i >= 0),
  );
  const open = source[openIndex];
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  let inString = null;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (ch === '\\') { i++; continue; }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { inString = ch; continue; }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return source.slice(openIndex, i + 1);
    }
  }
  throw new Error('unbalanced ' + marker);
}

const bridge = eval(block('const bridgeFFAMaps ='));
const speed = eval(block('const speedbridgeConfigs ='));
const parkour = eval('(' + block('const blockParkourCourses =') + ')');

const vec = v => `{ x: ${v.x}, y: ${v.y}, z: ${v.z} }`;
const lines = [];
lines.push('/**');
lines.push(" * GENERATED from the Amixi pack's own data tables (scripts/config.js).");
lines.push(' * These are the shipped defaults: if an admin never edits anything, the');
lines.push(' * patched pack behaves exactly like the original.');
lines.push(' * Regenerate with: node tools/codemod/extract-defaults.mjs <path to Amixi BP>');
lines.push(' */');
lines.push("import type { Vec3 } from '../../shared/vec';");
lines.push("import type { MapKind } from './sites';");
lines.push('');
lines.push('export interface FixedDefault {');
lines.push('  id: string;');
lines.push('  label: string;');
lines.push('  def: Vec3;');
lines.push('}');
lines.push('');
lines.push('export interface MapDefault {');
lines.push('  id: string;');
lines.push('  kind: MapKind;');
lines.push('  label: string;');
lines.push('  fields: Record<string, Vec3>;');
lines.push('}');
lines.push('');
lines.push('export const FIXED_DEFAULTS: FixedDefault[] = [');
const fixed = [
  ['lobby', 'Lobby spawn', { x: 0.5, y: 200, z: 0.5 }],
  ['lobby_facing', 'Lobby facing point', { x: 0.5, y: 200, z: -0.5 }],
  ['ffa_spawn', 'FFA spawn', { x: 500.5, y: 100, z: 500.5 }],
  ['clutch_arena', 'Clutch arena spawn', { x: 1998.5, y: 100, z: 501.5 }],
  ['clutch_blocks', 'Clutch block origin', { x: 2000, y: 100, z: 500 }],
  ['speedbridge_origin', 'Speed-bridge default origin', { x: 1000.5, y: 102, z: -5499.5 }],
];
for (const [id, label, def] of fixed) lines.push(`  { id: '${id}', label: '${label}', def: ${vec(def)} },`);
lines.push('];');
lines.push('');
lines.push('export const MAP_DEFAULTS: MapDefault[] = [');
const push = (kind, id, label, fields) => {
  const body = Object.entries(fields).map(([k, v]) => `${k}: ${vec(v)}`).join(', ');
  lines.push(`  { id: '${kind}:${id}', kind: '${kind}', label: '${label}', fields: { ${body} } },`);
};
for (const map of bridge) push('bridge', map.tag, map.name, { pos: map.pos, tp: map.tp, facing: map.facing });
speed.forEach((map, i) => push('speedbridge', map.tag, `Layout ${i + 1} (${map.tag})`, { pos: map.pos, tp: map.tp, facing: map.facing }));
for (const [key, course] of Object.entries(parkour)) {
  push('parkour', key, `Course ${key.replace('course', '')}`, { tp: course.tp, facing: course.facing, clear: course.clear });
}
lines.push('];');
lines.push('');

const out = path.join(process.cwd(), 'src/bridge/api/site-defaults.ts');
fs.writeFileSync(out, lines.join('\n'));
console.log(`wrote ${out}: ${bridge.length} bridge maps, ${speed.length} speedbridge layouts, ${Object.keys(parkour).length} parkour courses`);
