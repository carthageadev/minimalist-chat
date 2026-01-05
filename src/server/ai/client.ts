import OpenAI from "openai";

export const ai = new OpenAI({
  baseURL: "https://hermes.ai.unturf.com/v1",
  apiKey: "dummy-api-key",
});

export const MODEL = "adamo1139/Hermes-3-Llama-3.1-8B-FP8-Dynamic";
