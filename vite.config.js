import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Serve under davidfeijoo.com/gpr-explorer/ — all asset and data URLs
  // become relative to this base. Dev server also serves at /gpr-explorer/.
  base: "/gpr-explorer/",
});
