/**
 * In-memory mock database for local development.
 * Activated automatically when AWS credentials are not configured.
 * Data is ephemeral (resets on server restart) — sufficient for a POC.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store = new Map<string, Map<string, any>>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mockDbGet<T>(pk: string, sk: string): T | null {
  return (store.get(pk)?.get(sk) as T) ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mockDbPut(item: Record<string, any>): void {
  const { PK, SK } = item as { PK: string; SK: string };
  if (!store.has(PK)) store.set(PK, new Map());
  store.get(PK)!.set(SK, item);
}

export function mockDbUpdate(pk: string, sk: string, updates: Record<string, unknown>): void {
  const existing = mockDbGet<Record<string, unknown>>(pk, sk);
  if (existing) mockDbPut({ ...existing, ...updates, PK: pk, SK: sk });
}

export function mockDbDelete(pk: string, sk: string): void {
  store.get(pk)?.delete(sk);
}

export function mockDbQuery<T>(
  pk: string,
  options?: { skPrefix?: string; limit?: number }
): T[] {
  const pkMap = store.get(pk);
  if (!pkMap) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let items: any[] = Array.from(pkMap.values());
  if (options?.skPrefix) {
    items = items.filter(item => (item.SK as string)?.startsWith(options.skPrefix!));
  }
  // Sort descending by SK (mirrors DynamoDB ScanIndexForward: false)
  items.sort((a, b) => (b.SK as string).localeCompare(a.SK as string));
  if (options?.limit) items = items.slice(0, options.limit);
  return items as T[];
}
