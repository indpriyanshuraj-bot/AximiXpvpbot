# Decisions

Short entries. One per real fork in the road, newest last.

## 1. Drive the bot addon through its data contract, not its commands

`pb:spawnbot` checks `commandPermissionLevel >= 1`, so a normal player cannot trigger it
from script. Instead the bridge spawns the simulated player itself (same name prefix, same
`PvPbot` tag) and writes the `bot_data` property the addon already reads. Cost: we must
keep the profile shape in sync with their version. Benefit: no permissions, no command
string parsing, no reliance on their UI.

## 2. A codemod instead of a fork

Amixi has no licence and the bot addon forbids redistribution. A patcher that rewrites the
user's own copy keeps both packs out of this repo and keeps the diff auditable: 12 edits,
all reported.

## 3. Defaults are the original literals

`at(id, fallback)` prefers an override, then the caller's literal, then our table. A world
without the bridge, or with nothing edited, behaves byte-for-byte like unpatched Amixi.
This is also the regression test.

## 4. Patch the data tables, not every call site

Amixi already keeps maps and courses in arrays/objects (`bridgeFFAMaps`,
`speedbridgeConfigs`, `blockParkourCourses`). One `patchMaps()` call after each table moves
a whole map consistently — `pos`, `tp` and `facing` cannot drift apart, which hand-editing
literals would allow.

## 5. In-process API first, wire protocol later

Packs share one JS realm, so `globalThis.__pba` gives synchronous calls with no round trip.
If a future engine isolates realms, the same method names move behind
`system.sendScriptEvent` without changing call sites. Not built yet — deliberately.

## 6. Beta gametest dependency is accepted, not hidden

A simulated player needs `@minecraft/server-gametest`. The bridge declares it and says so
in the README rather than pretending to work on stable-only worlds. A stable entity-backed
provider is the follow-up, behind the same `BotProvider` interface.

## 7. Two front ends, one action layer

Custom commands and script events both call `src/bridge/actions.ts`. Duplicating the logic
per surface would have let them drift; a shared layer also made the whole command surface
testable without a world.

## 8. Typed against the newest API, compatible with the oldest

Types come from `@minecraft/server` 2.11 (stable `customCommandRegistry`), while the
manifest declares module `2.0.0`. Newer APIs are used only behind presence checks, so the
pack loads on 1.21.90 and gains real commands on newer engines.

## 9. The Amixi artifact is built, never committed

`vendor/amixi` is gitignored. `npm run build` patches it when present and skips it when
not; `build:release` fails instead of shipping half a release. CI gets the copy through an
`AMIXI_SOURCE_URL` secret, so the repository never carries third-party files.
