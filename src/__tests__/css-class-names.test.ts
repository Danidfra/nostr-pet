/**
 * A component class's rule (`@layer components` in `index.css`) reaches the
 * production CSS only if Tailwind's content scan finds the class name whole
 * somewhere in the source. A name built at runtime (`journey-status--${s}`)
 * is never found, and its rule is dropped silently: the Journey's chapter and
 * status styles, the connection chip's colours and a critical need bubble
 * all shipped without theirs before M12.2. This keeps it from coming back:
 * every modifier class that has a rule in `index.css` must not be built from
 * a template.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

describe('component classes survive the production build', () => {
  it('no modifier class with a rule in index.css is built from a template string', () => {
    const css = readFileSync(join(ROOT, 'index.css'), 'utf8');
    const offenders: string[] = [];
    for (const file of files(ROOT)) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/([a-z][a-z0-9_-]*)--\$\{/g)) {
        const family = match[1];
        // Only families that have modifier rules in the layered CSS are at risk
        if (new RegExp(`\\.${family}--[a-z0-9-]+`).test(css)) offenders.push(`${file.slice(ROOT.length + 1)}: ${family}--\${…}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
