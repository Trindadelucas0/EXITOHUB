const windows = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function loginAllowed(key: string): boolean {
  const now = Date.now();
  const stamps = (windows.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  windows.set(key, stamps);
  return stamps.length < MAX_ATTEMPTS;
}

export function loginFailed(key: string): void {
  const now = Date.now();
  const stamps = (windows.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  stamps.push(now);
  windows.set(key, stamps);
}

export function loginSucceeded(key: string): void {
  windows.delete(key);
}
