# AmixiXPvP — Practice Bridge

A small, versioned **standard API for practice PvP bots** on Minecraft Bedrock, plus an
**Amixi-compatible coordinates layer** and a build that packages a patched Amixi for you.

* a world pack (Amixi) can ask for a bot without knowing which addon provides one;
* an admin moves the lobby, spawns, arenas and maps with a command, no code;
* the third-party bot addon is never copied, forked or redistributed.

```
Amixi (patched)  ──globalThis.__pba──▶  Practice Bridge  ──bot_data + simulated player──▶  PvP Practice Bots
     sites.at('lobby')                     config + UI                (their own engine)
```

## Install (what a player actually does)

1. **Replace** your Amixi behaviour + resource packs with `AmixiXPvP.mcaddon`
   (same pack UUIDs, so it updates in place).
2. **Install** `PracticeBridge.mcpack`.
3. Keep **PvP Practice Bots** installed — the bridge drives it, it is not bundled.
4. Turn **Beta APIs** on (simulated players require it) and reload the world.
5. `/pba:menu`, or `/scriptevent pbac:menu` if custom commands are unavailable.

Coordinates keep Amixi's original values until you change them: `/pba:site`, `/pba:map`,
`/pba:reset`. Full syntax in [`docs/commands.md`](docs/commands.md).

## What is in the box

| Piece | What it does |
| --- | --- |
| `src/bridge/api/sites.ts` | Fixed sites (lobby, FFA spawn, clutch, speed-bridge origin) and map tables (6 bridge maps, 6 speed-bridge layouts, 10 parkour courses), seeded from Amixi's own data with its values as defaults. Cached, invalidated on write. |
| `src/bridge/api/config.ts` | Eight settings: provider, default difficulty/type, ML off, bot cap, inventory clear, despawn-on-leave, logging. |
| `src/bridge/api/registry.ts` | `pba:reg:<kind>:<id>` descriptors so installed packs publish what they offer and the UI lists the union. |
| `src/bridge/providers/petstore.ts` | The adapter: spawns a simulated player with the addon's own prefix/tag and writes its `bot_data` contract. No third-party code. |
| `src/bridge/actions.ts` | One implementation per admin action, shared by both command surfaces. |
| `src/bridge/commands.ts` | `/pba:...` custom commands (typed, guarded) plus `/scriptevent pbac:...` fallbacks. |
| `src/bridge/ui/menu.ts` | Admin UI generated from the site list, map list and config nodes. |
| `tools/codemod/` | Patches a **local** Amixi copy so its literals read from the bridge, with the original values as fallbacks. Idempotent. |
| `tools/vendor.mjs` | Stages your Amixi archive into `vendor/amixi` (gitignored) for the build. |

## Build

```bash
npm install
npm run verify                                       # typecheck + 89 unit tests + build
npm run vendor -- --from "/path/to/Amixi.mcaddon"    # optional: stage your Amixi copy
npm run build                                        # dist/PracticeBridge.mcpack + dist/AmixiXPvP.mcaddon
npm run build:release                                # minified, fails if the Amixi copy is missing
```

`vendor/amixi` is gitignored and never committed — the release build patches a copy you
supply, and the bridge builds fine without one. See [NOTICE.md](NOTICE.md).

## The API

```js
const api = globalThis.__pba;            // may be undefined
api.api;                                 // 1
api.sites.at('lobby', { x: 0.5, y: 200, z: 0.5 });
api.sites.patchMaps(bridgeFFAMaps, 'bridge');
api.sites.patchCourses(blockParkourCourses, 'parkour');
api.bots.spawn({ dimension: 'overworld', location: {...}, difficulty: 'medium', type: 'sword', targetId: player.id });
api.bots.list();
api.bots.despawn(id);
api.config.get('bridge.provider');
api.registry.list('provider');
```

The contract is deliberately small and additive: `api` is a version number, and every
caller must tolerate the object being absent.

## Limits, stated plainly

* Bots are only as good as the installed provider. Without PvP Practice Bots, spawn
  requests return an error and nothing else changes.
* `bot_data` is written once, at spawn. The bot addon caches it per entity and writes it
  back, so retargeting means respawning. That is a property of their engine.
* Commands move coordinates, not terrain. Pointing a site at unloaded chunks still
  teleports you into unloaded space.

## Develop

```bash
npm run typecheck   # tsc --noEmit
npm test            # 89 unit tests, no Minecraft needed (stubbed engine modules)
npm run build       # bundle + .mcpack (+ .mcaddon when vendor/amixi exists)
```

CI: `.github/workflows/verify.yml` on every push, `.github/workflows/release.yml` on a
`v*` tag — it publishes both artifacts and a `SHA256SUMS.txt`. Set an `AMIXI_SOURCE_URL`
secret to have the release job build the patched Amixi mcaddon too.
