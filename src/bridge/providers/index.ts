import * as cfg from '../api/config';
import type { BotProvider } from './types';
import { petstoreProvider } from './petstore';

const providers = new Map<string, BotProvider>([[petstoreProvider.id, petstoreProvider]]);

export function register(provider: BotProvider): void {
  providers.set(provider.id, provider);
}

export function all(): BotProvider[] {
  return [...providers.values()];
}

/** The provider the admin selected, if it is installed and usable. */
export function selected(): BotProvider | undefined {
  const id = cfg.get<string>('bridge.provider');
  const provider = providers.get(id);
  if (!provider) return undefined;
  return provider.available() ? provider : undefined;
}

export function byId(id: string): BotProvider | undefined {
  return providers.get(id);
}

export type { BotProvider } from './types';
export type { BotHandle, SpawnRequest, Difficulty } from './types';
