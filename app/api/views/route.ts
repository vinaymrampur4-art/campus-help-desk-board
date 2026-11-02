/**
 * app/api/views/route.ts
 *
 * GET /api/views
 *
 * Atomically increments the board view counter in Redis using INCR.
 * INCR is a single atomic operation — no read-then-write race condition.
 *
 * If Redis is unavailable, returns { views: null, available: false }
 * so the frontend can display an "unavailable" state instead of crashing.
 */

import { NextResponse } from 'next/server';
import redisClient, { isRedisAvailable } from '@/lib/redis';

export async function GET() {
  if (!isRedisAvailable()) {
    return NextResponse.json({
      views: null,
      available: false,
      message: 'Views counter unavailable (Redis offline)',
    });
  }

  try {
    // INCR creates the key at 0 then increments — safe for first call
    const views = await redisClient.incr('help:views');

    return NextResponse.json({ views, available: true });
  } catch (err) {
    console.error('[Redis] INCR help:views failed:', (err as Error).message);
    return NextResponse.json({
      views: null,
      available: false,
      message: 'Views counter temporarily unavailable',
    });
  }
}
