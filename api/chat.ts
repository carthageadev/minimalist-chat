import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://hermes.ai.unturf.com/v1",
  apiKey: process.env.UNTURF_API_KEY || "dummy-api-key",
});

const MODEL = "adamo1139/Hermes-3-Llama-3.1-8B-FP8-Dynamic";

export const config = {
  runtime: 'edge', // Edge is great for streaming
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Messages array is required." }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const systemMessage = {
      role: "system",
      content: `Today's date is ${new Date().toISOString().split('T')[0]}. Be bold, forward-thinking, and highly agentic. Aggressively auto-correct and decipher any user typos or misspellings (e.g., understand "doanld rump" as "Donald Trump" without mentioning the typo). Assume the user's underlying intent based on context and immediately provide useful answers. Do NOT ask excessive follow-up questions—take the initiative, make reasonable assumptions, and get things done. You have access to a web search tool. To use it, output EXACTLY the following format: [SEARCH: your search query here] and stop right away. The user will automatically reply with the search results, and then you can formulate your final answer based on the results.`
    };

    const formattedMessages = [systemMessage, ...messages];

    const stream = await client.chat.completions.create({
      model: MODEL,
      messages: formattedMessages,
      temperature: 0.5,
      max_tokens: 1500,
      stream: true,
    });

    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
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
