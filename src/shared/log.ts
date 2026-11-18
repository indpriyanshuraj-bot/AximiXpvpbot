/** Namespaced logging so every line from this pack is greppable in the log. */
let verbose = false;

export function setVerbose(value: boolean): void {
  verbose = value;
}

export function isVerbose(): boolean {
  return verbose;
}

export function log(...args: unknown[]): void {
  console.warn('[pba]', ...args);
}

export function debug(...args: unknown[]): void {
  if (verbose) console.warn('[pba:dbg]', ...args);
}

export function warn(...args: unknown[]): void {
  console.warn('[pba:warn]', ...args);
}

export function error(...args: unknown[]): void {
  console.error('[pba:error]', ...args);
}
