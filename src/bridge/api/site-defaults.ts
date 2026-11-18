/**
 * GENERATED from the Amixi pack's own data tables (scripts/config.js).
 * These are the shipped defaults: if an admin never edits anything, the
 * patched pack behaves exactly like the original.
 * Regenerate with: node tools/codemod/extract-defaults.mjs <path to Amixi BP>
 */
import type { Vec3 } from '../../shared/vec';
import type { MapKind } from './sites';

export interface FixedDefault {
  id: string;
  label: string;
  def: Vec3;
}

export interface MapDefault {
  id: string;
  kind: MapKind;
  label: string;
  fields: Record<string, Vec3>;
}

export const FIXED_DEFAULTS: FixedDefault[] = [
  { id: 'lobby', label: 'Lobby spawn', def: { x: 0.5, y: 200, z: 0.5 } },
  { id: 'lobby_facing', label: 'Lobby facing point', def: { x: 0.5, y: 200, z: -0.5 } },
  { id: 'ffa_spawn', label: 'FFA spawn', def: { x: 500.5, y: 100, z: 500.5 } },
  { id: 'clutch_arena', label: 'Clutch arena spawn', def: { x: 1998.5, y: 100, z: 501.5 } },
  { id: 'clutch_blocks', label: 'Clutch block origin', def: { x: 2000, y: 100, z: 500 } },
  { id: 'speedbridge_origin', label: 'Speed-bridge default origin', def: { x: 1000.5, y: 102, z: -5499.5 } },
];

