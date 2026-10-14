# The guest identity: security audit and protection design (M14.1, 2026-10-13)

This is the audit asked for before any change to how the reserved guest key
is kept, and the design that follows from it. Nothing in this document
changes the canonical V3 identity: a Blobbi's look is still derived from
its owner's pubkey and its `d`, no seed tag is added, and the reserved key
is still the Blobbi's future owner. What is at stake is only **where the
secret half of that key lives between the egg and the save, how it is
backed up, and what can go wrong on the way**.

Status: **audit done; design chosen; section 3 (confinement of the secret)
implemented; sections 4 and 5 waiting for approval** (section 9). The parts
that change nothing a player sees and nothing on disk are in; the parts
that change the save (a backup password, a verification step) and the
one-way step of the storage migration are the approval.

## 1. What the implementation actually does (read, not assumed)

| Question | Finding | Where |
|---|---|---|
| Where is the key generated | On **Meet your Blobbi!**, from nostr-tools' `generateSecretKey` (the same primitive every account here and in Ditto/Island uses); the raw bytes are zeroed after encoding | `guest-signer.ts` → `onboarding/new-account.ts` |
| How is it stored | **Plaintext** `nsec` inside the one guest document in `localStorage` (`blobbi:guest:v1`), rewritten whole on every change (every care action rewrites the secret) | `guest-store.ts` `writeGuestDocument` |
| Other copies | A document that fails parsing is moved to `blobbi:guest:v1:unreadable` (and older quarantines to dated keys), **never deleted**: a quarantined document can hold a plaintext key forever | `guest-store.ts` `quarantine` |
| Is it logged | No. The only log in the guest feature is a dev-only line in the pool that prints an error *message*; the M14 end-to-end tests spy on every console method and assert the nsec never appears; the publish adapter logs only a login's *type* (M13) | `guest-pool.ts`, `m14-play-first.test.tsx`, `usePublishAdapter.ts` |
| Who can read it | **Everything that calls `useGuest()` or `useGuestSnapshot()`**: the document, secret included, is React state handed to the pages, the overview, the room, the menu, the invitation, the ceremony. React DevTools shows it; any component could serialize it by mistake. Only one component needs it: the key step of the ceremony | `useGuest.ts`, `GuestProvider.tsx`, `SaveCeremony.tsx` `KeyStep` |
| How is it restored | Read from `localStorage` at store creation; the nsec is **decoded on every read** to check it matches the pubkey (`identityConsistent`); a mismatch quarantines the document | `guest-store.ts` `readGuestDocument` |
| How does backup work | The save's key step (`KeyGift`): four facts, the nsec shown as text, **Copy key** (clipboard), **Download backup file** (a `.txt` holding the bare nsec, via a blob URL), or **I'll write it down**; then a checkbox "I saved my secret key somewhere safe" gates Continue. The download is never claimed to have been saved. **No verification** that the backup can be read back | `onboarding/KeyScene.tsx`, `new-account.ts` |
| How is the account activated | Continue calls `login.nsec(nsec)`: nostrify's `NLogin.fromNsec` → the login store, which persists `{type:'nsec', data:{nsec}}` **in plaintext** under `nostr:login` (the ecosystem's store; Ditto and Island keep theirs the same way on their own origins). The migration stage is written *before* the sign-in so a refresh resumes | `SaveCeremony.tsx` `KeyStep`, `hooks/useLoginActions.ts`, `@nostrify/react` `NostrLoginProvider` |
| How are events signed | During guest play: **not at all**. The guest world's records carry `sig: ''`, the guest pool refuses to send any unsigned or guest-authored event upstream, and nothing of the guest's is ever asked of a relay. At the save: fresh events from templates of the records, signed by the login's signer through the real publish adapter (sign timeout 45 s, publish timeout 8 s) | `guest-signer.ts`, `guest-pool.ts`, `guest-migration.ts` |
| How is publishing confirmed | Each step (31124, then 11125) is **looked for on the relays first**; found → not published again; published → the relay's acceptance; then **both are read back** (`verifyGuestMigration`) before the record is let go; stage `verifying` persists and the home finishes it at the next mount | `guest-migration.ts`, `useFinishSave.ts` |
| Interrupted migrations | Stage (`key → profile → publishing → verifying → done`) and landed ids are in the record; a refresh resumes at the stage; a refusal stops with Try again and everything in place; relays unreachable but a landed id recorded → trusted; reachable and empty → republished (a replace, same `d`) | `guest-migration.ts`, M14 tests 5 and 6 |
| Existing guest identities | All current guests have the v1 plaintext document; the parser is strict about the version, so any new format needs an explicit reader for v1 | `guest-store.ts` `parseGuestDocument` |

