/**
 * Build.
 *
 *   PracticeBridge.mcpack   our pack: TS -> one ESM bundle + manifest + icon
 *   AmixiXPvP.mcaddon       the user's own Amixi copy, patched in place (only
 *                           when vendor/amixi exists — see tools/vendor.mjs)
 *
 * Both artifacts are self-contained. Nothing third-party is ever committed:
 * the Amixi build reads vendor/, which is gitignored.
 *
 * Flags / env:
 *   --minify         smaller bundle for releases
 *   --require-amixi  fail when vendor/amixi is missing (used by the release job)
 */
import { build, transform } from 'esbuild';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { patchAmixiConfig } from './codemod/lib.mjs';

const root = process.cwd();
const dist = path.join(root, 'dist');
const minify = process.argv.includes('--minify');
const requireAmixi = process.argv.includes('--require-amixi');

const BRIDGE = {
  name: 'pba-bridge',
  source: 'packs/pba-bridge',
  entry: 'src/bridge/main.ts',
  output: 'PracticeBridge.mcpack',
};

const AMIXI_VENDOR = path.join(root, 'vendor', 'amixi');

// ------------------------------------------------------------------ zip

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/** Minimal deflate zip writer, so the build has no runtime dependencies. */
function writeZip(entries, outFile) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const payload = useDeflate ? deflated : data;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);

    locals.push(local, nameBuf, payload);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + payload.length;
  }

  const centralStart = offset;
  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(centralStart, 16);

  fs.writeFileSync(outFile, Buffer.concat([...locals, centralBuf, eocd]));
}

function walk(dir, base = dir, prefix = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(full, base, rel));
    else out.push({ name: rel, full });
  }
  return out;
}

function zipDir(dir, outFile, prefix = '') {
  const entries = walk(dir).map(f => ({
    name: prefix ? `${prefix}/${f.name}` : f.name,
    data: fs.readFileSync(f.full),
  }));
  writeZip(entries, outFile);
  return entries.length;
}

// --------------------------------------------------------------- bridge pack

async function buildBridge() {
  const packDir = path.join(dist, BRIDGE.name);
  fs.mkdirSync(path.join(packDir, 'scripts'), { recursive: true });

  await build({
    entryPoints: [path.join(root, BRIDGE.entry)],
    outfile: path.join(packDir, 'scripts', 'main.js'),
    bundle: true,
    format: 'esm',
    target: 'es2022',
    platform: 'neutral',
    external: ['@minecraft/server', '@minecraft/server-ui', '@minecraft/server-gametest'],
    legalComments: 'none',
    minify,
    logLevel: 'warning',
  });

  for (const file of walk(path.join(root, BRIDGE.source))) {
    const target = path.join(packDir, file.name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(file.full, target);
  }

  const bundle = fs.readFileSync(path.join(packDir, 'scripts', 'main.js'));
  const outFile = path.join(dist, BRIDGE.output);
  zipDir(packDir, outFile);

  const hash = createHash('sha256').update(bundle).digest('hex').slice(0, 12);
  console.log(`${BRIDGE.output.padEnd(24)} ${String(fs.statSync(outFile).size).padStart(8)} B  bundle ${String(bundle.length).padStart(6)} B  sha ${hash}`);
}

// ---------------------------------------------------------------- amixi pack

function stampManifest(dir, label) {
  const file = path.join(dir, 'manifest.json');
  if (!fs.existsSync(file)) return;
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  const header = manifest.header ?? {};
  const original = String(header.name ?? 'Amixi');
  if (!original.includes(label)) {
    const display = original === 'Behavior Pack' ? 'Amixi Behaviour' : original;
    header.name = `${display} ${label}`;
  }
  const version = Array.isArray(header.version) ? [...header.version] : [1, 0, 0];
  version[version.length - 1] = (version[version.length - 1] ?? 0) + 1;
  header.version = version;
  manifest.header = header;
  fs.writeFileSync(file, JSON.stringify(manifest, null, 4));
}

async function buildAmixi() {
  const bpSource = path.join(AMIXI_VENDOR, 'behavior_pack');
  const rpSource = path.join(AMIXI_VENDOR, 'resource_pack');
  const configPath = path.join(bpSource, 'scripts', 'config.js');

  if (!fs.existsSync(configPath)) {
    if (requireAmixi) {
      console.error('vendor/amixi/behavior_pack/scripts/config.js not found.');
      console.error('run: node tools/vendor.mjs --from "<path to Amixi .mcaddon>"');
      process.exit(1);
    }
    console.log('AmixiXPvP.mcaddon        skipped (no vendor/amixi — see tools/vendor.mjs)');
    return;
  }

  const workDir = path.join(dist, 'amixi');
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.cpSync(bpSource, path.join(workDir, 'AmixiXPvP_BP'), { recursive: true });
  if (fs.existsSync(rpSource)) fs.cpSync(rpSource, path.join(workDir, 'AmixiXPvP_RP'), { recursive: true });

  const original = fs.readFileSync(configPath, 'utf8');
  const { source, report, leftovers } = patchAmixiConfig(original);
  const applied = report.filter(r => r.status === 'patched' || r.status === 'injected').length;

  // Fail the build rather than ship a pack that will not parse.
  await transform(source, { loader: 'js', format: 'esm' });

  const target = path.join(workDir, 'AmixiXPvP_BP', 'scripts', 'config.js');
  fs.writeFileSync(target, source);
  fs.rmSync(target + '.pba-original', { force: true });

  stampManifest(path.join(workDir, 'AmixiXPvP_BP'), '(Practice Bridge)');
  if (fs.existsSync(rpSource)) stampManifest(path.join(workDir, 'AmixiXPvP_RP'), '(Practice Bridge)');

  const outFile = path.join(dist, 'AmixiXPvP.mcaddon');
  const entries = [
    ...walk(path.join(workDir, 'AmixiXPvP_BP')).map(f => ({ name: `AmixiXPvP_BP/${f.name}`, data: fs.readFileSync(f.full) })),
  ];
  if (fs.existsSync(rpSource)) {
    entries.push(...walk(path.join(workDir, 'AmixiXPvP_RP')).map(f => ({ name: `AmixiXPvP_RP/${f.name}`, data: fs.readFileSync(f.full) })));
  }
  writeZip(entries, outFile);

  console.log(
    `AmixiXPvP.mcaddon        ${String(fs.statSync(outFile).size).padStart(8)} B  ` +
    `${applied}/12 edits, ${leftovers.teleports} teleports left as-is`,
  );
  for (const row of report) {
    if (row.status === 'patched' || row.status === 'injected') continue;
    console.log(`  ! ${row.label}: ${row.status}`);
  }
}

// -------------------------------------------------------------------- main

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

await buildBridge();
await buildAmixi();

console.log('\nartifacts in dist/:');
console.log('  PracticeBridge.mcpack  -> install on its own');
console.log('  AmixiXPvP.mcaddon      -> replaces the old Amixi behaviour + resource packs');
