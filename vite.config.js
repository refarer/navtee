import { defineConfig } from "vite";
import { reactRouter } from "@react-router/dev/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    reactRouter(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "app",
      filename: "sw.js",
      injectRegister: null,
      pwaAssets: {
        image: "public/logo.svg",
      },
      manifest: {
        name: "Navtee",
        short_name: "Navtee",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#2e7d32",
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
