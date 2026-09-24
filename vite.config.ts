/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";

export default defineConfig({
  server: { host: "::", port: 8080 },
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: {
    rollupOptions: {
      output: {
        // Vendor code changes far less often than the app: keep it in its own
        // chunks so a deploy invalidates only what changed.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom", "@tanstack/react-query"],
          nostr: ["@nostrify/nostrify", "@nostrify/react", "nostr-tools"],
          blobbi: ["@blobbi-kit/core", "@blobbi-kit/react", "@blobbi-kit/renderer", "@nostr-games/inventory"],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
