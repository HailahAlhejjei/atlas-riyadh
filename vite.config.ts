import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages serves the site from /<repo>/; local dev stays at /
  base: process.env.GITHUB_PAGES ? "/atlas-riyadh/" : "/",
  plugins: [react()],
  worker: { format: "es" },
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three", "@react-three/fiber", "@react-three/drei"],
          maplibre: ["maplibre-gl"],
        },
      },
    },
  },
});
