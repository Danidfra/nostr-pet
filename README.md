# Blobbi

**The home of your Blobbi.** The standalone Blobbi app for
[blobbi.pet](https://www.blobbi.pet/): see your current Blobbi, how it is
doing, and step out to [Blobbi Island](https://island.blobbi.pet) when you
are ready.

Built on the shared Blobbi packages (`@blobbi-kit/core`, `@blobbi-kit/react`,
`@blobbi-kit/renderer`). See [ARCHITECTURE.md](./ARCHITECTURE.md) for what
lives here and what lives in the kit.

## Development

```bash
npm install
npm run dev        # http://localhost:8080
```

Sign in with a NIP-07 browser extension or a NIP-46 `bunker://` URI, or
create a new Nostr account in the app (the secret key is shown once and
must be backed up; see ARCHITECTURE.md, "the way in").

Copy `.env.example` to `.env.local` to point "Enter Blobbi Island" at a local
or staging Island.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run check      # all of the above
```
