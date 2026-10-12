/**
 * The Content-Security-Policy of the production page, in one place: the build
 * writes it into `index.html` as a `<meta>` (so every host serves it, whatever
 * its config), and `vercel.json` repeats it as a header with the directives a
 * `<meta>` cannot carry (`frame-ancestors`). A test keeps the two in step.
 *
 * What it allows, and why:
 *   script-src  'self'                  only the app's own bundle; no inline script, no eval, no CDN
 *   style-src   'self' 'unsafe-inline'  the renderer's stylesheet and its SVG carry inline styles
 *   img-src     'self' data: blob: https:  item art (allow-listed hosts), profile pictures (any https),
 *                                       the room's textures and thumbnails (data:, blob:)
 *   connect-src 'self' https: wss:      relays (any wss: a player or signer names), media upload
 *   font-src    'self' data:            the bundled Comfortaa
 *   media-src   'self' blob: data:      nothing remote
 *   object-src  'none'; base-uri 'self'; form-action 'self'
 *   upgrade-insecure-requests           a stray http: request goes out as https:
 *
 * It does not make a secret key in localStorage safe from a script that runs
 * on this origin; it narrows what can run here at all.
 */
export const CSP_DIRECTIVES: readonly string[] = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "media-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'upgrade-insecure-requests',
];

/** The policy as a `<meta>` carries it. */
export const CSP_META = CSP_DIRECTIVES.join('; ');

/** The policy as a response header: the same, plus what only a header can say (no framing by other sites). */
export const CSP_HEADER = [...CSP_DIRECTIVES, "frame-ancestors 'none'"].join('; ');
