/// <reference types="vitest/config" />
import type { IncomingMessage } from "node:http";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { searchUnsplashPhotos } from "./src/server/unsplashSearch";
import { UNSPLASH_MISSING_KEY_MESSAGE } from "./src/features/editor/unsplashErrors";

function harvyApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: "harvy-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (req.method !== "GET" || url !== "/api/unsplash/search") {
          next();
          return;
        }

        try {
          const unsplashKey = env.UNSPLASH_ACCESS_KEY?.trim() ?? "";
          if (!unsplashKey) {
            console.warn("[harvy] UNSPLASH_ACCESS_KEY is missing in Vite dev env");
            res.statusCode = 500;
            res.end(UNSPLASH_MISSING_KEY_MESSAGE);
            return;
          }
          process.env.UNSPLASH_ACCESS_KEY = unsplashKey;

          const parsed = new URL(req.url ?? "", "http://localhost");
          const query = parsed.searchParams.get("q")?.trim() ?? "";
          if (!query) {
            res.statusCode = 400;
            res.end("Missing search query");
            return;
          }
          const results = await searchUnsplashPhotos(query);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ results }));
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Request failed";
          res.statusCode = 500;
          res.end(msg);
        }
      });
    },
  };
}

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), harvyApiPlugin(env)],
    clearScreen: false,
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host
        ? {
            protocol: "ws",
            host,
            port: 1421,
          }
        : undefined,
      watch: {
        ignored: ["**/src-tauri/**"],
      },
    },
    test: {
      environment: "jsdom",
      globals: false,
      setupFiles: ["./src/test/setup.ts"],
    },
  };
});
