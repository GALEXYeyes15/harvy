import type { IncomingMessage } from "node:http";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { generateFormatOutputs } from "./src/server/formatGeneration/orchestrator";
import { runProofread } from "./src/server/openaiProofread";
import { ANTHROPIC_API_KEY_ENV } from "./src/config/aiConfig";
import { searchUnsplashPhotos } from "./src/server/unsplashSearch";
import { UNSPLASH_MISSING_KEY_MESSAGE } from "./src/features/editor/unsplashErrors";

function readJsonBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function harvyApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: "harvy-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (req.method === "GET" && url === "/api/unsplash/search") {
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
          return;
        }

        if (req.method !== "POST") {
          next();
          return;
        }

        const apiKey = env[ANTHROPIC_API_KEY_ENV] ?? "";
        const ensureApiKey = () => {
          if (!apiKey) {
            res.statusCode = 500;
            res.end(`${ANTHROPIC_API_KEY_ENV} not configured`);
            return false;
          }
          process.env[ANTHROPIC_API_KEY_ENV] = apiKey;
          return true;
        };

        try {
          if (url === "/api/proofread") {
            const raw = await readJsonBody(req);
            const body = raw ? (JSON.parse(raw) as { text?: string }) : {};
            const text = typeof body.text === "string" ? body.text : "";
            if (!text.trim()) {
              res.statusCode = 400;
              res.end("No text provided");
              return;
            }
            if (!ensureApiKey()) return;
            const proofreadBody = await runProofread(text);
            let issues: unknown[] = [];
            try {
              const parsed = JSON.parse(proofreadBody) as { issues?: unknown };
              issues = Array.isArray(parsed.issues) ? parsed.issues : [];
            } catch {
              issues = [];
            }
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ issues }));
            return;
          }

          // Dev/web fallback only — Tauri uses native `generate_format_outputs`.
          if (url === "/api/format/generate") {
            const raw = await readJsonBody(req);
            const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
            const essayText = typeof body.essayText === "string" ? body.essayText : "";
            const wordCount =
              typeof body.wordCount === "number" && Number.isFinite(body.wordCount)
                ? body.wordCount
                : 0;
            if (!essayText.trim()) {
              res.statusCode = 400;
              res.end("No essay text provided");
              return;
            }
            if (!body.selectedFormats || !body.categoryAmounts) {
              res.statusCode = 400;
              res.end("Missing format selection or amounts");
              return;
            }
            if (!ensureApiKey()) return;
            const result = await generateFormatOutputs({
              essayText,
              wordCount,
              selectedFormats: body.selectedFormats as never,
              categoryAmounts: body.categoryAmounts as never,
              inspirationExamplesByCategory: body.inspirationExamplesByCategory as never,
            });
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result));
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
  };
});
