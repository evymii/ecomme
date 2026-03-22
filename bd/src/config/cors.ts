import type { CorsOptions } from 'cors';

/**
 * Normalize origin for comparison. Browser `Origin` has no trailing slash;
 * `FRONTEND_URL` in Vercel should match the live URL exactly (`https://...`, no trailing slash).
 * This trim only helps if a slash was accidentally added in env.
 */
export function trimOrigin(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/** Resolved at request time so `dotenv` / platform env is loaded before first read. */
export function getAllowedOrigins(): string[] {
  return [
    process.env.FRONTEND_URL ? trimOrigin(process.env.FRONTEND_URL) : '',
    'http://localhost:3000',
  ].filter((o): o is string => Boolean(o));
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  return getAllowedOrigins().includes(trimOrigin(origin));
}

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();
    if (!origin || allowedOrigins.includes(trimOrigin(origin))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
