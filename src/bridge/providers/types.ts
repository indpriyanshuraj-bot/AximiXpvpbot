import type { Vec3 } from '../../shared/vec';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'impossible';

export interface SpawnRequest {
  dimension: string;
  location: Vec3;
  name?: string;
  difficulty: Difficulty;
  /** Provider-specific archetype: sword | axe | mace | uhc | crystal | cart */
  type: string;
  /** Entity id of the player to fight. Omit to fight the nearest player. */
  targetId?: string;
  /** Optional inventory override: "minecraft:diamond_sword" or "minecraft:golden_apple:8" */
  inventory?: string[];
  ignoreTag?: string;
}

export interface BotHandle {
  id: string;
  provider: string;
  name: string;
  type: string;
  difficulty: Difficulty;
  spawnedTick: number;
  targetId?: string;
}

export interface BotProvider {
  id: string;
  caps: string[];
  available(): boolean;
  spawn(request: SpawnRequest): { ok: true; handle: BotHandle } | { ok: false; error: string };
  despawn(handle: BotHandle): boolean;
  list(): BotHandle[];
  setDifficulty(handle: BotHandle, difficulty: Difficulty): boolean;
  applyInventory(handle: BotHandle, items: string[]): boolean;
}
