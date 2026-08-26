import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

const PORT = Number(process.env.PORT) || 3000;

// Dev-only mirror of api/chat.ts: proxy /api/chat to the upstream so the
// browser never hits NVIDIA directly (no CORS). In production Vercel serves
// the real function from api/chat.ts.
function proxyChat(app: express.Express) {
  app.use("/api/chat", express.json({ limit: "5mb" }), async (req, res) => {
    const { upstream, payload } = req.body as { upstream?: string; payload?: Record<string, unknown> };
    if (typeof upstream !== "string" || !payload) {
      res.status(400).end("missing upstream/payload");
      return;
    }
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (upstream.includes("api.nvidia.com")) {
      const key = process.env.NVIDIA_API_KEY || process.env.VITE_API_KEY || "";
      if (key) headers["Authorization"] = `Bearer ${key}`;
    }
    const upstreamRes = await fetch(upstream, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    res.status(upstreamRes.status);
    const ct = upstreamRes.headers.get("content-type");
    if (ct) res.setHeader("content-type", ct);
    res.setHeader("cache-control", "no-store");
    if (upstreamRes.body) {
      const reader = upstreamRes.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    }
    res.end();
  });
}

async function startServer() {
  const app = express();

  proxyChat(app);

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
