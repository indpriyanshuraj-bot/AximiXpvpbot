#!/usr/bin/env node
/**
 * Prepare vendor/amixi from whatever the user has: an .mcaddon, a .zip, or an
 * already-extracted pair of folders.
 *
 * Amixi is not in this repository and never will be — the release build only
 * patches a copy the user supplies. If nothing is supplied the build simply
 * skips the Amixi artifact and still produces the bridge.
 *
 *   node tools/vendor.mjs --from "/path/Amixi.mcaddon"
 *   AMIXI_SOURCE_URL=https://... node tools/vendor.mjs
 *   node tools/vendor.mjs --pack "/path/Behavior pack" --pack "/path/Resource pack"
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const vendorRoot = path.join(root, 'vendor', 'amixi');
const args = process.argv.slice(2);

function readManifest(dir) {
  const file = path.join(dir, 'manifest.json');
  if (!fs.existsSync(file)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
}

function isBehaviourPack(manifest) {
  return manifest?.modules?.some(m => m.type === 'script' || m.type === 'data');
}

function isResourcePack(manifest) {
  return manifest?.modules?.some(m => m.type === 'resources');
}

function findPackDirs(dir, depth = 0) {
  const found = { behaviour: [], resource: [] };
  if (depth > 4) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    const manifest = readManifest(full);
    if (manifest) {
      if (isResourcePack(manifest)) found.resource.push(full);
      else if (isBehaviourPack(manifest)) found.behaviour.push(full);
    }
    const nested = findPackDirs(full, depth + 1);
    found.behaviour.push(...nested.behaviour);
    found.resource.push(...nested.resource);
  }
  return found;
}

function extractArchive(file) {
  const work = path.join(root, 'vendor', '_extract');
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  const name = file.toLowerCase();
  try {
    if (name.endsWith('.mcaddon') || name.endsWith('.zip') || name.endsWith('.mcpack')) {
      execFileSync('unzip', ['-q', '-o', file, '-d', work], { stdio: 'inherit' });
    } else if (name.endsWith('.tar.xz') || name.endsWith('.txz')) {
      execFileSync('tar', ['-xJf', file, '-C', work], { stdio: 'inherit' });
    } else if (name.endsWith('.tar.gz') || name.endsWith('.tgz')) {
      execFileSync('tar', ['-xzf', file, '-C', work], { stdio: 'inherit' });
    } else {
      throw new Error('unsupported archive type: ' + path.basename(file));
    }
  } catch (e) {
    console.error('could not extract ' + file + ': ' + e.message);
    console.error('if `unzip` is missing, extract it yourself and pass --pack for each folder');
    process.exit(1);
  }
  return work;
}

async function download(url) {
  const file = path.join(root, 'vendor', 'amixi-download.zip');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  console.log('downloading ' + url);
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`download failed: ${response.status} ${response.statusText}`);
    process.exit(1);
  }
  fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  return file;
}

async function main() {
  const packs = [];
  const fromIndex = args.indexOf('--from');
  const url = process.env.AMIXI_SOURCE_URL;
  const packArgs = args.reduce((acc, arg, i) => (arg === '--pack' ? [...acc, args[i + 1]] : acc), []);

  let searchDir;
  if (packArgs.length) {
    for (const dir of packArgs) {
      const manifest = readManifest(dir);
      if (!manifest) {
        console.error('no manifest.json in ' + dir);
        process.exit(1);
      }
      packs.push(dir);
    }
  } else {
    const source = fromIndex >= 0 ? args[fromIndex + 1] : url;
    if (!source) {
      console.log('no Amixi source supplied.');
      console.log('  --from <archive>   an .mcaddon / .zip / .tar.xz');
      console.log('  --pack <dir>       an already-extracted pack folder (repeatable)');
      console.log('  AMIXI_SOURCE_URL   a direct download URL (used by CI)');
      console.log('The build will skip the Amixi artifact.');
      return;
    }
    const archive = /^https?:/.test(source) ? await download(source) : source;
    searchDir = extractArchive(archive);
    const found = findPackDirs(searchDir);
    packs.push(...found.behaviour.slice(0, 1), ...found.resource.slice(0, 1));
  }

  const behaviour = packs.filter(d => isBehaviourPack(readManifest(d)));
  const resource = packs.filter(d => isResourcePack(readManifest(d)));
  if (behaviour.length === 0) {
    console.error('no behaviour pack found (needs a manifest with a script or data module)');
    process.exit(1);
  }

  fs.rmSync(vendorRoot, { recursive: true, force: true });
  fs.mkdirSync(vendorRoot, { recursive: true });
  fs.cpSync(behaviour[0], path.join(vendorRoot, 'behavior_pack'), { recursive: true });
  if (resource[0]) fs.cpSync(resource[0], path.join(vendorRoot, 'resource_pack'), { recursive: true });
  fs.rmSync(path.join(root, 'vendor', '_extract'), { recursive: true, force: true });

  console.log('vendor/amixi ready:');
  console.log('  behaviour: ' + path.relative(root, behaviour[0]));
  console.log('  resource:  ' + (resource[0] ? path.relative(root, resource[0]) : 'none (will ship behaviour only)'));
}

main();
