import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    proxy: { "/api": "http://localhost:3000" },
  },
  plugins: [
    react(),
    VitePWA({
      // Versão nova entra sozinha: evita o problema antigo de link desatualizado.
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Lista do Mercado",
        short_name: "Mercado",
        description: "Lista de compras compartilhada da família.",
        lang: "pt-BR",
        start_url: ".",
        display: "standalone",
        background_color: "#F5F1E6",
        theme_color: "#3E6E52",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "fontes" },
          },
        ],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}", "server/**/*.test.ts"],
  },
});
