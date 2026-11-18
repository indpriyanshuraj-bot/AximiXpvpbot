# Notes for whoever works on this next (human or agent)

Read this before touching anything. It is the memory of the project.

## What this repo is

Two things that must not be confused:

1. **`packs/pba-bridge` + `src/bridge`** — our code. Publishable. Provides `globalThis.__pba`
   (sites, bots, config, registry) and an adapter that drives the third-party bot addon.
2. **`tools/codemod/amixi-sites.mjs`** — a *local* patcher for a user's own Amixi copy.
   No Amixi code is stored in this repo, and none should ever be committed.

## Hard rules

- **Never commit third-party pack code.** Amixi ships no licence (all rights reserved);
  PvP Practice Bots forbids redistribution and modified versions. The codemod exists so we
  never have to.
- **Never call the bot addon's commands** (`pb:spawnbot`, `pb:forceaction`, ...) from script.
  They check `commandPermissionLevel`, which a normal player fails. Use the data contract.
- **Never write `bot_data` after the bot addon has read it.** Their manager caches the parsed
  object per bot id and writes it back, so a later external write is silently overwritten.
  Write it once, synchronously, immediately after spawn. Retarget = respawn.
- **Every bot must carry the `PvPbot` tag.** The bot addon monkey-patches `world.getPlayers()`
  to hide tagged players; an untagged simulated player will leak into Amixi's player lists
  and break matchmaking, counting and `forEach` loops.
- **Sites must always degrade to the caller's literal.** `at(id, fallback)` returns the
  fallback when there is no override. That is what keeps a bridge-less world identical to
  the original pack.

## Facts about the bot addon (v2.9) that the adapter depends on

- Bot prefix is `§p§b§rPVP_bot`; bots are found with `world.getRawPlayers()` (their patch
  reassigns it to the original `getPlayers`), not `getPlayers()`.
- `bot_data` fields we set: `linked_player`, `difficulty` (3 easy … 0 impossible), `type`
  (`sword|axe|mace|uhc|crystal|cart|custom`), `action`, `lastAttack`, `lastPearl`,
  `jumpDelay`, `is_eating`, `isPearling`, `default_name`, `ignoredTag`, `customId`, `error`,
  `mlOverride`, `mlDisabled`, `mlRole`.
- `linked_player` accepts `'player'`, `'bot'`, `'mob'`, `'all'` or an exact entity id.
- `javaCombat` is auto-detected from the presence of `bf:golden_apple`. On an Amixi world it
  is usually `false`, which is what we want: Amixi's knockback engine stays authoritative.
- Their world-load defaults include `botLogic: true`, `disconnect: true`, `searchRange: 50`.

## Engine notes

- `@minecraft/server` 2.0.0 **stable has no `customCommandRegistry`** (beta only). Commands
  are therefore registered through an `any`-cast and skipped silently when unavailable;
  script events (`pbac:*`) are the portable path.
- `EquipmentSlot` / `GameMode` are enums (`EquipmentSlot.Head`, `GameMode.Survival`).
- Behaviour packs share one JS realm, which is why `globalThis.__pba` works. Do not rely on
  module import order between packs: read the global at *use* time, never at module top.
- The bridge manifest depends on `@minecraft/server-gametest` (beta). That is intentional;
  without it there are no simulated players. A stable-only entity backend would be a
  separate provider, not a change here.

## Verification

- `npm run typecheck`, `npm test` (89 tests across six suites, stubbed engine), `npm run build`.
- After a codemod run: the report must show 12 ✔ lines, and the build refuses to package a
  `config.js` that does not parse (it runs esbuild's parser over the patched source).
- The codemod is idempotent: a second pass must report `already present`/`already patched`
  for all 12 edits and change nothing. `tools/test/codemod.test.ts` enforces that.

## Performance rules

- `sites.at()` is called from teleport paths: it reads from `fixedCache`/`mapCache`, which
  are invalidated on every write in that module.
- `cfg.get()` is cached the same way; `cfg.set`/`reset` invalidate.
- `petstore.list()` parses `bot_data` per bot, so it is cached for 10 ticks and invalidated
  on spawn/despawn. The janitor does **one** `list()` per run, not one per bot.
- Never add a per-tick loop that scans players or dynamic properties per entity.

## API baseline

- Typed against `@minecraft/server` 2.11.0 / `@minecraft/server-ui` 2.3.0, where
  `customCommandRegistry` is stable. The manifest still declares `2.0.0` so the pack loads
  on older engines; every custom-command registration is guarded by a presence check and
  the `pbac:` script events are the fallback.

## Next steps (agreed direction)

1. Amixi bot seam: replace `summon bot:pvp` / `bot:pvp` entity driving in the patched pack
   with `__pba.bots.spawn(...)`, keeping the entity path as the default provider so the pack
   still works without the bridge.
2. Kit hand-off: Amixi's kit editor produces `ItemStack[]`; pass it as `inventory` in the
   spawn request so kit authority stays with Amixi.
3. Difficulty mapping table: Amixi 0/1/2/2.5/3/4 → easy/medium/hard/impossible.
4. Second provider (`entity`) for worlds without Beta APIs.
