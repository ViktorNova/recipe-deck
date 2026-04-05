import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { loadConfig } from "./config.js";
import type { SlotId } from "../types/index.js";
import { DeckService } from "./deckService.js";
import { registerRoutes } from "./routes/registerRoutes.js";
import { WsHub } from "./wsHub.js";
import { formatListenDisplay } from "../shared/formatListenDisplay.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
/** `server/*.ts` → repo root; `dist/server/*.js` → up two levels to repo root. */
const repoRoot =
  path.basename(path.dirname(moduleDir)) === "dist"
    ? path.join(moduleDir, "..", "..")
    : path.join(moduleDir, "..");

async function createViteDevMiddleware() {
  const vite = await import("vite");
  const clientRoot = path.join(repoRoot, "client");
  const server = await vite.createServer({
    configFile: path.join(clientRoot, "vite.config.ts"),
    server: { middlewareMode: true },
    appType: "custom",
    root: clientRoot,
  });
  return server;
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  const hubRef: { current: WsHub | null } = { current: null };

  const deck = new DeckService(
    cfg,
    (slot: SlotId, line: string) => {
      hubRef.current?.broadcastLog(slot, line);
    },
    () => {
      hubRef.current?.broadcastState();
    },
  );
  await deck.init();

  const app = express();
  app.use(express.json({ limit: "12mb" }));
  registerRoutes(app, deck);

  const isDev = process.env.NODE_ENV === "development";

  const faviconSvgPath = isDev
    ? path.join(repoRoot, "client", "public", "favicon.svg")
    : path.join(repoRoot, "client", "dist", "favicon.svg");

  /** Browsers request /favicon.ico; without this, the SPA catch-all returns index.html and the tab icon breaks. */
  app.get("/favicon.ico", (_req, res) => {
    res.type("image/svg+xml");
    res.sendFile(faviconSvgPath, (err) => {
      if (err) {
        res.status(404).end();
      }
    });
  });

  if (isDev) {
    const vite = await createViteDevMiddleware();
    app.use(vite.middlewares);
    app.use(async (req, res, next) => {
      if (req.method !== "GET") {
        next();
        return;
      }
      if (req.path.startsWith("/api")) {
        next();
        return;
      }
      if (req.path.includes(".") && !req.path.endsWith(".html")) {
        next();
        return;
      }
      try {
        const indexHtml = path.join(repoRoot, "client", "index.html");
        let template = await fs.readFile(indexHtml, "utf-8");
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        next(e);
      }
    });
  } else {
    const dist = path.join(repoRoot, "client", "dist");
    const indexHtml = path.join(dist, "index.html");
    app.use(express.static(dist));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        next();
        return;
      }
      res.sendFile(indexHtml, (err) => {
        if (err) next(err);
      });
    });
  }

  const server = http.createServer(app);
  hubRef.current = new WsHub(server, deck);
  server.listen(cfg.switcherPort, cfg.switcherHost, () => {
    console.error(
      `[recipe-deck] listening on http://${formatListenDisplay(cfg.switcherHost, cfg.switcherPort)}`,
    );
  });

  const shutdown = () => {
    deck.shutdown();
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
