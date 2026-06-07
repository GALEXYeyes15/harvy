import type { IncomingMessage } from "node:http";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { runProofread } from "./src/server/openaiProofread";

function readJsonBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function proofreadApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: "harvy-proofread-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (url !== "/api/proofread" || req.method !== "POST") {
          next();
          return;
        }
        try {
          const raw = await readJsonBody(req);
          const body = raw ? (JSON.parse(raw) as { text?: string }) : {};
          const text = typeof body.text === "string" ? body.text : "";
          if (!text.trim()) {
            res.statusCode = 400;
            res.end("No text provided");
            return;
          }
          const apiKey = env.OPENAI_API_KEY ?? "";
          if (!apiKey) {
            res.statusCode = 500;
            res.end("OPENAI_API_KEY not configured");
            return;
          }
          process.env.OPENAI_API_KEY = apiKey;
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
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Proofread failed";
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
    plugins: [react(), proofreadApiPlugin(env)],
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
