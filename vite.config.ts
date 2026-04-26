import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Phase 5 A-2: manual chunk splitting
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
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api"),
            handler: "NetworkOnly",
          },
          {
            urlPattern: ({ url }) =>
              url.hostname === "localhost" && url.port === "11434",
            handler: "NetworkOnly",
          },
          {
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
        manualChunks,
      },
    },
  },
  server: {
    port: 5173
  },
  // Fix: Vitest needs jsdom environment so File/FileReader/Blob APIs exist
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/unit/setup.ts"],
    globals: true,
    include: ["tests/unit/**/*.test.ts"],
  },
});
