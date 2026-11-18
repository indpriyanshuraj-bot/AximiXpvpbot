/**
 * Admin UI. Every screen here is generated from the data it edits — the site
 * list, the map list and the config node list — so adding a site or a setting
 * needs no UI work.
 */
import { ActionFormData, ModalFormData } from '@minecraft/server-ui';
import type { Player } from '@minecraft/server';
import * as cfg from '../api/config';
import * as sites from '../api/sites';
import * as bots from '../api/bots';
import { format, parseVec } from '../../shared/vec';

function say(player: Player, text: string): void {
  player.sendMessage('§8[§bPBA§8] §r' + text);
}

export function openMenu(player: Player): void {
  const botCount = bots.list().length;
  const provider = cfg.get<string>('bridge.provider');

  new ActionFormData()
    .title('§l§bPractice Bridge')
    .body(
      `§7Provider: §f${provider}\n§7Bots alive: §f${botCount}\n` +
      `§7Sites edited: §f${sites.editedCount()}`,
    )
    .button('§aFixed sites\n§8lobby, spawns, arenas')
    .button('§aMaps\n§8bridge, speedbridge, parkour')
    .button('§aBot settings\n§8provider, difficulty, caps')
    .button('§aSpawn a test bot\n§8targets you')
    .button('§cReset all coordinates')
    .show(player)
    .then(res => {
      if (res.canceled) return;
      switch (res.selection ?? -1) {
        case 0: return fixedSitesMenu(player);
        case 1: return mapsKindMenu(player);
        case 2: return botSettingsMenu(player);
        case 3: return spawnTestMenu(player);
        case 4: return confirmReset(player);
        default: return;
      }
    })
    .catch(e => say(player, '§cMenu error: ' + e));
}

function fixedSitesMenu(player: Player): void {
  const list = sites.fixedSites();
  const form = new ActionFormData().title('Fixed sites').body('§7Pick one to edit.');
  for (const site of list) {
    form.button(`${site.label}${site.edited ? ' §e*' : ''}\n§8${format(site.current)}`);
  }
  form.button('§7Back');

  form.show(player).then(res => {
    if (res.canceled) return;
    const picked = res.selection ?? -1;
    if (picked < 0 || picked >= list.length) return openMenu(player);
    return editFixedSite(player, list[picked]!);
  }).catch((e: unknown) => say(player, '§c' + e));
}

function editFixedSite(player: Player, site: sites.FixedSite): void {
  new ModalFormData()
    .title(site.label)
    .textField('§bX', 'number', { defaultValue: String(site.current.x) })
    .textField('§bY', 'number', { defaultValue: String(site.current.y) })
    .textField('§bZ', 'number', { defaultValue: String(site.current.z) })
    .toggle('Use my current position', { defaultValue: false })
    .toggle('Reset to Amixi default', { defaultValue: false })
    .show(player)
    .then(res => {
      if (res.canceled) return;
      const [x, y, z, useMe, reset] = res.formValues as [string, string, string, boolean, boolean];

      if (reset) {
        sites.resetFixed(site.id);
        say(player, `§a${site.label} reset to ${format(site.def)}.`);
        return fixedSitesMenu(player);
      }
      const value = useMe ? { ...player.location } : parseVec(`${x} ${y} ${z}`);
      if (!value) {
        say(player, '§cThose are not three numbers.');
        return editFixedSite(player, site);
      }
      sites.setFixed(site.id, { x: value.x, y: value.y, z: value.z });
      say(player, `§a${site.label} set to ${format(value)}.`);
      return fixedSitesMenu(player);
    })
    .catch(e => say(player, '§c' + e));
}

function mapsKindMenu(player: Player): void {
  new ActionFormData()
    .title('Maps')
    .body('§7Which set?')
    .button('Bridge FFA §8(6 maps)')
    .button('Speed bridge §8(6 layouts)')
    .button('Block parkour §8(10 courses)')
    .button('§7Back')
    .show(player)
    .then(res => {
      if (res.canceled) return;
      const picked = res.selection ?? -1;
      if (picked === 3 || picked < 0) return openMenu(player);
      const kind = (['bridge', 'speedbridge', 'parkour'] as const)[picked];
      if (kind) return mapListMenu(player, kind);
    })
    .catch(e => say(player, '§c' + e));
}

function mapListMenu(player: Player, kind: sites.MapKind): void {
  const list = sites.mapSites(kind);
  const form = new ActionFormData().title(kind).body('§7Pick a map.');
  for (const map of list) {
    const tp = map.fields.tp ?? Object.values(map.fields)[0];
    form.button(`${map.label}${map.edited ? ' §e*' : ''}\n§8${tp ? format(tp) : ''}`);
  }
  form.button('§7Back');

  form.show(player).then(res => {
    if (res.canceled) return;
    const picked = res.selection ?? -1;
    if (picked < 0 || picked >= list.length) return mapsKindMenu(player);
    return editMap(player, list[picked]!);
  }).catch((e: unknown) => say(player, '§c' + e));
}

