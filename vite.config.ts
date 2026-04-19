import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

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
            handler: "NetworkOnly"
          }
        ]
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
  server: {
    port: 5173
  }
});
