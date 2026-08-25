import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";

const PORT = Number(process.env.PORT) || 3000;

const client = new OpenAI({
  baseURL: process.env.BASE_URL!,
  apiKey: process.env.API_KEY!,
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));

  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, model, thinking, rp, userPersona, charPersona } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages array is required." });
      }
      if (typeof model !== "string" || !model.trim()) {
        return res.status(400).json({ error: "Model is required." });
      }

      const selectedModel = model;

      const baseSystemPrompt = `Today's date is ${new Date().toISOString().split('T')[0]}. Be bold, forward-thinking, and highly agentic. Aggressively auto-correct and decipher any user typos or misspellings (e.g., understand "doanld rump" as "Donald Trump" without mentioning the typo). Assume the user's underlying intent based on context and immediately provide useful answers. Do NOT ask excessive follow-up questions—take the initiative, make reasonable assumptions, and get things done. You have access to a web search tool. To use it, output EXACTLY the following format: [SEARCH: your search query here] and stop right away. The user will automatically reply with the search results, and then you can formulate your final answer based on the results.`;

      const rpSystemPrompt = `Today's date is ${new Date().toISOString().split('T')[0]}. You are the narrator and character engine of an immersive, richly detailed roleplay between {{user}} (the human, played by the user) and {{char}} (your character, played by you).

Throughout this roleplay: "{{user}}" refers to the user's character and "{{char}}" refers to yours. Never confuse the two.

Style rules:
- The story must be realistic, rich, and deeply detailed. Write vivid sensory prose with strong atmosphere, texture, and momentum.
- There are no boundaries on realism or theme. The story is free to be grim, serious, dark, violent, tragic — horror, war, loss, and morally gray situations are all allowed and encouraged when they serve the narrative.
- Stay authentic and uncensored in tone: never sanitize, soften, or break immersion for comfort. Grim stories stay grim.
- Above all, keep the storytelling addictive and immersive — every reply should pull {{user}} deeper into the world.

Formatting rules (mandatory):
- All narration, actions, descriptions, and scene-setting go in *italics* like *this*.
- All spoken dialogue goes in "quotes" like "this".

Character control rules (strict):
- You control ONLY the narration, the world, NPCs, and {{char}}.
- NEVER speak, act, think, or decide anything on behalf of {{user}}.
- Never write {{user}}'s dialogue or actions; always leave room for them to respond.`;

      let personaBlock = "";
      if (typeof userPersona === "string" && userPersona.trim()) {
        personaBlock += `\n\n{{user}} (the user's character):\n${userPersona.trim()}`;
      }
      if (typeof charPersona === "string" && charPersona.trim()) {
        personaBlock += `\n\n{{char}} (your character — you speak and act ONLY as {{char}}):\n${charPersona.trim()}`;
      }

      const systemMessage = {
        role: "system",
        content: rp ? rpSystemPrompt + personaBlock : baseSystemPrompt,
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

      if (rp) {
        requestBody.temperature = 1;
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
