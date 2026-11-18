/**
 * The bot seam: makes Amixi spawn the bridge's bots instead of its own
 * `bot:pvp` mobs, without removing the mob path.
 *
 * Every patch is a redirect, not a rewrite:
 *   - `summon bot:pvp ...` goes through PBA_SPAWN_BOT, which asks the bridge
 *     first and runs the original command if the bridge is absent or fails;
 *   - `kill @e[type=bot:pvp]` also despawns bridge bots nearby;
 *   - bot targeting sees bridge bots (they are players, not `bot:pvp`);
 *   - the mob-only "cheat" moves (scripted potting, pearl teleports, bridging)
 *     bail out for bridge bots, because the addon already does those properly.
 */

const BOT_SEAM = `    /* practice-bridge bot seam */
    function isPbaBot(entity) { return !!entity && entity.typeId === "minecraft:player"; }
    function PBA_SPAWN_BOT(source, command) {
        const api = globalThis.__pba;
        if (api && api.bots && api.bots.spawnDuel) {
            const m = /summon bot:pvp (\\S+) (\\S+) (\\S+)(?: \\S+ \\S+)?(?: bot:(\\w+))?/.exec(String(command));
            if (m) {
                const at = source.location;
                const px = m[1] === "~" ? at.x : Number(m[1]);
                const py = m[2] === "~" ? at.y : Number(m[2]);
                const pz = m[3] === "~" ? at.z : Number(m[3]);
                if (isFinite(px) && isFinite(py) && isFinite(pz)) {
                    try {
                        const res = api.bots.spawnDuel(source, m[4] || "", { x: px, y: py, z: pz });
                        if (res && res.ok) return true;
                    } catch (e) {
                        console.warn("[pba] spawnDuel failed: " + e);
                    }
                }
            }
        }
        source.runCommand(command);
        return false;
    }
    function PBA_KILL_BOTS(source, radius) {
        const api = globalThis.__pba;
        if (api && api.bots && api.bots.despawnNear) {
            try { api.bots.despawnNear(source.location, radius || 10, source.dimension.id); } catch (e) {}
        }
        if (radius) source.runCommand(\`execute at @s run kill @e[type=bot:pvp,r=\${radius}]\`);
        else source.runCommand("execute at @s run kill @e[type=bot:pvp]");
    }
    /* end bot seam */
`;

/** Functions that move a mob bot by hand; a simulated player must not be touched. */
const MOB_ONLY = [
  'function potting(source, botEntity) {',
  'function botpearl(source, botEntity) {',
  'function boteatsgapple (source, botEntity) {',
  'function botrod (source, botEntity) {',
  'function placeBlocksBetweenSourceAndBot(source, botEntity) {',
  'function keepBlockUnderBotEntity(source, botEntity) {',
  'function setFireAtSource(source, botEntity) {',
];

/** `runCommand(...)` call sites that summon a mob bot. */
const SUMMON_SITES = [
  ['`execute at @s run summon bot:pvp ~ ~ ~ ~ ~ ${botType.summon}`', 'source'],
  ['`summon bot:pvp ${posx} ${posy} ${posz} ~ ~ bot:clutch`', 'source'],
  ['summonCmd', 'source'],
  ['`summon bot:pvp 2000 100 500 ~ ~ bot:clutch`', 'hurtEntity'],
];

/** `runCommand(...)` call sites that clear mob bots. */
const KILL_SITES = [
  ['"execute at @s run kill @e[type=bot:pvp,r=10]"', 'source', 10],
  ['"execute at @s run kill @e[type=bot:pvp,r=100]"', 'source', 100],
  ["'execute at @s run kill @e[type=bot:pvp,r=10]'", 'source', 10],
  ["'execute at @s run kill @e[type=bot:pvp]'", 'hurtEntity', 0],
];

const TARGET_QUERY = 'const entities = source.dimension.getEntities ? source.dimension.getEntities({ type: "bot:pvp" }) : [];';
const TARGET_QUERY_PATCHED = 'const entities = source.dimension.getEntities ? [...source.dimension.getEntities({ type: "bot:pvp" }), ...source.dimension.getPlayers({ tags: ["PvPbot"] })] : [];';

export function patchAmixiBots(input) {
  let source = String(input).replace(/\r\n/g, '\n');
  const report = [];

  const replaceOnce = (label, from, to, expected) => {
    const count = source.split(from).length - 1;
    if (count === 0) {
      const applied = source.includes(to);
      report.push({ label, count: 0, status: applied ? 'already present' : 'not found' });
      return;
    }
    source = source.split(from).join(to);
    if (expected !== undefined && count !== expected) {
      report.push({ label, count, status: `expected ${expected}, patched anyway` });
    } else {
      report.push({ label, count, status: 'patched' });
    }
  };

  // 1. the seam itself, inside the worldLoad callback (needs delblock6x's scope)
  if (!source.includes('practice-bridge bot seam')) {
    const marker = 'world.afterEvents.worldLoad.subscribe(() => {';
    const at = source.indexOf(marker);
    if (at < 0) {
      report.push({ label: 'bot seam', count: 0, status: 'worldLoad marker not found' });
    } else {
      const insertAt = at + marker.length;
      source = source.slice(0, insertAt) + '\n' + BOT_SEAM + source.slice(insertAt);
      report.push({ label: 'bot seam', count: 1, status: 'injected' });
    }
  } else {
    report.push({ label: 'bot seam', count: 1, status: 'already present' });
  }

  // 2. redirect spawns
  for (const [snippet, caller] of SUMMON_SITES) {
    const from = snippet === 'summonCmd'
      ? 'source.runCommand(summonCmd);'
      : `${caller}.runCommand(${snippet})`;
    const to = snippet === 'summonCmd'
      ? 'PBA_SPAWN_BOT(source, summonCmd);'
      : `PBA_SPAWN_BOT(${caller}, ${snippet})`;
    replaceOnce('spawn: ' + (snippet === 'summonCmd' ? 'duel arena' : snippet.slice(0, 34)), from, to);
  }

  // 3. redirect cleanup
  for (const [snippet, caller, radius] of KILL_SITES) {
    const from = `${caller}.runCommand(${snippet})`;
    const to = radius ? `PBA_KILL_BOTS(${caller}, ${radius})` : `PBA_KILL_BOTS(${caller})`;
    const quote = snippet.startsWith('"') ? 'dq' : 'sq';
    replaceOnce(`cleanup: ${caller} r=${radius || 'all'} (${quote})`, from, to);
  }

  // 4. make targeting see bridge bots
  replaceOnce('targeting: include bridge bots', TARGET_QUERY, TARGET_QUERY_PATCHED, 1);

  // 5. keep the mob-only cheats away from simulated players
  for (const head of MOB_ONLY) {
    const name = head.split('(')[0].replace('function ', '').trim();
    if (source.includes(`${head}\n    if (isPbaBot(botEntity)) return;`)) {
      report.push({ label: 'guard: ' + name, count: 0, status: 'already present' });
      continue;
    }
    const count = source.split(head).length - 1;
    if (count === 0) {
      report.push({ label: 'guard: ' + name, count: 0, status: 'not found' });
      continue;
    }
    source = source.split(head).join(`${head}\n    if (isPbaBot(botEntity)) return;`);
    report.push({ label: 'guard: ' + name, count, status: 'patched' });
  }

  const leftovers = {
    mobOnlySelectors: (source.match(/@e\[type=bot:pvp,r=3\]/g) ?? []).length,
    summonLeft: (source.match(/summon bot:pvp/g) ?? []).length,
  };

  return { source, report, leftovers };
}
