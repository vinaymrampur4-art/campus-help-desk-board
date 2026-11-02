/**
 * lib/redis.ts
 *
 * Redis client using the `redis` npm package, connecting to Memurai
 * (or any Redis-compatible server) at REDIS_URL.
 *
 * Design principles:
 * - Connection errors are caught and logged, but never crash the app.
 * - `isRedisAvailable()` lets callers check before attempting operations.
 * - The client is a singleton reused across hot reloads in development.
 */

import { createClient, RedisClientType } from 'redis';

declare global {
  // eslint-disable-next-line no-var
  var _redisClient: RedisClientType | undefined;
  // eslint-disable-next-line no-var
  var _redisReady: boolean;
}

let redisClient: RedisClientType;

function getClient(): RedisClientType {
  if (global._redisClient) return global._redisClient;

  const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  }) as RedisClientType;

  client.on('connect', () => {
    global._redisReady = true;
    console.log('[Redis] Connected to', process.env.REDIS_URL || 'redis://localhost:6379');
  });

  client.on('ready', () => {
    global._redisReady = true;
  });

  client.on('error', (err: Error) => {
    // Log the error but do not throw — the app falls back to PostgreSQL
    global._redisReady = false;
    console.error('[Redis] Connection error (app will fall back to PostgreSQL):', err.message);
  });

  client.on('end', () => {
    global._redisReady = false;
    console.warn('[Redis] Connection closed.');
  });

  // Connect asynchronously; errors are handled by the error listener above
  client.connect().catch((err: Error) => {
    global._redisReady = false;
    console.error('[Redis] Initial connect failed:', err.message);
  });

  global._redisClient = client;
  return client;
}

redisClient = getClient();

/**
 * Returns true when the Redis client is connected and ready for commands.
 * Use this before every Redis operation so failures degrade gracefully.
 */
export function isRedisAvailable(): boolean {
  return global._redisReady === true && redisClient.isReady;
}

export default redisClient;
