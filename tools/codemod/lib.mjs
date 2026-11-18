/**
 * The Amixi patcher, as a pure function over source text.
 *
 * Kept separate from the CLI so the build (and the tests) can run it without
 * touching the filesystem: patchAmixiConfig(text) -> { source, report, leftovers }
 */

export const SHIM_MARKER = 'practice-bridge shim';

export function patchAmixiConfig(input) {
  let source = String(input).replace(/\r\n/g, '\n');
  const report = [];

  /**
   * Replaces a literal with a SITES.at(...) wrapper, and does nothing to
   * occurrences that are already wrapped. Without this the replacement text
   * still contains the original literal, so a second run would wrap the
   * wrapper — the patch has to be idempotent to be safe to re-run.
   */
  const replaceAll = (label, from, to, expected) => {
    let out = '';
    let cursor = 0;
    let patched = 0;
    let skipped = 0;

    for (;;) {
      const index = source.indexOf(from, cursor);
      if (index < 0) {
        out += source.slice(cursor);
        break;
      }
      const before = source.slice(Math.max(0, index - 48), index);
      if (before.includes('SITES.at(')) {
        skipped++;
        out += source.slice(cursor, index + from.length);
        cursor = index + from.length;
        continue;
      }
      out += source.slice(cursor, index) + to;
      cursor = index + from.length;
      patched++;
    }

    source = out;

    if (patched === 0) {
      const applied = source.includes(to);
      report.push({
        label,
        count: skipped,
        status: skipped > 0 || applied ? 'already present' : 'not found',
      });
      return;
    }
    if (expected !== undefined && patched !== expected) {
      report.push({ label, count: patched, status: `expected ${expected}, patching anyway` });
    } else {
      report.push({ label, count: patched, status: 'patched' });
    }
  };

const SHIM = `/* --- practice-bridge shim (injected by tools/codemod/amixi-sites.mjs) --- */
const __PBA = globalThis.__pba;
const SITES = __PBA && __PBA.sites ? __PBA.sites : {
    at: (id, fallback) => fallback,
    patchMaps: () => 0,
    patchCourses: () => 0
};
/* --- end practice-bridge shim --- */
`;

// The helper has to live inside the worldLoad callback, because delblock6x is
// declared in that scope. Injecting it at module scope would be a ReferenceError.
const INNER = `    /* practice-bridge helper */
    function delblock6xAt(source, pos) { return delblock6x(source, pos.x, pos.y, pos.z); }
`;

if (!source.includes('practice-bridge shim')) {
  const lastImport = source.lastIndexOf('\nimport ');
  const lineEnd = lastImport >= 0 ? source.indexOf('\n', source.indexOf(';', lastImport)) : -1;
  const insertAt = lineEnd >= 0 ? lineEnd + 1 : 0;
  source = source.slice(0, insertAt) + SHIM + source.slice(insertAt);
  report.push({ label: 'shim', count: 1, status: 'injected' });
} else {
  report.push({ label: 'shim', count: 1, status: 'already present' });
}

// the inner helper goes right after the worldLoad subscription opens
if (!source.includes('practice-bridge helper')) {
  const marker = 'world.afterEvents.worldLoad.subscribe(() => {';
  const at = source.indexOf(marker);
  if (at < 0) {
    report.push({ label: 'inner helper', count: 0, status: 'worldLoad marker not found' });
  } else {
    const insertAt = at + marker.length;
    source = source.slice(0, insertAt) + '\n' + INNER + source.slice(insertAt);
    report.push({ label: 'inner helper', count: 1, status: 'injected' });
  }
} else {
  report.push({ label: 'inner helper', count: 1, status: 'already present' });
}

// --------------------------------------------------- 2. patch Amixi's tables

function findBlockEnd(text, marker) {
  const start = text.indexOf(marker);
  if (start < 0) return -1;
  const openIndex = text.indexOf('[', start);
  const braceIndex = text.indexOf('{', start);
  const useArray = openIndex >= 0 && (braceIndex < 0 || openIndex < braceIndex);
  const open = useArray ? '[' : '{';
  const close = useArray ? ']' : '}';
  const from = useArray ? openIndex : braceIndex;
  let depth = 0;
  let inString = null;
  for (let i = from; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') { i++; continue; }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { inString = ch; continue; }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        // move past the closing bracket and the semicolon that ends the statement
        let end = i + 1;
        while (end < text.length && text[end] !== ';' && text[end] !== '\n') end++;
        return text[end] === ';' ? end + 1 : i + 1;
      }
    }
  }
  return -1;
}

