import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Served under /quiz on teamsrkwarriors.in (via a rewrite from the main site).
// base + nested outDir put every asset physically under /quiz/ so the proxy works.
export default defineConfig({
  base: "/quiz/",
  plugins: [react()],
  build: { outDir: "dist/quiz" },
});
