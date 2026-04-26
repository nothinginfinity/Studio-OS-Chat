import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Phase 5 A-2: manual chunk splitting
// chart.js and its adapter are placed in a dedicated 'vendor-chart' chunk
// so they are only loaded when the chart viewer is opened (lazy import path).
// This prevents chart.js (~60 KB gzip) from blocking initial paint.
const manualChunks: Record<string, string[]> = {
  "vendor-react":   ["react", "react-dom"],
  "vendor-chart":   ["chart.js", "chartjs-adapter-date-fns", "date-fns"],
  "vendor-virtual": ["@tanstack/react-virtual"],
};

export default defineConfig({
  base: "/Studio-OS-Chat/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "generateSW",
      injectRegister: "auto",
      base: "/Studio-OS-Chat/",
      // Phase 5 C-1: hardened Workbox config
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api/],
        // Phase 5 C-1: cache-first for assets, network-only for API
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api"),
            handler: "NetworkOnly",
          },
          {
            // Phase 5 C-1: Ollama local API — never cache
            urlPattern: ({ url }) =>
              url.hostname === "localhost" && url.port === "11434",
            handler: "NetworkOnly",
          },
          {
            // Cache CDN fonts and icons — stale-while-revalidate
            urlPattern: ({ url }) =>
              url.hostname.includes("fonts.googleapis.com") ||
              url.hostname.includes("fonts.gstatic.com"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
        // Phase 5 C-1: skip waiting so updates activate immediately
        skipWaiting: true,
        clientsClaim: true,
      },
      manifest: {
        name: "Studio OS Chat",
        short_name: "Studio OS",
        description: "A local LLM chat PWA powered by Ollama.",
        start_url: "/Studio-OS-Chat/",
        scope: "/Studio-OS-Chat/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#111111",
        theme_color: "#111111",
        icons: [
          {
            src: "/Studio-OS-Chat/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/Studio-OS-Chat/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        // Phase 5 A-2: manual chunking — keeps vendor-chart out of initial JS
        manualChunks,
      },
    },
  },
  server: {
    port: 5173
  }
});
