# Deploying Blobbi Standalone (blobbi.pet)

This is the production architecture as prepared in the repository. **Nothing
here has been deployed, and no DNS has been changed.** Every statement about
the live site is marked with the date it was observed.

## What the app is, for a host

- A static single-page app: `npm run build` writes `dist/` (an `index.html`,
  hashed files under `dist/assets/`, the public images). No server code, no
  database, no secrets at build or run time.
- All data lives on Nostr relays, reached from the browser over `wss:`.
- The build also copies `index.html` to `404.html`, for hosts that serve a
  `404.html` for unknown paths (GitHub Pages and similar).

## Where it runs today (observed 2026-10-12)

| Address | Observed |
|---|---|
| `https://blobbi.pet/` | 307 to `https://www.blobbi.pet/` |
| `https://www.blobbi.pet/` | 200, `server: Vercel`, HSTS `max-age=63072000`; an older build of this app |
| `https://www.blobbi.pet/room` | **404 status**, page served from the `404.html` fallback |
| Security headers | No CSP, no `X-Content-Type-Options`, no `Referrer-Policy` |

So the current host is Vercel. The repository now carries a `vercel.json`
for it; on another host, the same rules have to be expressed in that host's
configuration (see "On another host").

## What the repository now provides

**SPA fallback.** `vercel.json` rewrites every path that is not a file to
`/index.html`, so `/room` and every other route answer **200** with the app
rather than a 404 status (which some browsers, crawlers and link previews
treat as an error).

**Security headers** (`vercel.json`, all paths):

| Header | Value | Why |
|---|---|---|
| `Content-Security-Policy` | see below | XSS damage limitation |
| `X-Content-Type-Options` | `nosniff` | no MIME sniffing of scripts |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | no full URLs to other sites |
| `X-Frame-Options` | `DENY` | no framing (clickjacking); also `frame-ancestors 'none'` |
| `Permissions-Policy` | camera, microphone, geolocation, payment, usb off | the app uses none |
| `Cross-Origin-Opener-Policy` | `same-origin-allow-popups` | isolates the window, keeps a signer's approval popup working |

**Content Security Policy.** One source of truth,
`src/config/content-security-policy.ts`, used twice: as a `<meta>` tag
injected into the production `index.html` by the build (so any static host
gets it, even without header support), and as the header in `vercel.json`
(the header adds `frame-ancestors 'none'`, which a meta tag cannot carry).
A test fails if the two drift apart.

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:; font-src 'self' data:;
connect-src 'self' https: wss:; media-src 'self' blob: data:;
worker-src 'self' blob:; manifest-src 'self'; object-src 'none';
base-uri 'self'; form-action 'self'; upgrade-insecure-requests
```

- `script-src 'self'`: no inline or remote scripts; the build emits none.
- `style-src 'unsafe-inline'`: React and three.js set inline styles.
- `img-src https:`: item pictures come from Blossom servers chosen by issuers.
- `connect-src https: wss:`: relays are chosen by the player and their signer
  and cannot be listed in advance.
- The development server does not apply the CSP (its hot reload needs inline
  scripts); only `vite build` output carries it.

Verified: the production build served by `vite preview` under this CSP ran
the welcome, the cast of three Blobbis and the key screen with **no CSP
violation and no console error** (2026-10-12, desktop Chrome). **Not yet
verified under the CSP:** the 3D room with a real account, a NIP-46 bunker
sign-in, and an extension sign-in.

**Caching.** `/assets/*` (content-hashed names) are `immutable` for a year;
`index.html` is `no-cache`. A route rewritten to `index.html` (such as
`/room`) gets Vercel's default for HTML (`max-age=0, must-revalidate`).
Check both on the real deployment.

**HTTPS and HSTS.** Already in place on the current host. The app needs a
secure context: Web Crypto (`crypto.getRandomValues`, `crypto.subtle`) is
only available over HTTPS or on `localhost`, and the key screen refuses to
make a key without it.

**Error handling.** A whole-app error boundary (`AppErrorBoundary`) replaces a
white page with a card that says nothing was changed and offers Reload; the
room keeps its own boundary.

## Decisions that need a human with access

These are not guesses; they need someone with the hosting account or DNS.

1. **Confirm the provider** is Vercel for `www.blobbi.pet` (the response
   headers say so), and which project and branch deploy it.
2. **Which domain is canonical.** Today the apex redirects to `www`. Keep it,
   or flip it, in the provider's domain settings and DNS.
3. **Deploy this build** to a preview URL first; check the headers with
   `curl -sI https://<preview>/room` and run `LAUNCH_TEST_PLAN.md` there.
4. **Relays.** The defaults are in `src/config/relays.ts`. Confirm they are
   the ones the ecosystem wants for launch.
5. **Production logging.** The kit (`@blobbi-kit/*`) logs query filters to
   the console in production builds. It is noise, not a leak of secrets, but
   it should be turned off in the kit (not changed from here).

## On another host

Express the same five things: SPA fallback answering 200, the headers
table, `frame-ancestors 'none'`, immutable `/assets/*`, `no-cache` HTML.
Netlify (`_redirects` + `_headers`), Cloudflare Pages (`_headers`,
SPA mode) and nginx (`try_files $uri /index.html; add_header ...`) all
can. Without header support, the meta CSP still applies but framing
protection does not.

## Keys and storage (what the host cannot fix)

- A key made or pasted here is kept by the login store in this origin's
  `localStorage` (`nostr:login`). **`localStorage` is not protected from XSS:**
  any script running on the origin can read it. The CSP and the absence of
  injectable HTML reduce that risk; they do not remove it. Extension
  (NIP-07) and bunker (NIP-46) sign-ins keep the secret out of the page and
  are the safer choice; the sign-in screen offers them first.
- Each `*.blobbi.pet` subdomain is its own origin with its own storage. Keys
  are **never** sent between subdomains, in a URL, or to any server.