const TABLES = [
  { marker: 'const bridgeFFAMaps =', call: `\nSITES.patchMaps(bridgeFFAMaps, 'bridge');`, id: 'bridgeFFAMaps' },
  { marker: 'const speedbridgeConfigs =', call: `\nSITES.patchMaps(speedbridgeConfigs, 'speedbridge');`, id: 'speedbridgeConfigs' },
  { marker: 'const blockParkourCourses =', call: `\nSITES.patchCourses(blockParkourCourses, 'parkour');`, id: 'blockParkourCourses' },
];

for (const table of TABLES) {
  const already = source.includes(table.call.trim());
  if (already) {
    report.push({ label: table.id, count: 1, status: 'already patched' });
    continue;
  }
  const end = findBlockEnd(source, table.marker);
  if (end < 0) {
    report.push({ label: table.id, count: 0, status: 'not found' });
    continue;
  }
  source = source.slice(0, end) + table.call + source.slice(end);
  report.push({ label: table.id, count: 1, status: 'patched' });
}

// ------------------------------------------------------ 3. fixed site points

replaceAll(
  'lobby teleport (spaced)',
  '{ x: 0.5, y: 200, z: 0.5 }, { facingLocation: { x: 0.5, y: 200, z: -0.5 } }',
  "SITES.at('lobby', { x: 0.5, y: 200, z: 0.5 }), { facingLocation: SITES.at('lobby_facing', { x: 0.5, y: 200, z: -0.5 }) }",
);

replaceAll(
  'lobby teleport',
  '{ x: 0.5, y: 200, z: 0.5 }, {facingLocation: { x: 0.5, y: 200, z: -0.5}}',
  "SITES.at('lobby', { x: 0.5, y: 200, z: 0.5 }), {facingLocation: SITES.at('lobby_facing', { x: 0.5, y: 200, z: -0.5 })}",
);

replaceAll(
  'FFA spawn',
  '{ x: 500.5, y: 100, z: 500.5 }',
  "SITES.at('ffa_spawn', { x: 500.5, y: 100, z: 500.5 })",
);

replaceAll(
  'clutch arena spawn',
  '{ x: 1998.5, y: 100, z: 501.5 }',
  "SITES.at('clutch_arena', { x: 1998.5, y: 100, z: 501.5 })",
);

replaceAll(
  'clutch block origin (call)',
  'delblock6x(hurtEntity, 2000, 100, 500)',
  "delblock6xAt(hurtEntity, SITES.at('clutch_blocks', { x: 2000, y: 100, z: 500 }))",
);

replaceAll(
  'speedbridge origin (literal)',
  '{ x: 1000.5, y: 102, z: -5499.5 }',
  "SITES.at('speedbridge_origin', { x: 1000.5, y: 102, z: -5499.5 })",
);

replaceAll(
  'speedbridge origin (expression)',
  '{ x: 1000.5, y: 102, z: -5500 + 0.5 }',
  "SITES.at('speedbridge_origin', { x: 1000.5, y: 102, z: -5499.5 })",
);


  const leftovers = {
    hardcodedY200: (source.match(/y: 200/g) ?? []).length,
    summonCoords: (source.match(/summon bot:pvp 2000/g) ?? []).length,
    teleports: (source.match(/\.teleport\(/g) ?? []).length,
  };

  return { source, report, leftovers };
}
