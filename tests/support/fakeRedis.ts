import type { RedisLike } from '../../src/config/redis';

interface Entry {
  value: string;
  expiresAt: number;
}

/**
 * In-memory Redis double with explicit failure switches, so cache-degradation
 * behaviour can be asserted instead of assumed.
 */
export class FakeRedis implements RedisLike {
  private readonly store = new Map<string, Entry>();
  gets = 0;
  sets = 0;
  failReads = false;
  failWrites = false;

  async get(key: string): Promise<string | null> {
    this.gets += 1;
    if (this.failReads) throw new Error('redis unavailable');
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async setex(key: string, seconds: number, value: string): Promise<string> {
    if (this.failWrites) throw new Error('redis unavailable');
    this.sets += 1;
    this.store.set(key, { value, expiresAt: Date.now() + seconds * 1000 });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) {
      if (this.store.delete(key)) removed += 1;
    }
    return removed;
  }

  async ping(): Promise<string> {
    if (this.failReads) throw new Error('redis unavailable');
    return 'PONG';
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  clear(): void {
    this.store.clear();
    this.gets = 0;
    this.sets = 0;
  }
}
