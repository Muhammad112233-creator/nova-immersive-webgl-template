import { defineConfig } from "vite";

/**
 * `base` must match how the site is served.
 *   - User/org page  (username.github.io)          -> '/'
 *   - Project page   (username.github.io/repo/)    -> '/repo/'
 * Override without editing this file:  BASE_PATH=/my-repo/ npm run build
 */
const base = process.env.BASE_PATH || "./";

export default defineConfig({
  base,
  server: {
    host: true,
    port: 5173,
    // Allow the sandbox/preview proxy host as well as localhost.
    allowedHosts: true,
  },
  preview: { host: true, port: 4173, allowedHosts: true },
  build: {
    target: "es2020",
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"],
          gsap: ["gsap"],
        },
      },
    },
  },
});
