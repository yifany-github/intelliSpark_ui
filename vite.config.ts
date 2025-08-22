import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(async () => {
  const plugins = [react()];
  
  // Only load Replit plugins in Replit environment
  if (process.env.REPL_ID !== undefined) {
    try {
      const { default: runtimeErrorOverlay } = await import("@replit/vite-plugin-runtime-error-modal");
      plugins.push(runtimeErrorOverlay());
      
      if (process.env.NODE_ENV !== "production") {
        const { cartographer } = await import("@replit/vite-plugin-cartographer");
        plugins.push(cartographer());
      }
    } catch (error) {
      console.warn("Replit plugins not available:", error.message);
    }
  }

  return {
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    root: path.resolve(import.meta.dirname, "client"),
    envDir: path.resolve(import.meta.dirname), // Look for .env files in project root
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:8000",
          changeOrigin: true,
          secure: false,
        },
        "/assets": {
          target: "http://localhost:8000",
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
