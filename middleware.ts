/**
 * Next.js Edge Middleware
 * Rate limiting for all API routes: 60 req/min default, 10/min for AI-heavy routes
 */

import { NextRequest, NextResponse } from 'next/server';

interface WindowEntry { count: number; resetAt: number; }

const store = new Map<string, WindowEntry>();
const WINDOW_MS = 60_000;

function getLimit(method: string, pathname: string): number {
  if (method === 'POST' && (pathname.includes('/tailor') || pathname.includes('/score') || pathname === '/api/outreach')) return 10;
  if (method === 'POST' && pathname === '/api/jobs') return 30;
  return 60;
}

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') || 'unknown';
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const method = request.method;
  const ip = getClientIp(request);
  const limit = getLimit(method, pathname);
  const now = Date.now();
  const key = `${ip}:${method}:${pathname}`;

  if (Math.random() < 0.01) {
    for (const [k, v] of store) { if (now > v.resetAt) store.delete(k); }
  }

  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    const res = NextResponse.next();
    res.headers.set('X-RateLimit-Limit', String(limit));
    res.headers.set('X-RateLimit-Remaining', String(limit - 1));
    return res;
  }

  if (entry.count >= limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return new NextResponse(
      JSON.stringify({ error: 'Too many requests', retryAfter }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  entry.count += 1;
  const res = NextResponse.next();
  res.headers.set('X-RateLimit-Limit', String(limit));
  res.headers.set('X-RateLimit-Remaining', String(limit - entry.count));
  return res;
}

export const config = { matcher: ['/api/:path*'] };
