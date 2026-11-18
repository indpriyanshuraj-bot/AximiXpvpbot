// Representative shape of Amixi's config.js for the codemod tests.
// Not Amixi code: every construct below is a pattern the codemod targets.
import { world, system, Player } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

world.afterEvents.worldLoad.subscribe(() => {

    const navigator = new ActionFormData().title("Navigator").button("Practice");

    const bridgeFFAMaps = [
        {
            tag: 'bridge0',
            name: 'Void',
            pos: { x: 3500, y: 100, z: 2500 },
            tp: { x: 3500.5, y: 100, z: 2500.5 },
            facing: { x: 3500.5, y: 100, z: 2500.5 }
        }
    ];

    const speedbridgeConfigs = [
        {
            tag: 'speedbridge1',
            pos: { x: 999, y: 85, z: 2000 },
            tp: { x: 999.5, y: 100, z: 2000.5 },
            facing: { x: 1000.5, y: 100, z: 2000.5 }
        }
    ];

    const blockParkourCourses = {
        course1: {
            tag: 'course1',
            tp: { x: 3009.5, y: 96, z: 1001.5 },
            facing: { x: 3009.5, y: 96, z: 1002.5 },
            clear: { x: 3009.5, y: 100, z: 1047.5 }
        }
    };

    world.afterEvents.playerSpawn.subscribe(evd => {
        const source = evd.player;
        source.teleport({ x: 0.5, y: 200, z: 0.5 }, {facingLocation: { x: 0.5, y: 200, z: -0.5}}); //add 0.5 to x and z to tp to center of block
    });

    function handleRespawnTeleport(source) {
        source.teleport({ x: 0.5, y: 200, z: 0.5 }, { facingLocation: { x: 0.5, y: 200, z: -0.5 } });
        source.teleport({ x: 500.5, y: 100, z: 500.5 } );
        source.teleport({ x: 1998.5, y: 100, z: 501.5 });
        source.teleport({ x: 1000.5, y: 102, z: -5499.5 }, { facingLocation: { x: 1002.5, y: 102, z: -5493.5 } });
        source.teleport({ x: 1000.5, y: 102, z: -5500 + 0.5 }, {facingLocation: { x: 1002 + 0.5, y: 102, z: -5493 + 0.5}});
        delblock6x(hurtEntity, 2000, 100, 500);
        hurtEntity.runCommand(`summon bot:pvp 2000 100 500 ~ ~ bot:clutch`);
    }

    function delblock6x(source, posx, posy, posz) {
        source.runCommand(`fill ${posx} ${posy} ${posz} air`);
    }

    function spawnDuelBot(source, botType) {
        source.runCommand(`execute at @s run summon bot:pvp ~ ~ ~ ~ ~ ${botType.summon}`);
        system.runTimeout(() => {
            const summonCmd = botType.summon === "" ?
                `summon bot:pvp ${mapObj.spawn2.x} ${mapObj.spawn2.y} ${mapObj.spawn2.z}` :
                `summon bot:pvp ${mapObj.spawn2.x} ${mapObj.spawn2.y} ${mapObj.spawn2.z} ~ ~ bot:${botType.summon}`;
            source.runCommand(summonCmd);
            source.runCommand(`summon bot:pvp ${posx} ${posy} ${posz} ~ ~ bot:clutch`);
            source.runCommand("execute at @s run kill @e[type=bot:pvp,r=10]");
            source.runCommand("execute at @s run kill @e[type=bot:pvp,r=100]");
            source.runCommand('execute at @s run kill @e[type=bot:pvp,r=10]');
            hurtEntity.runCommand('execute at @s run kill @e[type=bot:pvp]');
        }, 60);
    }

    function potting(source, botEntity) {
        botEntity.runCommand('replaceitem entity @s slot.weapon.mainhand 0 splash_potion 1 22');
    }

    function botpearl(source, botEntity) {
        botEntity.runCommand(`tp @s ${source.location.x} ${source.location.y} ${source.location.z}`);
    }

    function boteatsgapple (source, botEntity) {
        botEntity.runCommand('replaceitem entity @s slot.weapon.mainhand 0 golden_apple');
    }

    function botrod (source, botEntity) {
        botEntity.runCommand('replaceitem entity @s slot.weapon.mainhand 0 fishing_rod');
    }

    function placeBlocksBetweenSourceAndBot(source, botEntity) {
        botEntity.runCommand('replaceitem entity @s slot.weapon.mainhand 1 andesite');
    }

    function keepBlockUnderBotEntity(source, botEntity) {
        botEntity.runCommand('setblock ~ ~-1 ~ andesite');
    }

    function setFireAtSource(source, botEntity) {
        botEntity.runCommand('setblock ~ ~ ~ fire');
    }

    function getClosestBotEntity(source) {
        if (!source || !source.dimension) return { minDist: Infinity, botEntity: null, botName: null };
        let botEntity = null;
        let botName = null;
        let minDist = Infinity;
        const entities = source.dimension.getEntities ? source.dimension.getEntities({ type: "bot:pvp" }) : [];
        for (const entity of entities) {
            const dx = entity.location.x - source.location.x;
            if (dx < minDist) { minDist = dx; botEntity = entity; botName = entity.nameTag; }
        }
        return { minDist, botEntity, botName };
    }
});
