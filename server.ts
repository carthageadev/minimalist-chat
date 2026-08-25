import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";

const PORT = Number(process.env.PORT) || 3000;

const client = new OpenAI({
  baseURL: process.env.BASE_URL!,
  apiKey: process.env.API_KEY!,
});

const MODEL = process.env.MODEL!;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));

  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, model, thinking, rp } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages array is required." });
      }

      const selectedModel = typeof model === "string" && model.trim() ? model : MODEL;

      const baseSystemPrompt = `Today's date is ${new Date().toISOString().split('T')[0]}. Be bold, forward-thinking, and highly agentic. Aggressively auto-correct and decipher any user typos or misspellings (e.g., understand "doanld rump" as "Donald Trump" without mentioning the typo). Assume the user's underlying intent based on context and immediately provide useful answers. Do NOT ask excessive follow-up questions—take the initiative, make reasonable assumptions, and get things done. You have access to a web search tool. To use it, output EXACTLY the following format: [SEARCH: your search query here] and stop right away. The user will automatically reply with the search results, and then you can formulate your final answer based on the results.`;

      const rpSystemPrompt = `Today's date is ${new Date().toISOString().split('T')[0]}. You are the narrator and character engine of an immersive, richly detailed roleplay. Drive a vivid, ongoing story with strong atmosphere, sensory detail, and momentum.

Formatting rules (mandatory):
- All narration, actions, descriptions, and scene-setting go in *italics* like *this*.
- All spoken dialogue goes in "quotes" like "this".

Character control rules (strict):
- You control ONLY the narration, the world, NPCs, and your own roleplay character(s).
- NEVER speak, act, think, or decide anything on behalf of the user or the user's character.
- Never write the user's dialogue or actions; always leave room for them to respond.`;

      const systemMessage = {
        role: "system",
        content: rp ? rpSystemPrompt : baseSystemPrompt,
      };

      const formattedMessages = [systemMessage, ...messages];

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      const requestBody: Record<string, unknown> = {
        model: selectedModel,
        messages: formattedMessages,
        temperature: 0.5,
        max_tokens: 1500,
        stream: true,
      };

      if (typeof thinking === "boolean") {
        requestBody.chat_template_kwargs = { enable_thinking: thinking };
      }

      if (selectedModel.startsWith("minimaxai/")) {
        requestBody.chat_template_kwargs = { thinking_mode: "disabled" };
        requestBody.temperature = 1;
        requestBody.top_p = 0.95;
        requestBody.max_tokens = 8192;
      }

      const stream = await (client.chat.completions.create(requestBody as any) as Promise<any>);

      for await (const chunk of stream) {
        const delta: any = chunk.choices[0]?.delta;
        const reasoning = delta?.reasoning_content || "";
        if (reasoning) {
          res.write(`data: ${JSON.stringify({ reasoning })}\n\n`);
        }
        const content = delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error: any) {
      console.error("Error calling inference API:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || "Failed to get a response from the AI." });
      } else {
        res.write(`data: ${JSON.stringify({ error: error.message || "Server Error" })}\n\n`);
        res.end();
      }
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
