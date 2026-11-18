# Commands

Two front ends, one implementation. Custom commands need an engine with a
custom command registry (beta APIs, or `@minecraft/server` 2.11+); the script
events work everywhere. If a custom command is missing, use its script-event
twin — same behaviour, same validation.

## Custom commands

| Command | Level | What it does |
| --- | --- | --- |
| `/pba:menu` | anyone | Admin menu: sites, maps, bot settings, spawn a test bot, reset. |
| `/pba:settings` | anyone | Bot provider, default difficulty/type, caps, logging. |
| `/pba:status` | anyone | Provider, live bots, how many coordinates are overridden. |
| `/pba:sites` | anyone | List fixed sites with their current coordinates (`*` = overridden). |
| `/pba:site <id> [position]` | op | Set a site. Omit the position to use **where you are standing**. |
| `/pba:map <move\|tp\|reset> <id> [offset]` | op | `move` shifts every point of a map; `tp` sets its spawn here; `reset` restores it. |
| `/pba:reset [target]` | op | Reset one site/map, or everything (`all`), to the Amixi defaults. |
| `/pba:spawn [difficulty] [type]` | op | Spawn a bot at your position that fights you. |
| `/pba:duel [mode] [difficulty]` | op | Spawn using your current Amixi mode tag: picks the mapped bot type or custom bot, copies your kit, applies skin/ML settings. |
| `/pba:clear` | op | Remove every practice bot. |
| `/pba:set <key> <value>` | op | Change one bridge setting, e.g. `bridge.difficulty hard`. |

## Script-event twins

| Script event | Same as |
| --- | --- |
| `/scriptevent pbac:menu` | `/pba:menu` |
| `/scriptevent pbac:settings` | `/pba:settings` |
| `/scriptevent pbac:status` | `/pba:status` |
| `/scriptevent pbac:sites` | `/pba:sites` |
| `/scriptevent pbac:maps` | list maps |
| `/scriptevent pbac:site lobby` | set `lobby` to your position |
| `/scriptevent pbac:site lobby 0 200 0` | set `lobby` to explicit coordinates |
| `/scriptevent pbac:map move bridge0 100 0 -50` | shift a map |
| `/scriptevent pbac:map tp bridge0` | set a map's spawn to your position |
| `/scriptevent pbac:map reset bridge0` | restore one map |
| `/scriptevent pbac:reset all` | restore every override |
| `/scriptevent pbac:spawn hard axe` | spawn a hard axe bot |
| `/scriptevent pbac:duel nodebuff` | duel bot mapped from the `nodebuff` entry |
| `/scriptevent pbac:clear` | remove every bot |
| `/scriptevent pbac:set bridge.maxBots 12` | change a setting |
| `/scriptevent pbac:config` | dump every setting |

## Site ids

`lobby`, `lobby_facing`, `ffa_spawn`, `clutch_arena`, `clutch_blocks`, `speedbridge_origin`.

## Map ids

`bridge:bridge0` … `bridge:bridge5`, `speedbridge:speedbridge1` … `speedbridge:speedbridge6`,
`parkour:course1` … `parkour:course10`. The bare tag (`bridge0`, `course3`) works too when
it is unambiguous.

## Examples

```
/pba:site lobby                     # stand in the new lobby, run this
/pba:site lobby 0 200 0             # or give coordinates
/pba:map move bridge0 100 0 -50     # move the Void map 100 blocks east
/pba:map tp bridge0                 # put its spawn where you stand
/pba:reset bridge0                  # back to Amixi's original numbers
/pba:reset all                      # forget every override
/pba:spawn impossible sword         # hardest bot, sword kit
```

## Settings keys

`bridge.provider`, `bridge.difficulty`, `bridge.type`, `bridge.mlDisabled`, `bridge.maxBots`,
`bridge.clearInventory`, `bridge.despawnOnLeave`, `bridge.copyKit`, `bridge.ml`, `bridge.skin`,
`bridge.modeMap`, `bridge.log`.

`bridge.modeMap` is JSON: an Amixi mode tag to `{"type":"sword"}` or to a bot you built in the
addon's Bot Builder, `{"customId":"MySkywarsBot"}`. Example:

```json
{"nodebuff":{"type":"sword"},"builduhc":{"type":"uhc"},"skywars":{"customId":"SkywarsBot"}}
```

## What these commands cannot do

They move coordinates, not world content. If you point a site at unloaded chunks the
teleport still happens — the bridge is not a terrain generator. Maps also assume the
build actually exists at the new location; moving the numbers does not move the blocks.
