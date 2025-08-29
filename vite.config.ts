import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig(() => ({
  server: { host: "::", port: 8080 },
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src", 
      filename: "sw.ts",      
      injectRegister: null,   
      manifest: {
        name: "Blobbi - Virtual Pet Lifecycle on Nostr",
        short_name: "Blobbi",
        description: "A decentralized virtual pet game built on the Nostr protocol",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#8b5cf6",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },

      workbox: undefined,
      devOptions: {
        enabled: false,
        type: "module",
      },
    }),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
}));