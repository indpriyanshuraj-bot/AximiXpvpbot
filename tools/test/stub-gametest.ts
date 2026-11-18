/** Simulated player stand-in: records spawns, no engine involved. */
export const spawned: Array<{ name: string; location: { x: number; y: number; z: number }; tags: string[]; data: Map<string, unknown> }> = [];

export function spawnSimulatedPlayer(location: { x: number; y: number; z: number }, name?: string) {
  const record = { name: name ?? '', location, tags: [] as string[], data: new Map<string, unknown>() };
  spawned.push(record);
  return {
    id: 'sim' + spawned.length,
    name,
    nameTag: name,
    location,
    addTag: (tag: string) => record.tags.push(tag),
    hasTag: (tag: string) => record.tags.includes(tag),
    setDynamicProperty: (key: string, value: unknown) => record.data.set(key, value),
    getDynamicProperty: (key: string) => record.data.get(key),
    getComponent: () => undefined,
    disconnect: () => { record.tags.push('disconnected'); },
  };
}
