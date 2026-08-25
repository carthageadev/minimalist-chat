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
    const { messages, model, thinking, rp } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Messages array is required." }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const selectedModel = typeof model === 'string' && model.trim() ? model : MODEL;

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
