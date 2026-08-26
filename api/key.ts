export const config = {
  runtime: "edge",
};

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const model = url.searchParams.get("model") || "";
  const apiKey = model.startsWith("minimaxai/")
    ? process.env.MINIMAX_API_KEY || process.env.API_KEY!
    : process.env.API_KEY!;
  return new Response(
    JSON.stringify({ apiKey, baseUrl: process.env.BASE_URL! }),
    { headers: { "Content-Type": "application/json" } }
  );
}
