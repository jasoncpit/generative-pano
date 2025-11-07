// Global middleware for Next.js App Router
// This simple rate-limiter keeps an in-memory record of the last time
// each client IP hit the `/api/generate` endpoint. If the same IP
// makes a request within 8 seconds of the previous one it receives
// a 429 response. This technique is stateless and specific to a
// single runtime instance — it does not persist across regions or
// deployments. For public demos it provides basic protection
// without any external dependencies like Redis.

export const config = { matcher: ["/api/generate"] };

// In-memory map of IP addresses to timestamps (ms). Because this
// object lives in module scope, it is shared between requests on
// the same instance. For high traffic consider using a shared
// store like Redis or Upstash instead.
const lastHit: Record<string, number> = {};

export default async function middleware(req: Request) {
  // Determine the requester IP. Vercel sets x-forwarded-for header on
  // incoming requests; fall back to localhost if missing.
  const xf = req.headers.get('x-forwarded-for') ?? '';
  const ip = xf.split(',')[0]?.trim() || '0.0.0.0';

  const now = Date.now();
  const prev = lastHit[ip] ?? 0;

  // Block if the last request from this IP was less than 8 seconds ago
  if (now - prev < 8000) {
    return new Response('Too many requests. Slow down.', {
      status: 429,
      headers: {
        'Retry-After': '8',
        'X-RateLimit-Policy': '1 request per 8 seconds per IP (stateless)',
      },
    });
  }

  // Update last seen timestamp and allow the request
  lastHit[ip] = now;
  return undefined; // allow continuation to the API route
}