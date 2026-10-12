/**
 * The kit's renderer injects its finished SVG as raw HTML, and a Blobbi's
 * event comes from any relay. Every field of the event that reaches the
 * drawing (the colours, the name, the pattern, the mark, the adult form,
 * the generation) is filled with markup here, for every generation and stage,
 * and nothing executable may reach the DOM: no element that is not SVG
 * artwork, no event-handler attribute, no `javascript:` URL. This pins the
 * kit's normalization (hex colours, closed vocabularies) as the app's XSS
 * boundary for the renderer; if a kit upgrade loosens it, this fails.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { BlobbiRenderer } from '@blobbi-kit/renderer';
import { parseModernBlobbiEvent } from '@blobbi-kit/core';
import { blobbiEvent } from '@/test/fixtures';
import { toBlobbiVisual } from '@/lib/blobbi-visual';

const EVIL = [
  '#fff"/><img src=x onerror=alert(1)><path d="',
  "red' onload='alert(1)",
  '</svg><script>alert(1)</script>',
  'url(javascript:alert(1))',
];
const SVG_TAGS = new Set(['svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'defs', 'lineargradient', 'radialgradient', 'stop', 'clippath', 'mask', 'filter', 'fegaussianblur', 'feoffset', 'feblend', 'fecolormatrix', 'fecomposite', 'feflood', 'femerge', 'femergenode', 'fedropshadow', 'use', 'title', 'desc', 'pattern', 'text', 'tspan', 'symbol', 'animate', 'animatetransform', 'style', 'div', 'span']);

describe('the renderer as an XSS boundary', () => {
  it.each(['v1', 'v2', 'v3'] as const)('%s: markup in any event field never becomes an element, a handler or a script URL', (gen) => {
    for (const stage of ['egg', 'baby', 'adult'] as const) {
      for (const evil of EVIL) {
        const ev = blobbiEvent('0000000001', {
          stage,
          name: evil,
          visualGeneration: gen,
          set: { base_color: evil, secondary_color: evil, eye_color: evil, pattern: evil, special_mark: evil, adult_type: evil },
        });
        const b = parseModernBlobbiEvent(ev);
        if (!b) continue;
        const { container, unmount } = render(<BlobbiRenderer visual={toBlobbiVisual(b)} instanceId={`x-${gen}-${stage}`} size={96} label={b.name} />);
        for (const el of container.querySelectorAll('*')) {
          expect(SVG_TAGS.has(el.tagName.toLowerCase()), `${gen} ${stage}: <${el.tagName}>`).toBe(true);
          for (const attr of el.getAttributeNames()) {
            expect(attr.startsWith('on'), `${gen} ${stage}: ${attr}`).toBe(false);
            // A URL-loading attribute never carries a script URL (text attributes such as the name's aria-label are inert)
            if (['href', 'xlink:href', 'src', 'action', 'formaction'].includes(attr)) expect(el.getAttribute(attr)?.toLowerCase().includes('javascript:'), `${gen} ${stage}: ${attr}`).toBe(false);
          }
        }
        expect(container.querySelector('script, img, iframe, object, foreignObject')).toBeNull();
        unmount();
      }
    }
  });
});
