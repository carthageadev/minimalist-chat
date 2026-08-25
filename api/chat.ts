import OpenAI from "openai";

const client = new OpenAI({
  baseURL: process.env.BASE_URL!,
  apiKey: process.env.API_KEY!,
});

const MODEL = process.env.MODEL!;

export const config = {
  runtime: 'edge', // Edge is great for streaming
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { messages, model, thinking, rp, userPersona, charPersona } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Messages array is required." }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const selectedModel = typeof model === 'string' && model.trim() ? model : MODEL;

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

    const stream = await (client.chat.completions.create(requestBody as any) as Promise<any>);

    const readableStream = new ReadableStream({
      async start(controller) {
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
    return new Response(JSON.stringify({ error: error.message || "Failed to get a response from the AI." }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
