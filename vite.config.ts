import type { IncomingMessage } from "node:http";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { runTwitterFormatGeneration } from "./src/server/openaiFormatGeneration";
import { runProofread } from "./src/server/openaiProofread";

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
        if (req.method !== "POST") {
          next();
          return;
        }

        const apiKey = env.OPENAI_API_KEY ?? "";
        const ensureApiKey = () => {
          if (!apiKey) {
            res.statusCode = 500;
            res.end("OPENAI_API_KEY not configured");
            return false;
          }
          process.env.OPENAI_API_KEY = apiKey;
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

          // TODO(format): dev/web fallback only — Tauri uses native `generate_twitter_formats`.
          if (url === "/api/format/generate") {
            const raw = await readJsonBody(req);
            const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
            const platform = body.platform;
            if (platform !== "twitter") {
              // TODO(format): route to other platform generators.
              res.statusCode = 400;
              res.end("Only twitter format generation is supported");
              return;
            }
            const essayText = typeof body.essayText === "string" ? body.essayText : "";
            const targetCount =
              typeof body.targetCount === "number" && Number.isFinite(body.targetCount)
                ? body.targetCount
                : 0;
            if (!essayText.trim()) {
              res.statusCode = 400;
              res.end("No essay text provided");
              return;
            }
            if (targetCount <= 0) {
              res.statusCode = 400;
              res.end("Invalid target count");
              return;
            }
            if (!ensureApiKey()) return;
            const inspirationExamples = Array.isArray(body.inspirationExamples)
              ? body.inspirationExamples
              : [];
            const result = await runTwitterFormatGeneration(
              essayText,
              targetCount,
              inspirationExamples,
            );
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