So the description in the brief is right except in two places: the backup is
**not verified** (a checkbox is an acknowledgement, not a check), and the
secret is **not confined** to a secret-handling module; it rides in ordinary
app state.

## 2. Threat model

Who could get the reserved key, and what each design does about it:

| Threat | Today | Sealed storage (section 4) | Confinement (section 3) | Verified backup (section 5) |
|---|---|---|---|---|
| T1 Malicious **same-origin JavaScript** (an XSS, a compromised dependency) while the page is open | Reads `localStorage` and has the key | **No protection**: it can call the same unwrap/decrypt path the app does. A non-extractable `CryptoKey` only stops the key *bytes* from being read; it does not stop their *use* | None by itself; smaller surface for accidental leaks | None |
| T2 Someone who can **read the browser profile on disk** (another user of the device, malware, a backup of the profile) | `localStorage` files are plaintext on disk | **Little**: Chromium, Firefox and WebKit store IndexedDB `CryptoKey` material on disk in the same profile (serialized, not platform-encrypted), so the wrapping key sits beside the wrapped blob | None | None (a backup file is also on disk, by design, elsewhere) |
| T3 A **bug or tool that dumps `localStorage`** (an error report, a debugging export, a sync of site data, a screenshot of DevTools' Application tab) | The key is in the dump | **Real protection**: the dump holds ciphertext and a key id, nothing usable | Real: the secret is not in any document that is dumped on every write | None |
| T4 **Accidental serialization** in app code (a `JSON.stringify(doc)` in a log, state in an error boundary, a test fixture committed with real data) | The document carries the secret everywhere | Partial (the blob is still in the document) | **Real**: the secret is not in the document at all; it lives in one module with one accessor | None |
| T5 Shoulder surfing / clipboard history / a `.txt` on a shared computer at the save | The nsec is shown and copied in the clear, by design, because the player must keep it | Unchanged | Unchanged | **Real for the file**: an NIP-49 `ncryptsec` file is useless without its password; the screen still shows the nsec once (or could show only the ncryptsec: a UX decision, section 9) |
| T6 **Loss**: the browser clears the origin (Safari after 7 days of non-use, "clear site data", a new phone) before the player saved | The Blobbi and its key are gone unless the player saved | **A new way to lose it**: if IndexedDB is cleared without `localStorage` (browsers clear an origin's storage together, but it is not a guarantee: an eviction, a quota error at migration time, a browser bug), the sealed key cannot be opened | None | **Real**: the only cure for loss is a backup the player has verified they can read back |
| T7 Relays and the network | Never see the key; the pool refuses guest events; the key is never in a URL or a request | Unchanged | Unchanged | Unchanged |

The honest summary: **browser encryption of the guest key protects against
dumps and accidents (T3, T4), not against hostile code on the origin (T1) or
disk access (T2), and it adds one loss mode (T6)**. It must never be
described to players as "your key is encrypted and safe". The protections
that matter most against the real losses of a casual player (a cleared
browser, a lost phone) are a **verified, portable backup** and clear words.

## 3. Confinement of the secret (implemented; no user-visible change, nothing changes on disk)

Done in M14.1 (`guest-store.ts`, `guest-context.ts`, `useGuest.ts`,
`SaveCeremony.tsx`, `guest-secret.test.ts`): the store reads the stored
record (`StoredGuestDocument`, secret included), keeps the secret in a
closure, and publishes a document whose identity is `{ pubkey }` alone
(`GuestDocument`); every write puts the secret back (`withSecret`); one
accessor, `revealSecret()`, hands it to the save's key step and nowhere
else; a store whose secret is missing shows the key step an honest error
instead of a key. The record on disk is unchanged (v1), so nothing migrates
and every existing guest reads as before. What this gains is T4 above and
a narrower T3; what it does not gain is anything against T1/T2.

Still open within this section (small, with the sealed record of section
4): the quarantine keeps unreadable documents (they may be a player's only
copy) and, with v1 on disk, a quarantined document still carries the
secret; once the secret has its own record (section 4) it will not.

## 4. Sealed storage (the design to build on approval)

**Primitives** (all built in; no new dependency, no custom cryptography):
Web Crypto `AES-GCM` with a 256-bit key generated with `extractable: false`
and usages `['encrypt', 'decrypt']`, kept as a `CryptoKey` object in
IndexedDB (database `blobbi-guest-vault`, store `keys`, one record
`{ id: 'wrap', key }`; structured clone stores `CryptoKey` objects). The
secret is sealed as `{ v: 1, alg: 'AES-GCM', iv (12 random bytes, fresh per
seal), ct, aad: pubkey }` and stored in `localStorage` under
`blobbi:guest:v2:key` next to the document, which from v2 holds
`identity: { pubkey }` only. The additional data binds the ciphertext to the
pubkey, so a blob moved to another document does not open.

**Lifecycle**: the wrapping key is made the first time a guest begins (or
at legacy migration), never exported, never rotated (there is nothing to
rotate it against); it is deleted with the record when the player removes
the guest Blobbi or when the save is confirmed; the plaintext exists only
in a local variable inside `revealSecret` and the caller's state for the
key step; `Uint8Array`s are zeroed after use (strings cannot be).

**Where it is not available** (no `crypto.subtle`: plain-HTTP LAN
addresses; no IndexedDB: some private windows, blocked site data): the
store falls back to the v1 shape (plaintext in `localStorage`) and the
snapshot says `protection: 'none'`, so the menu's device-only line can say
the key is kept in the clear on this browser. No feature is gated on it.

**Legacy migration (v1 → v2)**, idempotent and interruptible, at store
creation, asynchronous, never on the render path:

1. Read v1. If the vault cannot open (no subtle crypto, no IndexedDB, a
   quota error creating the key), **stop: keep v1 as it is**, report
   `protection: 'none'`. Never generate a new identity.
2. Seal the nsec with the vault key; write `blobbi:guest:v2:key`. If the
   write fails (quota), stop and keep v1 (the sealed record, if partly
   written, is overwritten next time; its presence without a v2 document
   is ignored).
3. **Verify**: unseal the record just written and check its public key
   equals the document's pubkey. Only then:
4. Write the v2 document (identity `{ pubkey }`, everything else copied).
5. Remove the v1 document. (Before this step every reader still finds v1.)

A crash between 2 and 5 leaves v1 intact; the next start repeats from 1.
A v2 document whose sealed record is missing or does not open is reported
as `unreadable: 'sealed key cannot be opened'` and **quarantined, never
deleted**; the home shows the welcome, and the quarantine keeps the blob for
a future recovery tool. This last case is the new loss mode T6 and the
reason the step is one-way: **after step 5 there is no plaintext copy
anywhere on the device**.

**What is gained** is T3/T4 above; **what is not** is T1/T2. The document
and the UI must say so.

## 5. Backup and recovery (the UX change; approval needed)

Today's backup is the nsec itself: shown, copied or downloaded as a plain
text file, acknowledged by a checkbox. It is portable (any Nostr app takes
an nsec) and the restore path exists (sign in with a key or a backup file).
Its weaknesses are T5 and the lack of verification.

**NIP-49** (`ncryptsec1…`, scrypt + XChaCha20-Poly1305) is in nostr-tools
already (`nostr-tools/nip49`, `encrypt(sec, password, logn)` /
`decrypt(ncryptsec, password)`), is implemented by Amber, nsec.app, Coracle,
noStrudel and others, and is the ecosystem's portable encrypted key format.
A backup file holding an `ncryptsec` is useless without its password and
restores in any of those apps or here.

The proposed save, if approved:

1. Key step, as now: the facts; the key may still be shown and copied
   (some players keep it in a password manager, which is a fine backup).
2. **Backup file**: the player chooses a password (shown, not masked, with
   a strength hint; no rules beyond a minimum length), the file
   `blobbi-nostr-key-backup-<npub8>.ncryptsec.txt` is downloaded, and the
   screen says the browser was *asked* to save it.
3. **Verification**, before Continue: the player picks the file back (the
   file input the sign-in screen already has) and types the password; the
   app decrypts in memory, checks the public key, zeroes the bytes, and
   only then enables Continue. Copy-to-clipboard and "I'll write it down"
   can keep their checkbox path **or** be removed (a decision: the brief
   says "require a recoverable backup"; a written-down nsec is recoverable
   but not verifiable here).
4. The four facts gain the password's: *this backup controls your
   identity; losing both the file and this browser's data can lose it for
   good; anyone with the file and its password controls it; the password
   must be remembered or stored securely; Blobbi cannot recover either.*

**Restore**: the sign-in sheet's **Backup file** accepts an `ncryptsec` file
(asks for the password) as well as a plain nsec file; the key goes straight
to the login store as today. Wrong password and a corrupted file are
distinct, said messages; nothing is stored until the key opens.

**Cleanup**: the guest record and the vault key are removed only after the
relays hold both events (as now) **and** a verified backup exists on this
visit (the record remembers `backupVerifiedAt`); otherwise the record stays
with stage `done` and the home offers "Finish your backup" from the menu.

## 6. Activation (unchanged, restated against the brief)

The reserved identity becomes the active account (`login.nsec`), the Blobbi
keeps its address and look (`d`, pubkey; the test asserts
`deriveBlobbiV3Seed` and `getBlobbiVisualIdentity` equal before and after),
canonical events are published from templates of the records under that
key, existing published events are found first and not republished,
retries publish only what is missing, and the guest record goes only after
read-back. Nothing here changes; section 5 adds one more condition to the
cleanup.

The login store keeps the nsec in plaintext after activation
(`nostr:login`). `NostrLoginProvider` accepts a custom `storage` object
(`getItem` may be asynchronous), so the same vault could seal the login
store on this origin without touching the ecosystem's format elsewhere
(every app has its own origin and store). That is a separate decision with
the same T1/T2 limits and is **not** part of this proposal.

## 7. Failure recovery matrix (what must hold, and what the tests will pin)

| Interrupted during | State left | Next start |
|---|---|---|
| Key generation | No record written | Welcome; nothing to recover (the identity never existed) |
| Sealing a new guest's key (vault write fails) | No v2 record, maybe a vault key | Fallback v1 write; `protection: 'none'`; the identity is the one just shown to nobody yet, so a fresh one is fine **only here** (no Blobbi exists yet) |
| Legacy migration steps 1 to 4 | v1 intact, maybe a sealed record | Repeat; the sealed record is overwritten by a fresh seal |
| Legacy migration step 5 | v2 written, v1 maybe still there | v2 wins; v1 removed |
| Backup creation (download) | Nothing changed | Repeat; the password is never stored |
| Backup verification | `backupVerifiedAt` unset | Continue stays off; repeat |
| Activation (sign-in) | Stage `profile` written before `login.nsec` | Resumes at the profile |
| After Blobbi publication, before profile | `landed.blobbi` recorded | Blobbi found on the relays (or the id trusted while they are unreachable), profile published |
| After publication, before cleanup | Stage `verifying`/`done` | Read back at mount; cleared only with a verified backup |
| Browser storage quota at any write | The write reports false | The document stays in memory for the session; the UI says the Blobbi will not be remembered |
| Corrupted document or sealed record | Quarantined, never deleted | Welcome; the quarantine keeps the data |
| No Web Crypto / no IndexedDB | v1 kept | Plays as before; `protection: 'none'` said in the menu |

## 8. Tests (which exist, which are new)

Already in the suite and kept: deterministic canonical appearance across
the save (`guest-migration.test.ts`, M14 test 3); existing identity
preserved and never merged (M14 tests 7, 8); no private-key logging (M14
console spies, `onboarding.test.tsx` `nothingLeaked`); duplicate
publication prevention (migration tests: found → not republished; retry
publishes only what is missing); guest gameplay without publication (M14
tests 1, 2; `guest-pool.test.ts`); interrupted migration and activation
(M14 tests 5, 6); existing account compatibility (M14 test 7, 8; the room's
sign-in sheet, `m14-1-reliability.test.tsx`); save compatibility (M14 test
3 and 9; M14.1 tests 1 and 3).

New with the implementation: sealed storage round trip over a fake vault
(an in-memory `KeyStore` behind the same interface as the IndexedDB one;
Node's Web Crypto does the AES-GCM); no `nsec` in the v2 document or the
snapshot (`JSON.stringify` contains none); legacy v1 → v2 migration
(complete; interrupted after each step; vault unavailable keeps v1; quota
error keeps v1; corrupted sealed record quarantines, never deletes);
NIP-49 backup generation and restoration; wrong password; corrupted
backup; verification gate before Continue; cleanup refused without a
verified backup.

## 9. What needs approval, with the alternatives

1. **The one-way step of sealed storage** (section 4, step 5): after it, the
   only copies of the key are the sealed record and the vault key on this
   browser, which gain protection against dumps (T3/T4) and lose nothing
   against hostile code (T1) or disk access (T2), and add loss mode T6.
   Alternatives: (a) seal and remove the plaintext (proposed); (b) confine
   the secret (section 3) without sealing: most of the accident protection,
   no new loss mode, no encryption to explain; (c) do nothing to storage.
   Recommendation: **(b) now, (a) once the verified backup exists**, so
   sealing never creates a key that cannot be recovered from a backup.
2. **A password-protected, verified backup before activation** (section 5):
   a new secret the player must keep (the password), a longer save (choose
   a password, download, pick the file back, type the password), a
   different key scene. Alternatives: (a) NIP-49 file + verification
   (proposed); (b) keep the plain nsec backup but add the verification (pick
   the file or paste the key back); (c) keep today's acknowledgement.
   Recommendation: **(a)**, keeping Copy key as an equal path for password
   managers, with (b)'s verification for it (paste it back).
3. Whether to seal the **login store** too (section 6). Recommendation: not
   now; decide with the ecosystem.

## 10. Manual validation checklist (once implemented)

1. New guest on Safari and Chrome: the egg; Settings → Advanced → Website
   Data shows the origin; the `localStorage` entries hold no `nsec1`
   (DevTools → Application → Local Storage: `blobbi:guest:v2` has only a
   pubkey; `blobbi:guest:v2:key` is a blob); IndexedDB has `blobbi-guest-vault`.
2. Reload: the same Blobbi. Close the browser fully; reopen: the same.
3. An old build's v1 record (made before this change): open the new build;
   the same Blobbi; the record is v2 now; v1 is gone; the quarantine keys
   are untouched.
4. Private window: the guest plays; the menu says the key is kept in the
   clear or will not be remembered (whichever the browser gives).
5. Save: the password, the file, the file picked back, the password typed,
   Continue; the profile; the connection; the Blobbi at home; the account
   in the menu. Sign out; sign in with the backup file and its password;
   the Blobbi is there. Wrong password: said; a corrupted file: said.
6. Airplane mode at the connection step: Try again later completes it,
   one Blobbi.
7. The console, the network tab, the URL: never an `nsec1`, never an
   `ncryptsec1`.

## 11. Known risks after the change

- T1 and T2 remain; the words in the app must not promise otherwise.
- T6: a browser that drops IndexedDB alone makes the sealed key unopenable;
  the quarantine keeps the blob, but without the vault key it is noise.
  Mitigated only by the verified backup and by sealing after the backup
  exists (recommendation 1).
- A player who forgets the backup password has, after the guest record is
  cleared, only the login store's plaintext nsec on this browser; the
  Account screen's key backup (plain nsec) remains the way out while that
  browser lives.
- The login store is plaintext after activation (section 6).

## 12. M15 audit (2026-10-14): the key's life, read again; what changed, what remains

Scope: the nine points of the M15 brief, read against the code as it stands
after M14.3.1 and the M15 changes below. No redesign of the key
architecture; no AES-GCM, no NIP-49 (sections 4 and 5 still wait for
approval). Nothing in this section was observed in a browser; it is read
from the code and pinned by the suites named.

| Point | Finding | Changed in M15 |
|---|---|---|
| Generation | `generateSecretKey` through `createNewAccount`; raw bytes zeroed after encoding; made on **Meet your Blobbi!** and nowhere else (`reserveGuestIdentity`) | No |
| Persistence | Plaintext `nsec` in the v1 record (`blobbi:guest:v1`), rewritten whole on every change of the record. M15 adds two more writers of the record: the active-time flush (`useSaveInvite`, every 15 s of active play and on hide/blur/unmount) and "Don't ask again". Each write puts the secret back from the store's closure (`withSecret`); none reads it into component state | More writes of the same record; the secret's confinement (section 3) holds: `guest-secret.test.ts` still passes, the new suites assert the snapshot and the console hold no nsec |
| Migration into the login store | `login.nsec` after the stage is written; the login store keeps it in plaintext under `nostr:login` (the ecosystem's store) | No |
| Backup acknowledgement | A checkbox, not a verification (section 1) | No (section 5 waits) |
| Relay publication | Fresh events from templates, signed by the login's signer; the guest pool refuses unsigned or guest-authored events upstream; nothing of the guest's reaches a relay before the save (`m15-reliability.test.tsx` asserts `relay.published` empty through every new flow) | No |
| Cleanup after a successful migration | `store.clear()` removes the record and leaves the keys the device kept under the pubkey (rooms, toys, Journey, ledger, selected Blobbi): the account IS that pubkey, so they are its own now | Made explicit and pinned (`guest-cleanup.test.ts`) |
| Interrupted migration recovery | Stage and landed ids in the record; `useFinishSave` at mount for `verifying`/`done`; a refresh at `key` shows the key again from the store | No; re-read, still as section 7 says |
| Sign-in to a different account | The record is untouched (`resolveGuestMode` → `dormant`); the word about it is now in plain words, closing it writes nothing (`conflictDeferred`, in memory for the visit), Keep writes the account's pubkey into `conflicts` as before, and neither path touches the identity | Copy, Decide later, the separate removal; pinned end to end |
| Deletion of guest data | **Before M15** "Remove" called `store.clear()`: the record went, and every other key the device kept under the guest pubkey stayed behind (room, toys, layout, 3D nav and intro, Journey, spend ledger, selected Blobbi). **Now** `store.remove()` → `removeGuestFromDevice` removes the record, the keys from the stores' own builders, and (as a net) any `blobbi:`-prefixed key with the guest pubkey as a segment; it never touches `nostr:login`, any other pubkey's keys, device-wide preferences or the quarantine. The flow asks an explicit acknowledgement when the Blobbi was never saved | New; every path pinned (`guest-cleanup.test.ts`, `m15-reliability.test.tsx`) |

Findings worth acting on later (none blocks M15):

1. **The quarantine still holds plaintext keys** (`blobbi:guest:v1:unreadable*`),
   as section 3 says; a removal leaves it alone because an unreadable
   document cannot be attributed to the guest being removed. A future
   recovery tool should be the one to clear it, with the player.
2. **More frequent writes of the secret.** The active-time flush rewrites the
   record (secret included) every 15 s of active play. It changes nothing
   about where the secret lives, but it is one more reason to seal the
   record (section 4) before the invitation's bookkeeping grows further. If
   the flush is ever judged too chatty, `INVITE_FLUSH_MS` is the knob;
   the time lost on a crash is at most one stretch.
3. **Removal is not atomic across keys.** `removeGuestFromDevice` removes
   the record first, then the rest; a storage that refuses halfway leaves
   orphaned per-pubkey keys without a record. They hold no secret (the
   secret is only in the record) and name a pubkey that no longer exists on
   the device. The result reports `ok: false` and the store still empties
   its snapshot, so the UI never shows a half-removed guest.
4. **Test reports.** The M14 suites compare the shown key to the seeded one
   (`expect(shown).toBe(doc.identity.nsec)`); a failure would print both.
   The keys are random and thrown away, so nothing real can leak, but the
   M15 suites compare pubkeys and assert the absence of the nsec instead,
   and new tests should keep to that.
5. **The login store after a dormant removal.** Removing a guest while
   signed in to another account leaves that account's login where it was,
   by design; the test asserts it. There is no path that removes a login
   from this flow.

Remaining risks after M15: T1, T2 and T6 of section 2 exactly as before;
the plaintext login store (section 6); the unverified backup (section 5).
None of them is new, and the words in the app still promise none of them
away.
