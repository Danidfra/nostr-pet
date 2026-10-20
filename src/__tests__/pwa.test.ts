/**
 * The installable page: a valid web app manifest the page links to, icons that exist at the sizes they claim (a
 * maskable one among them), the Apple touch icon and favicons in the page's head, a policy that lets the manifest
 * load, and no service worker (nothing here caches a build, a key or a relay answer).
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CSP_DIRECTIVES } from '@/config/content-security-policy';
import { worlds } from '@/features/worlds/worlds';

const html = readFileSync('index.html', 'utf8');
const manifest = JSON.parse(readFileSync(join('public', 'manifest.webmanifest'), 'utf8')) as {
  name: string;
  short_name: string;
  start_url: string;
  display: string;
  theme_color: string;
  icons: { src: string; sizes: string; type: string; purpose?: string }[];
};

/** The size a PNG file's header declares. */
function pngSize(file: string): [number, number] {
  const b = readFileSync(file);
  expect(b.subarray(1, 4).toString('ascii'), file).toBe('PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe('the web app manifest', () => {
  it('names the app, starts at the root, opens standalone, and the page links to it with the same theme colour', () => {
    expect(manifest.name).toBe('Blobbi Home');
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(html).toContain(`<meta name="theme-color" content="${manifest.theme_color}" />`);
    expect(CSP_DIRECTIVES).toContain("manifest-src 'self'");
  });

  it('lists a 192 and a 512 "any" icon and a 512 maskable icon, each a PNG of exactly that size', () => {
    const by = (sizes: string, purpose: string) => manifest.icons.find((i) => i.sizes === sizes && (i.purpose ?? 'any') === purpose);
    expect(by('192x192', 'any')).toBeDefined();
    expect(by('512x512', 'any')).toBeDefined();
    expect(by('512x512', 'maskable')).toBeDefined();
    for (const icon of manifest.icons) {
      const file = join('public', icon.src);
      expect(existsSync(file), file).toBe(true);
      expect(icon.type).toBe('image/png');
      const [w, h] = icon.sizes.split('x').map(Number);
      expect(pngSize(file), icon.src).toEqual([w, h]);
    }
  });
});

describe('the page head and the other worlds', () => {
  it('links the SVG and PNG favicons and a 180 px Apple touch icon, all shipped', () => {
    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />');
    expect(html).toContain('<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />');
    expect(html).toContain('<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />');
    expect(pngSize(join('public', 'icons', 'favicon-32.png'))).toEqual([32, 32]);
    expect(pngSize(join('public', 'icons', 'apple-touch-icon.png'))).toEqual([180, 180]);
    expect(readFileSync(join('public', 'icons', 'icon.svg'), 'utf8').startsWith('<svg')).toBe(true);
  });

  it("every world card's icon is shipped by this app, 192 px square, on this origin", () => {
    for (const w of worlds()) {
      expect(w.icon.startsWith('/icons/worlds/')).toBe(true);
      const file = join('public', w.icon);
      expect(existsSync(file), file).toBe(true);
      expect(pngSize(file), w.icon).toEqual([192, 192]);
    }
  });

  it('no service worker: nothing registers one', () => {
    expect(existsSync(join('public', 'sw.js'))).toBe(false);
    expect(html).not.toMatch(/serviceWorker/);
  });
});
