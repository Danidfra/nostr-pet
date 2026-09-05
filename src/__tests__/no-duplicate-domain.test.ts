/**
 * The standalone is a consumer of the shared kit, never another source of
 * Blobbi protocol, domain or rendering truth. This test walks `src` and fails
 * on the fingerprints of the pre-nuke duplicates so they cannot creep back.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(__dirname, '..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** Code only: comments may name a kind or a legacy tag when explaining why it is not used. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

const sources = walk(SRC)
  .filter((f) => /\.(ts|tsx|css)$/.test(f) && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx') && !f.includes('/test/'))
  .map((f) => ({ path: relative(SRC, f), text: stripComments(readFileSync(f, 'utf8')) }));

const FORBIDDEN: Array<{ pattern: RegExp; why: string }> = [
  { pattern: /parsePetState|validatePetStateEvent|parseBlobbiFromStateEvent/, why: 'old local 31124 parser' },
  { pattern: /loadBlobbiSvg|blobbi-svg-resolver|svg-customizer|customizeSvg/, why: 'old local SVG render engine' },
  { pattern: /@blobbi\/renderer|\.\.\/blobbi-kit|file:\.\.\//, why: 'sibling or pre-publish package path' },
  { pattern: /\b31124\b|\b11125\b|\b31125\b/, why: 'literal kind number; use the KIND_* constants from @blobbi-kit/core' },
  { pattern: /['"]visual_generation['"]/, why: 'visual_generation is parsed in core' },
  { pattern: /incubation_time|start_incubation|egg_temperature|shell_integrity/, why: 'legacy incubation tags' },
  { pattern: /calculateStatDegradation|applyDecay\(|DECAY_RATE/, why: 'local care/decay formula' },
  { pattern: /import .* from ['"]@blobbi-kit\/(core|react|renderer)\/(?!nostr-protocol)/, why: 'deep import; use the public barrel' },
  { pattern: /nsec1[0-9a-z]{20,}/, why: 'a secret key in source' },
  { pattern: /import .*\.svg['"]|\/assets\/.*(baby|adult|egg).*\.svg/, why: 'Blobbi artwork must come from @blobbi-kit/renderer' },
];

describe('no duplicated Blobbi domain or renderer code in src', () => {
  it('has source files to check', () => {
    expect(sources.length).toBeGreaterThan(5);
  });

  for (const { pattern, why } of FORBIDDEN) {
    it(`contains no ${why} (${pattern})`, () => {
      const hits = sources.filter((s) => pattern.test(s.text)).map((s) => s.path);
      expect(hits).toEqual([]);
    });
  }

  it('renders Blobbis only through @blobbi-kit/renderer', () => {
    const rendererUsers = sources.filter((s) => /BlobbiRenderer\b/.test(s.text));
    expect(rendererUsers.length).toBeGreaterThan(0);
    for (const s of rendererUsers) {
      expect(s.text, s.path).toMatch(/from '@blobbi-kit\/renderer'/);
    }
  });
});