function editMap(player: Player, map: sites.MapSite): void {
  const form = new ModalFormData()
    .title(map.label + ' §8(offset moves every point)')
    .textField('§bOffset X', '0', { defaultValue: '0' })
    .textField('§bOffset Y', '0', { defaultValue: '0' })
    .textField('§bOffset Z', '0', { defaultValue: '0' })
    .toggle('Set spawn (tp) to my position', { defaultValue: false })
    .toggle('Reset this map', { defaultValue: false });

  form.show(player).then(res => {
    if (res.canceled) return;
    const [dx, dy, dz, useMe, reset] = res.formValues as [string, string, string, boolean, boolean];

    if (reset) {
      sites.resetMap(map.id);
      say(player, `§a${map.label} reset.`);
      return mapListMenu(player, map.kind);
    }
    if (useMe) {
      sites.setMapField(map.id, 'tp', { ...player.location });
      say(player, `§a${map.label} spawn moved here.`);
      return mapListMenu(player, map.kind);
    }
    const delta = parseVec(`${dx} ${dy} ${dz}`);
    if (!delta) {
      say(player, '§cOffsets must be numbers.');
      return editMap(player, map);
    }
    if (delta.x === 0 && delta.y === 0 && delta.z === 0) {
      return mapListMenu(player, map.kind);
    }
    sites.moveMap(map.id, delta);
    say(player, `§a${map.label} moved by ${format(delta)}.`);
    return mapListMenu(player, map.kind);
  }).catch(e => say(player, '§c' + e));
}

export function botSettingsMenu(player: Player): void {
  const form = new ModalFormData().title('Bot settings');
  const writers: Array<(value: unknown) => string | null> = [];

  for (const node of cfg.NODES) {
    const value = cfg.get(node.key);
    if (node.type === 'bool') {
      form.toggle(node.label, { defaultValue: Boolean(value) });
      writers.push(v => cfg.set(node.key, v).error ?? null);
    } else if (node.type === 'enum') {
      const options = node.options ?? [];
      const index = Math.max(0, options.findIndex(o => o.value === String(value)));
      form.dropdown(node.label, options.map(o => o.label), { defaultValueIndex: index });
      writers.push(v => cfg.set(node.key, options[Number(v)]?.value).error ?? null);
    } else if (node.type === 'int' || node.type === 'number') {
      form.slider(node.label, node.min ?? 0, node.max ?? 100, {
        valueStep: node.step ?? 1,
        defaultValue: Number(value),
      });
      writers.push(v => cfg.set(node.key, v).error ?? null);
    } else {
      form.textField(node.label, node.help ?? '', { defaultValue: String(value) });
      writers.push(v => cfg.set(node.key, v).error ?? null);
    }
  }

  form.show(player).then(res => {
    if (res.canceled) return;
    const values = res.formValues ?? [];
    let failed = 0;
    writers.forEach((write, i) => {
      const problem = write(values[i]);
      if (problem) {
        failed++;
        say(player, '§c' + problem);
      }
    });
    say(player, failed ? '§eSaved with problems.' : '§aSettings saved.');
    return openMenu(player);
  }).catch(e => say(player, '§c' + e));
}

function spawnTestMenu(player: Player): void {
  new ModalFormData()
    .title('Spawn a test bot')
    .dropdown('Difficulty', [...cfg.DIFFICULTIES], { defaultValueIndex: 1 })
    .dropdown('Type', [...cfg.BOT_TYPES], { defaultValueIndex: 0 })
    .show(player)
    .then(res => {
      if (res.canceled) return;
      const [difficultyIndex, typeIndex] = res.formValues as [number, number];
      const result = bots.spawn({
        dimension: player.dimension.id,
        location: { ...player.location },
        difficulty: cfg.DIFFICULTIES[difficultyIndex] ?? 'medium',
        type: cfg.BOT_TYPES[typeIndex] ?? 'sword',
        targetId: player.id,
      });
      say(player, result.ok ? `§aSpawned ${result.provider} bot.` : `§c${result.error}`);
    })
    .catch(e => say(player, '§c' + e));
}

function confirmReset(player: Player): void {
  new ActionFormData()
    .title('Reset all coordinates')
    .body('§7This clears every site and map override. Amixi goes back to its original coordinates.')
    .button('§cYes, reset everything')
    .button('§7Cancel')
    .show(player)
    .then(res => {
      if (res.canceled || (res.selection ?? -1) !== 0) return openMenu(player);
      const n = sites.resetAll();
      say(player, `§aCleared ${n} override(s).`);
      return openMenu(player);
    })
    .catch(() => {});
}
