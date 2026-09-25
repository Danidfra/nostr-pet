/**
 * Blossom servers for the one upload this app makes (a profile picture).
 * The list is Ditto's application list (`APP_BLOSSOM_SERVERS` in Ditto's
 * `src/lib/appBlossom.ts`), so a picture uploaded here lives where the rest
 * of the ecosystem's media lives. Uploads go through nostrify's
 * `BlossomUploader` (BUD-02 with a NIP-98-style authorization signed by the
 * player's signer); nothing else is ever uploaded.
 */
export const BLOSSOM_SERVERS: readonly string[] = ['https://blossom.ditto.pub/', 'https://blossom.dreamith.to/', 'https://blossom.primal.net/'];
