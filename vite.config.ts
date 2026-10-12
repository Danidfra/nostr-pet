/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { CSP_META } from "./src/config/content-security-policy";

/**
 * The production page carries its Content-Security-Policy itself, as a
 * `<meta>` (src/config/content-security-policy.ts), so it holds on any host.
 * Build only: the dev server injects inline scripts (React refresh) that the
 * policy would block.
 */
function contentSecurityPolicy(): Plugin {
  return {
    name: "blobbi-csp",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP_META}" />`);
    },
  };
}

/**
 * Optional TLS for the dev server, for a REAL account on a phone: browsers
 * give a plain-HTTP LAN address no `crypto.randomUUID`, which the relay
 * connection needs (src/lib/relay-transport.ts). Point these at a cert the
 * phone trusts (mkcert: README "Testing on a phone"); unset, the server is
 * plain HTTP, which the in-memory `?fixture=` worlds do not mind.
 */
function devTls() {
  const cert = process.env.BLOBBI_DEV_TLS_CERT;
  const key = process.env.BLOBBI_DEV_TLS_KEY;
  if (!cert || !key) return undefined;
  return { cert: readFileSync(cert), key: readFileSync(key) };
}

export default defineConfig({
  // "::" binds every interface (IPv6 any, with IPv4 on macOS), so a phone on the same Wi-Fi can open the Mac's address
  server: { host: "::", port: 8080, https: devTls() },
  plugins: [react(), contentSecurityPolicy()],
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
