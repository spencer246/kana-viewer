import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  optimizeDeps: { exclude: ["harfbuzzjs"] },
  build: { target: "es2022" },
});
