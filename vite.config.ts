import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(async ({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  const plugins = [];
  
  // Add React plugin - always use React plugin normally
  plugins.push(react());
  
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
        "@": path.resolve(rootDir, "client", "src"),
        "@assets": path.resolve(rootDir, "attached_assets"),
        "use-sync-external-store/shim/index.js": path.resolve(rootDir, "client", "shims", "use-sync-external-store", "shim", "index.ts"),
        "use-sync-external-store": path.resolve(rootDir, "client", "shims", "use-sync-external-store"),
      },
    },
    root: path.resolve(rootDir, "client"),
    envDir: path.resolve(rootDir), // Look for .env files in project root
    build: {
      outDir: path.resolve(rootDir, "dist/public"),
      emptyOutDir: true,
      rollupOptions: {
        onwarn(warning, warn) {
          // Ignore TypeScript warnings during build
          if (warning.code === 'TYPESCRIPT_ERROR') return;
          warn(warning);
        }
      }
    },
    esbuild: {
      // Skip TypeScript checking entirely for CI builds
      ...(process.env.VITE_SKIP_TS_CHECK === 'true' && {
        target: 'esnext',
        tsconfigRaw: {
          compilerOptions: {
            skipLibCheck: true,
            noEmit: true
          }
        }
      })
    },
    server: {
      proxy: {
        "/api": {
          target: env.VITE_API_BASE_URL || "http://localhost:8000",
          changeOrigin: true,
          secure: false,
        },
        "/assets": {
          target: env.VITE_API_BASE_URL || "http://localhost:8000",
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
