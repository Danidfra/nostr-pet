/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional override for the Blobbi Island destination (absolute https URL). */
  readonly VITE_BLOBBI_ISLAND_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
