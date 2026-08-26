import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));

  // The browser now calls NVIDIA directly. This endpoint only hands the
  // client the (per-model) API key at runtime so it never ships in the
  // built bundle.
  app.get("/api/key", (req, res) => {
    const model = String((req.query as any).model || "");
    const apiKey = model.startsWith("minimaxai/")
      ? process.env.MINIMAX_API_KEY || process.env.API_KEY!
      : process.env.API_KEY!;
    res.json({ apiKey, baseUrl: process.env.BASE_URL! });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
