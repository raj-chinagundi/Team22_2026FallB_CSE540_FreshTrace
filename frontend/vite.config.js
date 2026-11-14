// Vite config. fs.allow lets the app read ../deployments/*.json from the repo root.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    fs: { allow: [".."] },
  },
  // ethers is big, the default 500 kB warning isn't useful here
  build: { chunkSizeWarningLimit: 1000 },
});
