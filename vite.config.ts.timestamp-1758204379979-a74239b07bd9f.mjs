// vite.config.ts
import { defineConfig, loadEnv } from "file:///Users/yongboyu/Desktop/intelliSpark_ui/node_modules/vite/dist/node/index.js";
import react from "file:///Users/yongboyu/Desktop/intelliSpark_ui/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "path";
var __vite_injected_original_dirname = "/Users/yongboyu/Desktop/intelliSpark_ui";
var vite_config_default = defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const plugins = [react()];
  if (process.env.REPL_ID !== void 0) {
    try {
      const { default: runtimeErrorOverlay } = await import("file:///Users/yongboyu/Desktop/intelliSpark_ui/node_modules/@replit/vite-plugin-runtime-error-modal/dist/index.mjs");
      plugins.push(runtimeErrorOverlay());
      if (process.env.NODE_ENV !== "production") {
        const { cartographer } = await import("file:///Users/yongboyu/Desktop/intelliSpark_ui/node_modules/@replit/vite-plugin-cartographer/dist/index.mjs");
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
        "@": path.resolve(__vite_injected_original_dirname, "client", "src"),
        "@assets": path.resolve(__vite_injected_original_dirname, "attached_assets")
      }
    },
    root: path.resolve(__vite_injected_original_dirname, "client"),
    envDir: path.resolve(__vite_injected_original_dirname),
    // Look for .env files in project root
    build: {
      outDir: path.resolve(__vite_injected_original_dirname, "dist/public"),
      emptyOutDir: true
    },
    server: {
      proxy: {
        "/api": {
          target: env.VITE_API_BASE_URL || "http://localhost:8000",
          changeOrigin: true,
          secure: false
        },
        "/assets": {
          target: env.VITE_API_BASE_URL || "http://localhost:8000",
          changeOrigin: true,
          secure: false
        }
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMveW9uZ2JveXUvRGVza3RvcC9pbnRlbGxpU3BhcmtfdWlcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy95b25nYm95dS9EZXNrdG9wL2ludGVsbGlTcGFya191aS92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMveW9uZ2JveXUvRGVza3RvcC9pbnRlbGxpU3BhcmtfdWkvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcsIGxvYWRFbnYgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKGFzeW5jICh7IG1vZGUgfSkgPT4ge1xuICAvLyBMb2FkIGVudiBmaWxlIGJhc2VkIG9uIGBtb2RlYCBpbiB0aGUgY3VycmVudCB3b3JraW5nIGRpcmVjdG9yeS5cbiAgY29uc3QgZW52ID0gbG9hZEVudihtb2RlLCBwcm9jZXNzLmN3ZCgpLCAnJyk7XG4gIGNvbnN0IHBsdWdpbnMgPSBbcmVhY3QoKV07XG4gIFxuICAvLyBPbmx5IGxvYWQgUmVwbGl0IHBsdWdpbnMgaW4gUmVwbGl0IGVudmlyb25tZW50XG4gIGlmIChwcm9jZXNzLmVudi5SRVBMX0lEICE9PSB1bmRlZmluZWQpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgeyBkZWZhdWx0OiBydW50aW1lRXJyb3JPdmVybGF5IH0gPSBhd2FpdCBpbXBvcnQoXCJAcmVwbGl0L3ZpdGUtcGx1Z2luLXJ1bnRpbWUtZXJyb3ItbW9kYWxcIik7XG4gICAgICBwbHVnaW5zLnB1c2gocnVudGltZUVycm9yT3ZlcmxheSgpKTtcbiAgICAgIFxuICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSBcInByb2R1Y3Rpb25cIikge1xuICAgICAgICBjb25zdCB7IGNhcnRvZ3JhcGhlciB9ID0gYXdhaXQgaW1wb3J0KFwiQHJlcGxpdC92aXRlLXBsdWdpbi1jYXJ0b2dyYXBoZXJcIik7XG4gICAgICAgIHBsdWdpbnMucHVzaChjYXJ0b2dyYXBoZXIoKSk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUud2FybihcIlJlcGxpdCBwbHVnaW5zIG5vdCBhdmFpbGFibGU6XCIsIGVycm9yLm1lc3NhZ2UpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7XG4gICAgcGx1Z2lucyxcbiAgICByZXNvbHZlOiB7XG4gICAgICBhbGlhczoge1xuICAgICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKGltcG9ydC5tZXRhLmRpcm5hbWUsIFwiY2xpZW50XCIsIFwic3JjXCIpLFxuICAgICAgICBcIkBhc3NldHNcIjogcGF0aC5yZXNvbHZlKGltcG9ydC5tZXRhLmRpcm5hbWUsIFwiYXR0YWNoZWRfYXNzZXRzXCIpLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHJvb3Q6IHBhdGgucmVzb2x2ZShpbXBvcnQubWV0YS5kaXJuYW1lLCBcImNsaWVudFwiKSxcbiAgICBlbnZEaXI6IHBhdGgucmVzb2x2ZShpbXBvcnQubWV0YS5kaXJuYW1lKSwgLy8gTG9vayBmb3IgLmVudiBmaWxlcyBpbiBwcm9qZWN0IHJvb3RcbiAgICBidWlsZDoge1xuICAgICAgb3V0RGlyOiBwYXRoLnJlc29sdmUoaW1wb3J0Lm1ldGEuZGlybmFtZSwgXCJkaXN0L3B1YmxpY1wiKSxcbiAgICAgIGVtcHR5T3V0RGlyOiB0cnVlLFxuICAgIH0sXG4gICAgc2VydmVyOiB7XG4gICAgICBwcm94eToge1xuICAgICAgICBcIi9hcGlcIjoge1xuICAgICAgICAgIHRhcmdldDogZW52LlZJVEVfQVBJX0JBU0VfVVJMIHx8IFwiaHR0cDovL2xvY2FsaG9zdDo4MDAwXCIsXG4gICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICAgIHNlY3VyZTogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICAgIFwiL2Fzc2V0c1wiOiB7XG4gICAgICAgICAgdGFyZ2V0OiBlbnYuVklURV9BUElfQkFTRV9VUkwgfHwgXCJodHRwOi8vbG9jYWxob3N0OjgwMDBcIixcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgICAgc2VjdXJlOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF1UyxTQUFTLGNBQWMsZUFBZTtBQUM3VSxPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBRmpCLElBQU0sbUNBQW1DO0FBSXpDLElBQU8sc0JBQVEsYUFBYSxPQUFPLEVBQUUsS0FBSyxNQUFNO0FBRTlDLFFBQU0sTUFBTSxRQUFRLE1BQU0sUUFBUSxJQUFJLEdBQUcsRUFBRTtBQUMzQyxRQUFNLFVBQVUsQ0FBQyxNQUFNLENBQUM7QUFHeEIsTUFBSSxRQUFRLElBQUksWUFBWSxRQUFXO0FBQ3JDLFFBQUk7QUFDRixZQUFNLEVBQUUsU0FBUyxvQkFBb0IsSUFBSSxNQUFNLE9BQU8sb0hBQXlDO0FBQy9GLGNBQVEsS0FBSyxvQkFBb0IsQ0FBQztBQUVsQyxVQUFJLFFBQVEsSUFBSSxhQUFhLGNBQWM7QUFDekMsY0FBTSxFQUFFLGFBQWEsSUFBSSxNQUFNLE9BQU8sNkdBQWtDO0FBQ3hFLGdCQUFRLEtBQUssYUFBYSxDQUFDO0FBQUEsTUFDN0I7QUFBQSxJQUNGLFNBQVMsT0FBTztBQUNkLGNBQVEsS0FBSyxpQ0FBaUMsTUFBTSxPQUFPO0FBQUEsSUFDN0Q7QUFBQSxFQUNGO0FBRUEsU0FBTztBQUFBLElBQ0w7QUFBQSxJQUNBLFNBQVM7QUFBQSxNQUNQLE9BQU87QUFBQSxRQUNMLEtBQUssS0FBSyxRQUFRLGtDQUFxQixVQUFVLEtBQUs7QUFBQSxRQUN0RCxXQUFXLEtBQUssUUFBUSxrQ0FBcUIsaUJBQWlCO0FBQUEsTUFDaEU7QUFBQSxJQUNGO0FBQUEsSUFDQSxNQUFNLEtBQUssUUFBUSxrQ0FBcUIsUUFBUTtBQUFBLElBQ2hELFFBQVEsS0FBSyxRQUFRLGdDQUFtQjtBQUFBO0FBQUEsSUFDeEMsT0FBTztBQUFBLE1BQ0wsUUFBUSxLQUFLLFFBQVEsa0NBQXFCLGFBQWE7QUFBQSxNQUN2RCxhQUFhO0FBQUEsSUFDZjtBQUFBLElBQ0EsUUFBUTtBQUFBLE1BQ04sT0FBTztBQUFBLFFBQ0wsUUFBUTtBQUFBLFVBQ04sUUFBUSxJQUFJLHFCQUFxQjtBQUFBLFVBQ2pDLGNBQWM7QUFBQSxVQUNkLFFBQVE7QUFBQSxRQUNWO0FBQUEsUUFDQSxXQUFXO0FBQUEsVUFDVCxRQUFRLElBQUkscUJBQXFCO0FBQUEsVUFDakMsY0FBYztBQUFBLFVBQ2QsUUFBUTtBQUFBLFFBQ1Y7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
