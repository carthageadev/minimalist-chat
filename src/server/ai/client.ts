import { GoogleGenAI } from "@google/genai";
import { env } from "~/env";

export const ai = new GoogleGenAI({
  apiKey: env.GEMINI_API_KEY,
});

export const model = ai.models.get({ model: "gemini-2.0-flash-exp" });
