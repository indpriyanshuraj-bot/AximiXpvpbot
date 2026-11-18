export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function isVec3(value: unknown): value is Vec3 {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.x === 'number' && typeof v.y === 'number' && typeof v.z === 'number'
    && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

export function vec(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export function copy(v: Vec3): Vec3 {
  return { x: v.x, y: v.y, z: v.z };
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function round(v: Vec3, places = 2): Vec3 {
  const f = 10 ** places;
  return { x: Math.round(v.x * f) / f, y: Math.round(v.y * f) / f, z: Math.round(v.z * f) / f };
}

export function format(v: Vec3): string {
  return `${v.x} ${v.y} ${v.z}`;
}

/** Accepts "1 2 3", "1, 2, 3", "1 2 3" with extra spaces. */
export function parseVec(text: string): Vec3 | null {
  const parts = String(text).trim().split(/[\s,]+/).filter(Boolean).map(Number);
  if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return null;
  return { x: parts[0]!, y: parts[1]!, z: parts[2]! };
}
