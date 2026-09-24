/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional override for the Blobbi Island destination (absolute https URL). */
  readonly VITE_BLOBBI_ISLAND_URL?: string;
  /** 'true' enables dev-only lifecycle shortcuts (force hatch/evolve). Never read in production builds. */
  readonly VITE_BLOBBI_DEV_TOOLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
