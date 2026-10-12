/**
 * The policy the build writes into the page and the one the host config
 * sends are the same policy (the header adds only what a `<meta>` cannot
 * carry), and it stays strict where it matters: no inline or remote script,
 * no eval, no plugins, no framing by other sites.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CSP_DIRECTIVES, CSP_HEADER, CSP_META } from './content-security-policy';

const vercel = JSON.parse(readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8')) as { rewrites: { source: string; destination: string }[]; headers: { source: string; headers: { key: string; value: string }[] }[] };
const header = (key: string) => vercel.headers.find((h) => h.source === '/(.*)')?.headers.find((h) => h.key === key)?.value;

describe('the Content-Security-Policy', () => {
  it('allows only the app\'s own scripts: no inline, no eval, no other origin', () => {
    const script = CSP_DIRECTIVES.find((d) => d.startsWith('script-src'))!;
    expect(script).toBe("script-src 'self'");
    expect(CSP_META).not.toMatch(/unsafe-eval|'unsafe-inline'[^;]*script|script-src[^;]*https:/);
    expect(CSP_META).toContain("object-src 'none'");
    expect(CSP_META).toContain("base-uri 'self'");
    expect(CSP_HEADER).toContain("frame-ancestors 'none'");
    // A <meta> cannot carry frame-ancestors (browsers ignore it there)
    expect(CSP_META).not.toContain('frame-ancestors');
  });

  it('the host config sends the same policy as the page, the SPA fallback, and the other security headers', () => {
    expect(header('Content-Security-Policy')).toBe(CSP_HEADER);
    expect(header('X-Content-Type-Options')).toBe('nosniff');
    expect(header('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(header('X-Frame-Options')).toBe('DENY');
    expect(vercel.rewrites).toEqual([{ source: '/(.*)', destination: '/index.html' }]);
    expect(vercel.headers.find((h) => h.source === '/assets/(.*)')?.headers[0].value).toMatch(/immutable/);
  });
});