export const MAP_DEFAULTS: MapDefault[] = [
  { id: 'bridge:bridge0', kind: 'bridge', label: 'Void', fields: { pos: { x: 3500, y: 100, z: 2500 }, tp: { x: 3500.5, y: 100, z: 2500.5 }, facing: { x: 3500.5, y: 100, z: 2500.5 } } },
  { id: 'bridge:bridge1', kind: 'bridge', label: 'House', fields: { pos: { x: 3000, y: 100, z: -5979 }, tp: { x: 3000.5, y: 100, z: -5999.5 }, facing: { x: 3000.5, y: 100, z: -5998.5 } } },
  { id: 'bridge:bridge2', kind: 'bridge', label: 'City', fields: { pos: { x: 2981, y: 100, z: -4477 }, tp: { x: 3000.5, y: 100, z: -4499.5 }, facing: { x: 2998.5, y: 100, z: -4496.5 } } },
  { id: 'bridge:bridge3', kind: 'bridge', label: 'Graveyard', fields: { pos: { x: 1976, y: 100, z: -5979 }, tp: { x: 2000.5, y: 100, z: -5999.5 }, facing: { x: 1997.5, y: 100, z: -5997.5 } } },
  { id: 'bridge:bridge4', kind: 'bridge', label: 'Castle', fields: { pos: { x: 2000, y: 100, z: -4479 }, tp: { x: 2000.5, y: 100, z: -4499.5 }, facing: { x: 2000.5, y: 100, z: -4498.5 } } },
  { id: 'bridge:bridge5', kind: 'bridge', label: 'Construction', fields: { pos: { x: 4000, y: 100, z: -5979 }, tp: { x: 4000.5, y: 100, z: -5999.5 }, facing: { x: 4000.5, y: 100, z: -5998.5 } } },
  { id: 'speedbridge:speedbridge1', kind: 'speedbridge', label: 'Layout 1 (speedbridge1)', fields: { pos: { x: 999, y: 85, z: 2000 }, tp: { x: 999.5, y: 100, z: 2000.5 }, facing: { x: 1000.5, y: 100, z: 2000.5 } } },
  { id: 'speedbridge:speedbridge2', kind: 'speedbridge', label: 'Layout 2 (speedbridge2)', fields: { pos: { x: 999, y: 85, z: 2500 }, tp: { x: 999.5, y: 100, z: 2500.5 }, facing: { x: 1000.5, y: 100, z: 2500.5 } } },
  { id: 'speedbridge:speedbridge3', kind: 'speedbridge', label: 'Layout 3 (speedbridge3)', fields: { pos: { x: 999, y: 85, z: 3000 }, tp: { x: 999.5, y: 100, z: 3000.5 }, facing: { x: 1000.5, y: 100, z: 3000.5 } } },
  { id: 'speedbridge:speedbridge4', kind: 'speedbridge', label: 'Layout 4 (speedbridge4)', fields: { pos: { x: 1999, y: 85, z: 1999 }, tp: { x: 1999.5, y: 100, z: 1999.5 }, facing: { x: 2001.5, y: 100, z: 2001.5 } } },
  { id: 'speedbridge:speedbridge5', kind: 'speedbridge', label: 'Layout 5 (speedbridge5)', fields: { pos: { x: 1999, y: 85, z: 3501 }, tp: { x: 1999.5, y: 100, z: 3501.5 }, facing: { x: 2000.5, y: 100, z: 3500.5 } } },
  { id: 'speedbridge:speedbridge6', kind: 'speedbridge', label: 'Layout 6 (speedbridge6)', fields: { pos: { x: 999, y: 85, z: 3500 }, tp: { x: 999.5, y: 100, z: 3500.5 }, facing: { x: 1000.5, y: 100, z: 3500.5 } } },
  { id: 'parkour:course1', kind: 'parkour', label: 'Course 1', fields: { tp: { x: 3009.5, y: 96, z: 1001.5 }, facing: { x: 3009.5, y: 96, z: 1002.5 }, clear: { x: 3009.5, y: 100, z: 1047.5 } } },
  { id: 'parkour:course2', kind: 'parkour', label: 'Course 2', fields: { tp: { x: 3008.5, y: 96, z: 2001.5 }, facing: { x: 3008.5, y: 96, z: 2002.5 }, clear: { x: 3008.5, y: 100, z: 2064.5 } } },
  { id: 'parkour:course3', kind: 'parkour', label: 'Course 3', fields: { tp: { x: 3010.5, y: 96, z: 3001.5 }, facing: { x: 3010.5, y: 96, z: 3002.5 }, clear: { x: 3013.5, y: 100, z: 3071.5 } } },
  { id: 'parkour:course4', kind: 'parkour', label: 'Course 4', fields: { tp: { x: 3009.5, y: 96, z: 4001.5 }, facing: { x: 3009.5, y: 96, z: 4002.5 }, clear: { x: 3010.5, y: 100, z: 4058.5 } } },
  { id: 'parkour:course5', kind: 'parkour', label: 'Course 5', fields: { tp: { x: 3008.5, y: 96, z: 5001.5 }, facing: { x: 3008.5, y: 96, z: 5002.5 }, clear: { x: 3006.5, y: 100, z: 5067.5 } } },
  { id: 'parkour:course6', kind: 'parkour', label: 'Course 6', fields: { tp: { x: 4009.5, y: 96, z: 1001.5 }, facing: { x: 4009.5, y: 96, z: 1002.5 }, clear: { x: 4007.5, y: 100, z: 1063.5 } } },
  { id: 'parkour:course7', kind: 'parkour', label: 'Course 7', fields: { tp: { x: 4009.5, y: 96, z: 2001.5 }, facing: { x: 4009.5, y: 96, z: 2002.5 }, clear: { x: 4008.5, y: 100, z: 2062.5 } } },
  { id: 'parkour:course8', kind: 'parkour', label: 'Course 8', fields: { tp: { x: 4008.5, y: 96, z: 3001.5 }, facing: { x: 4008.5, y: 96, z: 3002.5 }, clear: { x: 4006.5, y: 100, z: 3066.5 } } },
  { id: 'parkour:course9', kind: 'parkour', label: 'Course 9', fields: { tp: { x: 4007.5, y: 96, z: 4001.5 }, facing: { x: 4007.5, y: 96, z: 4002.5 }, clear: { x: 4006.5, y: 100, z: 4056.5 } } },
  { id: 'parkour:course10', kind: 'parkour', label: 'Course 10', fields: { tp: { x: 4003.5, y: 96, z: 5001.5 }, facing: { x: 4004.5, y: 96, z: 5002.5 }, clear: { x: 4046.5, y: 100, z: 5049.5 } } },
];
