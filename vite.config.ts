/// <reference types="vitest/config" />
import type { IncomingMessage } from "node:http";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { searchUnsplashPhotos, listPopularUnsplashPhotos } from "./src/server/unsplashSearch";
import { UNSPLASH_MISSING_KEY_MESSAGE } from "./src/features/editor/unsplashErrors";

function harvyApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: "harvy-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (req.method !== "GET" || !url.startsWith("/api/unsplash/")) {
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
          const page = Number(parsed.searchParams.get("page") ?? "1");
          const perPage = Number(parsed.searchParams.get("per_page") ?? "12");
          const pageOpt = Number.isFinite(page) ? page : 1;
          const perPageOpt = Number.isFinite(perPage) ? perPage : 12;

          if (url === "/api/unsplash/popular") {
            const results = await listPopularUnsplashPhotos({
              page: pageOpt,
              perPage: perPageOpt,
            });
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ results }));
            return;
          }

          if (url === "/api/unsplash/search") {
            const query = parsed.searchParams.get("q")?.trim() ?? "";
            if (!query) {
              res.statusCode = 400;
              res.end("Missing search query");
              return;
            }
            const results = await searchUnsplashPhotos(query, {
              page: pageOpt,
              perPage: perPageOpt,
            });
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ results }));
            return;
          }

          next();
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
