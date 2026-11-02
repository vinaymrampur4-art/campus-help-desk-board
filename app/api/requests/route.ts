/**
 * app/api/requests/route.ts
 *
 * POST /api/requests  — validate input, insert into PostgreSQL, invalidate Redis cache
 * GET  /api/requests  — Redis cache-aside: return from Redis if available, else PostgreSQL
 *
 * Cache key : help:latest  (TTL 60 seconds)
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import redisClient, { isRedisAvailable } from '@/lib/redis';

// ─────────────────────────────────────────────────────────────
// POST /api/requests
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: { student_name?: unknown; message?: unknown };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const studentName = typeof body.student_name === 'string' ? body.student_name.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  // ── Validation ──────────────────────────────────────────────
  if (!studentName || !message) {
    return NextResponse.json(
      { success: false, error: 'student_name and message are required' },
      { status: 400 }
    );
  }

  if (studentName.length > 50) {
    return NextResponse.json(
      { success: false, error: 'student_name must be 50 characters or fewer' },
      { status: 400 }
    );
  }

  if (message.length > 200) {
    return NextResponse.json(
      { success: false, error: 'message must be 200 characters or fewer' },
      { status: 400 }
    );
  }

  // ── Insert into PostgreSQL (parameterized query) ─────────────
  try {
    const result = await pool.query(
      'INSERT INTO help_requests (student_name, message) VALUES ($1, $2) RETURNING id',
      [studentName, message]
    );

    const insertedId: number = result.rows[0].id;

    // ── Invalidate Redis cache so the next GET fetches fresh data ─
    if (isRedisAvailable()) {
      try {
        await redisClient.del('help:latest');
        console.log('[Redis] Cache invalidated: help:latest');
      } catch (redisErr) {
        // Cache invalidation failure is non-fatal
        console.error('[Redis] Failed to invalidate cache:', (redisErr as Error).message);
      }
    }

    return NextResponse.json({ success: true, id: insertedId }, { status: 201 });
  } catch (dbErr) {
    console.error('[DB] Insert failed:', (dbErr as Error).message);
    return NextResponse.json(
      { success: false, error: 'Database error. Please try again.' },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/requests  — Redis cache-aside
// ─────────────────────────────────────────────────────────────
export async function GET() {
  // ── Step 1: Try Redis ────────────────────────────────────────
  if (isRedisAvailable()) {
    try {
      const cached = await redisClient.get('help:latest');

      if (cached) {
        // Cache HIT — return data directly from Redis
        console.log('[Cache] HIT — serving from Redis');
        return NextResponse.json({
          source: 'Redis',
          requests: JSON.parse(cached),
        });
      }
    } catch (redisErr) {
      // If the read fails, fall through to PostgreSQL
      console.error('[Redis] Read error, falling back to PostgreSQL:', (redisErr as Error).message);
    }
  }

  // ── Step 2: Redis miss or unavailable — query PostgreSQL ─────
  try {
    const result = await pool.query(
      'SELECT id, student_name, message, created_at FROM help_requests ORDER BY created_at DESC LIMIT 10'
    );

    const requests = result.rows;

    // ── Step 3: Populate Redis cache with 60-second TTL ──────────
    if (isRedisAvailable()) {
      try {
        await redisClient.set('help:latest', JSON.stringify(requests), { EX: 60 });
        console.log('[Cache] MISS — stored in Redis with 60s TTL');
      } catch (redisErr) {
        console.error('[Redis] Failed to set cache:', (redisErr as Error).message);
      }
    }

    return NextResponse.json({ source: 'PostgreSQL', requests });
  } catch (dbErr) {
    console.error('[DB] Query failed:', (dbErr as Error).message);
    return NextResponse.json(
      { source: 'PostgreSQL', requests: [], error: 'Database error' },
      { status: 500 }
    );
  }
}
