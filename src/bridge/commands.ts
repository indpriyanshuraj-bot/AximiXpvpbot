/**
 * Command surface.
 *
 * Two front ends over one implementation (actions.ts):
 *   - custom commands  /pba:...        (typed; needs an engine with
 *                                       customCommandRegistry, beta or 2.11+)
 *   - script events    /scriptevent pbac:...   (works everywhere, always)
 *
 * Neither path can bypass validation: both end in the same functions, and
 * config writes go through cfg.set().
 */
import {
  CommandPermissionLevel,
  CustomCommandParamType,
  CustomCommandStatus,
  Player,
  system,
} from '@minecraft/server';
import type { CustomCommandOrigin, CustomCommandResult } from '@minecraft/server';
import * as actions from './actions';
import * as cfg from './api/config';
import { openMenu, botSettingsMenu } from './ui/menu';
import { log } from '../shared/log';

function asPlayer(origin: CustomCommandOrigin): Player | undefined {
  const entity = origin.sourceEntity;
  return entity instanceof Player ? entity : undefined;
}

function toResult(outcome: actions.ActionResult): CustomCommandResult {
  return {
    status: outcome.ok ? CustomCommandStatus.Success : CustomCommandStatus.Failure,
    message: outcome.message,
  };
}

/** Custom command origin -> chat message, for the actions that must answer a player. */
function reply(origin: CustomCommandOrigin, outcome: actions.ActionResult): CustomCommandResult {
  const player = asPlayer(origin);
  if (!player) {
    log(outcome.message.replace(/§./g, ''));
    return toResult(outcome);
  }
  player.sendMessage('§8[§bPBA§8] §r' + outcome.message.split('\n').join('\n§8> §r'));
  return { status: outcome.ok ? CustomCommandStatus.Success : CustomCommandStatus.Failure };
}

// ------------------------------------------------------------ custom commands

const SITE_HELP = 'Set a site to your position, or to explicit coordinates';

export function registerCustomCommands(): void {
  system.beforeEvents.startup.subscribe(init => {
    const registry = init.customCommandRegistry;
    if (!registry) {
      log('no custom command registry on this engine; use /scriptevent pbac:... instead');
      return;
    }

    const commands: Array<{
      def: Parameters<typeof registry.registerCommand>[0];
      run: (origin: CustomCommandOrigin, ...args: unknown[]) => CustomCommandResult | undefined;
    }> = [
      {
        def: {
          name: 'pba:menu',
          description: 'Open the Practice Bridge admin menu',
          permissionLevel: CommandPermissionLevel.Any,
          cheatsRequired: false,
        },
        run: origin => {
          const player = asPlayer(origin);
          if (!player) return { status: CustomCommandStatus.Failure, message: 'run this as a player' };
          system.run(() => openMenu(player));
          return undefined;
        },
      },
      {
        def: {
          name: 'pba:settings',
          description: 'Bot provider, difficulty, caps and logging',
          permissionLevel: CommandPermissionLevel.Any,
          cheatsRequired: false,
        },
        run: origin => {
          const player = asPlayer(origin);
          if (!player) return { status: CustomCommandStatus.Failure, message: 'run this as a player' };
          system.run(() => botSettingsMenu(player));
          return undefined;
        },
      },
      {
        def: {
          name: 'pba:status',
          description: 'Show provider, live bots and how many sites are edited',
          permissionLevel: CommandPermissionLevel.Any,
          cheatsRequired: false,
        },
        run: origin => reply(origin, actions.status()),
      },
      {
        def: {
          name: 'pba:spawn',
          description: 'Spawn a practice bot at your position, targeting you',
          permissionLevel: CommandPermissionLevel.GameDirectors,
          cheatsRequired: false,
          optionalParameters: [
            { name: 'difficulty', type: CustomCommandParamType.String },
            { name: 'type', type: CustomCommandParamType.String },
          ],
        },
        run: (origin, difficulty, type) =>
          reply(origin, actions.spawnBot(asPlayer(origin), difficulty as string, type as string)),
      },
      {
        def: {
          name: 'pba:duel',
          description: 'Spawn a duel bot using your current mode tag and kit',
          permissionLevel: CommandPermissionLevel.GameDirectors,
          cheatsRequired: false,
          optionalParameters: [
            { name: 'mode', type: CustomCommandParamType.String },
            { name: 'difficulty', type: CustomCommandParamType.String },
          ],
        },
        run: (origin, mode, difficulty) =>
          reply(origin, actions.spawnDuelBot(asPlayer(origin), mode as string, difficulty as string)),
      },
      {
        def: {
          name: 'pba:clear',
          description: 'Remove every practice bot',
          permissionLevel: CommandPermissionLevel.GameDirectors,
          cheatsRequired: false,
        },
        run: origin => reply(origin, actions.clearBots()),
      },
      {
        def: {
          name: 'pba:sites',
          description: 'List fixed sites and their current coordinates',
          permissionLevel: CommandPermissionLevel.Any,
          cheatsRequired: false,
        },
        run: origin => reply(origin, actions.listSites()),
      },
      {
        def: {
          name: 'pba:site',
          description: SITE_HELP,
          permissionLevel: CommandPermissionLevel.GameDirectors,
          cheatsRequired: false,
          mandatoryParameters: [{ name: 'site', type: CustomCommandParamType.String }],
          optionalParameters: [{ name: 'position', type: CustomCommandParamType.Location }],
        },
        run: (origin, site, position) =>
          reply(origin, actions.setSite(asPlayer(origin), String(site), position as never)),
      },
      {
        def: {
          name: 'pba:map',
          description: 'Move a map, set its spawn, or reset it (actions: move, tp, reset)',
          permissionLevel: CommandPermissionLevel.GameDirectors,
          cheatsRequired: false,
          mandatoryParameters: [
            { name: 'action', type: CustomCommandParamType.String },
            { name: 'map', type: CustomCommandParamType.String },
          ],
          optionalParameters: [{ name: 'offset', type: CustomCommandParamType.Location }],
        },
        run: (origin, action, map, offset) =>
          reply(origin, actions.mapAction(asPlayer(origin), String(action), String(map), offset as never)),
      },
      {
        def: {
          name: 'pba:reset',
          description: 'Reset one site/map, or everything, to the Amixi defaults',
          permissionLevel: CommandPermissionLevel.GameDirectors,
          cheatsRequired: false,
          optionalParameters: [{ name: 'target', type: CustomCommandParamType.String }],
        },
        run: (origin, target) => reply(origin, actions.resetSites(target as string | undefined)),
      },
      {
        def: {
          name: 'pba:set',
          description: 'Set one bridge setting: /pba:set bridge.difficulty hard',
          permissionLevel: CommandPermissionLevel.GameDirectors,
          cheatsRequired: false,
          mandatoryParameters: [
            { name: 'key', type: CustomCommandParamType.String },
            { name: 'value', type: CustomCommandParamType.String },
          ],
        },
        run: (origin, key, value) => reply(origin, actions.setConfig(String(key), String(value))),
      },
    ];

    for (const command of commands) {
      try {
        registry.registerCommand(command.def, command.run);
      } catch (e) {
        log(`custom command ${command.def.name} not registered: ${e}`);
      }
    }
  });
}

