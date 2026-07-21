/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { searchUnsplashPhotos, listPopularUnsplashPhotos } from "./src/server/unsplashSearch";
import { UNSPLASH_MISSING_KEY_MESSAGE } from "./src/features/editor/unsplashErrors";
import { fetchSubstackComments, fetchSubstackPosts } from "./src/server/substackArchive";

function harvyApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: "harvy-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (req.method !== "GET" || !url.startsWith("/api/")) {
          next();
          return;
        }

        try {
          if (url.startsWith("/api/unsplash/")) {
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
          }

          if (url === "/api/substack/posts") {
            const parsed = new URL(req.url ?? "", "http://localhost");
            const accountUrl = parsed.searchParams.get("url")?.trim() ?? "";
            if (!accountUrl) {
              res.statusCode = 400;
              res.end("Missing Substack account URL");
              return;
            }
            const results = await fetchSubstackPosts(accountUrl);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ results }));
            return;
          }

          if (url === "/api/substack/comments") {
            const parsed = new URL(req.url ?? "", "http://localhost");
            const kind = parsed.searchParams.get("kind")?.trim() ?? "";
            const sourceIdRaw = parsed.searchParams.get("sourceId")?.trim() ?? "";
            const subdomain = parsed.searchParams.get("subdomain")?.trim() ?? "";
            const sourceId = Number(sourceIdRaw);
            if (!kind || !Number.isFinite(sourceId)) {
              res.statusCode = 400;
              res.end("Missing kind or sourceId");
              return;
            }
            const results = await fetchSubstackComments({ kind, sourceId, subdomain });
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
