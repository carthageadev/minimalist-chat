import OpenAI from "openai";

const client = new OpenAI({
  baseURL: process.env.BASE_URL!,
  apiKey: process.env.API_KEY!,
});

export const config = {
  runtime: 'edge', // Edge is great for streaming
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { messages, model, thinking, rp, userPersona, charPersona, customSystemPrompt, isPersona } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Messages array is required." }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (typeof model !== 'string' || !model.trim()) {
      return new Response(JSON.stringify({ error: "Model is required." }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
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

    let systemContent = rp ? rpSystemPrompt : baseSystemPrompt;
    if (rp && typeof customSystemPrompt === 'string' && customSystemPrompt.trim()) {
      systemContent = customSystemPrompt;
    } else if (rp) {
      let personaBlock = "";
      if (typeof userPersona === 'string' && userPersona.trim()) {
        personaBlock += `\n\n{{user}} (the user's character):\n${userPersona.trim()}`;
      }
      if (typeof charPersona === 'string' && charPersona.trim()) {
        personaBlock += `\n\n{{char}} (your character — you speak and act ONLY as {{char}}):\n${charPersona.trim()}`;
      }
      systemContent += personaBlock;
    }

    const formattedMessages = isPersona ? messages : [{ role: "system" as const, content: systemContent }, ...messages];

    const requestBody: Record<string, unknown> = {
      model: selectedModel,
      messages: formattedMessages,
      temperature: 0.5,
      max_tokens: 1500,
      stream: true,
    };

    if (typeof thinking === 'boolean') {
      requestBody.chat_template_kwargs = { enable_thinking: thinking };
    }

    if (selectedModel.startsWith('minimaxai/')) {
      requestBody.chat_template_kwargs = { thinking_mode: 'disabled' };
      requestBody.temperature = 1;
      requestBody.top_p = 0.95;
      requestBody.max_tokens = 8192;
    }

    if (rp) {
      requestBody.temperature = 1;
    }

    const createUpstreamStream = async () =>
      client.chat.completions.create(requestBody as any) as Promise<any>;

    // Call the upstream API BEFORE opening our SSE stream, so upstream
    // failures (rate limits, invalid params) reach the client as real
    // HTTP statuses instead of an artificial 200 stream.
    let stream: any;
    try {
      stream = await createUpstreamStream();
    } catch (err: any) {
      // One transparent retry on rate limit
      if (Number(err?.status) === 429) {
        await new Promise((r) => setTimeout(r, 1500));
        try {
          stream = await createUpstreamStream();
        } catch (retryErr: any) {
          console.error("Error calling inference API:", retryErr);
          const rStatus = Number(retryErr?.status);
          return new Response(JSON.stringify({
            error: retryErr?.error?.detail || retryErr?.message || "Failed to get a response from the AI.",
          }), {
            status: rStatus >= 400 && rStatus < 600 ? rStatus : 502,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } else {
        console.error("Error calling inference API:", err);
        const status = Number(err?.status);
        return new Response(JSON.stringify({
          error: err?.error?.detail || err?.message || "Failed to get a response from the AI.",
        }), {
          status: status >= 400 && status < 600 ? status : 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta: any = chunk.choices[0]?.delta;
            const reasoning = delta?.reasoning_content || "";
            if (reasoning) {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ reasoning })}\n\n`));
            }
            const content = delta?.content || "";
            if (content) {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          }
        } catch (streamErr: any) {
          const sStatus = Number(streamErr?.status);
          const msg = sStatus
            ? `${sStatus} — ${streamErr?.error?.detail || streamErr?.message || "stream failed"}`
            : streamErr?.message || "stream failed";
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        }
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        controller.close();
      }
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error("Error calling inference API:", error);
    const status = typeof error?.status === "number" && error.status >= 400 ? error.status : 500;
    const rawMessage =
      (typeof error?.error?.message === "string" && error.error.message) ||
      (typeof error?.message === "string" && error.message) ||
      "";
    const message =
      rawMessage && !/no body/i.test(rawMessage)
        ? rawMessage
        : status === 429
          ? "Rate limit exceeded. Please retry shortly."
          : "Failed to get a response from the AI.";
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