// ------------------------------------------------------------ script events

function splitArgs(message: string): string[] {
  return message.split(/\s+/).filter(Boolean);
}

export function subscribeScriptEvents(): void {
  system.afterEvents.scriptEventReceive.subscribe(event => {
    if (!event.id.startsWith('pbac:')) return;
    const player = event.sourceEntity instanceof Player ? event.sourceEntity : undefined;
    const args = splitArgs(event.message ?? '');
    const [first, second, third] = args;

    try {
      switch (event.id) {
        case 'pbac:menu':
          if (player) system.run(() => openMenu(player));
          return;
        case 'pbac:settings':
          if (player) system.run(() => botSettingsMenu(player));
          return;
        case 'pbac:status':
          return send(player, actions.status());
        case 'pbac:spawn':
          return send(player, actions.spawnBot(player, first, second));
        case 'pbac:duel':
          return send(player, actions.spawnDuelBot(player, first, second));
        case 'pbac:clear':
          return send(player, actions.clearBots());
        case 'pbac:sites':
          return send(player, actions.listSites());
        case 'pbac:maps':
          return send(player, actions.listMaps());
        case 'pbac:site': {
          if (!first) return send(player, { ok: false, message: 'usage: pbac:site <id> [x y z | here]' });
          const rest = args.slice(1).join(' ');
          const position = !rest || rest === 'here' ? undefined : rest;
          return send(player, actions.setSite(player, first, position));
        }
        case 'pbac:map': {
          if (!first || !second) {
            return send(player, { ok: false, message: 'usage: pbac:map <move|tp|reset> <id> [dx dy dz]' });
          }
          const rest = args.slice(2).join(' ');
          return send(player, actions.mapAction(player, first, second, rest || undefined));
        }
        case 'pbac:reset':
          return send(player, actions.resetSites(first));
        case 'pbac:set': {
          if (!first) return send(player, { ok: false, message: 'usage: pbac:set <key> <value>' });
          return send(player, actions.setConfig(first, args.slice(1).join(' ')));
        }
        case 'pbac:config':
          return send(player, actions.listConfig());
        default:
          return;
      }
    } catch (e) {
      log('script event failed: ' + e);
    }
  });
}

function send(player: Player | undefined, outcome: actions.ActionResult): void {
  if (!player) {
    log(outcome.message.replace(/§./g, ''));
    return;
  }
  player.sendMessage('§8[§bPBA§8] §r' + outcome.message.split('\n').join('\n§8> §r'));
}

/** Kept for the UI: the node list is also useful as a flat dump. */
export function configDump(): string {
  return cfg.all().map(({ node, value }) => `${node.key} = ${String(value)}`).join('\n');
}
