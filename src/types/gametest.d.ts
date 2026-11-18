/**
 * @minecraft/server-gametest has no published npm typings, so the small
 * surface we use is declared here. Everything is optional-chained at the call
 * site because the module only exists when the Beta APIs experiment is on.
 */
declare module '@minecraft/server-gametest' {
  import type { Dimension, GameMode, Player } from '@minecraft/server';

  export interface SimulatedPlayer extends Player {
    disconnect(): void;
    simulateLookAt(target: unknown): void;
  }

  export function spawnSimulatedPlayer(
    location: { x: number; y: number; z: number; dimension: Dimension },
    name?: string,
    gameMode?: GameMode | string,
  ): SimulatedPlayer;
}
