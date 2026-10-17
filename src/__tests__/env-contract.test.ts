/**
 * The build-time environment contract, enforced: the app reads exactly the
 * variables `.env.example` documents, every dev-only switch is also gated on
 * `import.meta.env.DEV` (so a production build cannot be flipped by an env
 * file), and the dev fixture module is never imported statically.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const SRC = join(ROOT, 'src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const sources = walk(SRC)
  .filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx') && !f.includes('/test/'))
  .map((f) => ({ path: relative(ROOT, f), text: readFileSync(f, 'utf8') }));

/** Every `import.meta.env.<NAME>` read in the app, with the line it is on. */
const reads = sources.flatMap(({ path, text }) =>
  text.split('\n').flatMap((line, i) => [...line.matchAll(/import\.meta\.env\.([A-Z_]+)/g)].map((m) => ({ path: `${path}:${i + 1}`, name: m[1], line }))),
);

const DOCUMENTED = ['VITE_BLOBBI_ISLAND_URL', 'VITE_BLOBBI_DEV_TOOLS', 'VITE_BLOBBI_WORLD_TRAVEL'];
const DEV_ONLY = ['VITE_BLOBBI_DEV_TOOLS'];

describe('the environment contract', () => {
  it('reads only the documented variables (plus the built-in DEV flag)', () => {
    const names = [...new Set(reads.map((r) => r.name))].sort();
    expect(names).toEqual(['DEV', ...DOCUMENTED].sort());
  });

  it('.env.example documents every variable the app reads', () => {
    const example = readFileSync(join(ROOT, '.env.example'), 'utf8');
    for (const name of DOCUMENTED) expect(example, name).toContain(name);
  });

  it('every dev-only switch is gated on the DEV build flag on the same line, so no env file can turn it on in production', () => {
    for (const r of reads.filter((x) => DEV_ONLY.includes(x.name))) {
      expect(r.line, r.path).toMatch(/import\.meta\.env\.DEV\s*&&/);
    }
  });

  it('the dev fixture world, its controller and its panel are only ever imported lazily behind that gate', () => {
    // The one static import allowed outside src/dev is the context (a null default, no behaviour).
    for (const { path, text } of sources) {
      if (path.startsWith('src/dev/')) continue;
      const devImports = [...text.matchAll(/^import .*['"](@\/dev\/[^'"]+|\.\.?\/dev\/[^'"]+)['"]/gm)].map((m) => m[1]);
      expect(devImports, path).toEqual(devImports.filter((i) => i.endsWith('/dev/DevFixtureContext')));
    }
    const app = sources.find((s) => s.path === 'src/App.tsx');
    expect(app?.text).toMatch(/DEV_FIXTURES \? lazy\(\(\) => import\('@\/dev\/DevFixture'\)\) : null/);
  });

  it('the Dev Lab is reachable only through the same lazy gate, and the router never imports it', () => {
    const app = sources.find((s) => s.path === 'src/App.tsx');
    expect(app?.text).toMatch(/DEV_FIXTURES \? lazy\(\(\) => import\('@\/dev\/DevLab'\)\) : null/);
    const router = sources.find((s) => s.path === 'src/AppRouter.tsx');
    expect(router?.text).not.toMatch(/dev\//);
    expect(router?.text).toMatch(/<Route path="\/dev" element=\{devLab \?\? <NotFound \/>\} \/>/);
  });

  it('production code never reads the URL for a dev fixture: the query string is parsed in src/dev only', () => {
    for (const { path, text } of sources) {
      if (path.startsWith('src/dev/') || path === 'src/App.tsx') continue;
      expect(text, path).not.toMatch(/get\('(fixture|expression|low)'\)/);
    }
  });
});
