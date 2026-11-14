import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { Redis } from "@upstash/redis";
import { redisEnv } from "./config";
import { UserFacingError } from "./errors";

type Memory = {
  kv: Record<string, { value: string; exp?: number }>;
  sets: Record<string, string[]>;
};

const memoryGlobal = globalThis as unknown as { __fdcMem?: Memory; __fdcRedis?: Redis };

function diskPath(): string {
  return path.join(process.cwd(), ".data", "store.json");
}

async function loadDisk(): Promise<Memory> {
  try {
    const raw = await readFile(diskPath(), "utf8");
    const parsed = JSON.parse(raw) as Memory;
    return { kv: parsed.kv ?? {}, sets: parsed.sets ?? {} };
  } catch {
    return { kv: {}, sets: {} };
  }
}

let diskQueue: Promise<void> = Promise.resolve();

function saveDisk(mem: Memory): void {
  diskQueue = diskQueue
    .then(async () => {
      await mkdir(path.dirname(diskPath()), { recursive: true });
      await writeFile(diskPath(), JSON.stringify(mem), "utf8");
    })
    .catch(() => {
      // Vercel’s filesystem is not a database. Production uses Redis.
    });
}

async function memory(): Promise<Memory> {
  if (!memoryGlobal.__fdcMem) memoryGlobal.__fdcMem = await loadDisk();
  return memoryGlobal.__fdcMem;
}

function redis(): Redis | null {
  const env = redisEnv();
  if (!env) return null;
  if (!memoryGlobal.__fdcRedis) {
    memoryGlobal.__fdcRedis = new Redis({ url: env.url, token: env.token });
  }
  return memoryGlobal.__fdcRedis;
}

function assertStoreAvailable(): void {
  if (redis() || process.env.NODE_ENV !== "production") return;
  throw new UserFacingError(
    "The data store is not connected. In Vercel, add the Upstash Redis integration, then redeploy.",
    500,
  );
}

function alive(entry: { value: string; exp?: number } | undefined): string | null {
  if (!entry) return null;
  if (entry.exp && entry.exp < Date.now()) return null;
  return entry.value;
}

export const store = {
  async get(key: string): Promise<string | null> {
    assertStoreAvailable();
    const client = redis();
    if (client) {
      const value = await client.get<string>(key);
      if (value == null) return null;
      return typeof value === "string" ? value : JSON.stringify(value);
    }
    const mem = await memory();
    return alive(mem.kv[key]);
  },

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    assertStoreAvailable();
    const client = redis();
    if (client) {
      if (ttlSeconds) await client.set(key, value, { ex: ttlSeconds });
      else await client.set(key, value);
      return;
    }
    const mem = await memory();
    mem.kv[key] = { value, exp: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined };
    saveDisk(mem);
  },

  async del(key: string): Promise<void> {
    assertStoreAvailable();
    const client = redis();
    if (client) {
      await client.del(key);
      return;
    }
    const mem = await memory();
    delete mem.kv[key];
    saveDisk(mem);
  },

  async sadd(key: string, member: string): Promise<void> {
    assertStoreAvailable();
    const client = redis();
    if (client) {
      await client.sadd(key, member);
      return;
    }
    const mem = await memory();
    const set = new Set(mem.sets[key] ?? []);
    set.add(member);
    mem.sets[key] = [...set];
    saveDisk(mem);
  },

  async srem(key: string, member: string): Promise<void> {
    assertStoreAvailable();
    const client = redis();
    if (client) {
      await client.srem(key, member);
      return;
    }
    const mem = await memory();
    mem.sets[key] = (mem.sets[key] ?? []).filter((item) => item !== member);
    saveDisk(mem);
  },

  async smembers(key: string): Promise<string[]> {
    assertStoreAvailable();
    const client = redis();
    if (client) {
      const members = await client.smembers(key);
      return members.map((member) => String(member));
    }
    const mem = await memory();
    return [...(mem.sets[key] ?? [])];
  },

  async incr(key: string, ttlSeconds: number): Promise<number> {
    assertStoreAvailable();
    const client = redis();
    if (client) {
      const count = await client.incr(key);
      await client.expire(key, ttlSeconds);
      return count;
    }
    const mem = await memory();
    const current = Number(alive(mem.kv[key]) ?? "0");
    const next = current + 1;
    mem.kv[key] = { value: String(next), exp: Date.now() + ttlSeconds * 1000 };
    saveDisk(mem);
    return next;
  },
};
