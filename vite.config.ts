import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    server: { port: 4310, host: "0.0.0.0" },
    plugins: [react()],
    resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
    build: {
      rollupOptions: {
        input: path.resolve(process.cwd(), "index.html")
      }
    },
    define: {
      "process.env.GEMINI_API_KEY": JSON.stringify(env.VITE_GEMINI_API_KEY)
    }
  };
});
