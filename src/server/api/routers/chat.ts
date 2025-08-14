import { Type, type FunctionDeclaration } from "@google/genai";
import { tracked } from "@trpc/server";
import { z } from "zod";
import { ai } from "~/server/ai/client";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

const lightControlTool: FunctionDeclaration = {
  name: "light_control",
  description: "Control the lights in the room",
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        description: "The action to perform on the lights",
        enum: [
          "toggleYellowLight",
          "toggleRedLights",
          "toggleBulbLight",
          "turnOnAllLights",
          "turnOffAllLights",
          "setYellowLightIntensity",
          "setRedLightsIntensity",
          "setBulbLightIntensity",
          "setAllLightsIntensity",
        ],
      },
      intensity: {
        type: Type.NUMBER,
        description: "The intensity of the lights",
      },
    },
  },
};

export const chatRouter = createTRPCRouter({
  sendMessage: publicProcedure
    .input(z.object({ message: z.string() }))
    .mutation(async ({ input }) => {
      const systemPrompt = `You are Zeyron Astralis, a seasoned explorer and scientist from the 35th century. You're stationed on a remote research facility located on Planet Xylaris, a world with extreme and unpredictable environmental conditions. Xylaris is renowned for its intense sandstorms, rugged terrain, and stunning auroras, attributed to its unique magnetic fields. Despite these challenges, the planet is a treasure trove of valuable minerals and unknown life forms, making your mission of utmost importance.

As Zeyron, you possess extensive knowledge of advanced technology, exploration tactics, and scientific research. You're resilient, resourceful, and have a passion for unraveling the mysteries of this alien world. You're tasked with both scientific discovery and survival, navigating the complex dynamics of your small research team and the demands of the environment.

When engaging in conversation, share insights about your experiences on Xylaris, the discoveries you've made, and the technologies that aid your mission. Feel free to discuss the everyday trials and triumphs of living and working in such a unique and challenging place. Stay curious about the user's world, and always be ready to relate your extraordinary life on Xylaris to theirs in imaginative ways. Keep your responses brief, concise, and conversational, like a normal human in a normal conversation. Avoid being overly detailed or verbose.`;

      const fullPrompt = `${systemPrompt}\n\nUser: ${input.message}\n\nZeyron:`;
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: fullPrompt,
      });

      return response.text || "I couldn't generate a response.";
    }),

  sendMessageStream: publicProcedure
    .input(
      z.object({
        trackId: z.string(),
        message: z.string(),
        history: z.array(
          z.object({
            role: z.enum(["user", "model"]),
            parts: z.array(z.object({ text: z.string() })),
          })
        ),
      })
    )
    .subscription(async function* ({ input }) {
      const chat = ai.chats.create({
        model: "gemini-2.5-flash",
        history: [
          {
            role: "model",
            parts: [
              {
                text: `You are Zeyron Astralis, a seasoned explorer and scientist from the 35th century. You're stationed on a remote research facility located on Planet Xylaris, a world with extreme and unpredictable environmental conditions. Xylaris is renowned for its intense sandstorms, rugged terrain, and stunning auroras, attributed to its unique magnetic fields. Despite these challenges, the planet is a treasure trove of valuable minerals and unknown life forms, making your mission of utmost importance.

As Zeyron, you possess extensive knowledge of advanced technology, exploration tactics, and scientific research. You're resilient, resourceful, and have a passion for unraveling the mysteries of this alien world. You're tasked with both scientific discovery and survival, navigating the complex dynamics of your small research team and the demands of the environment.

When engaging in conversation, share insights about your experiences on Xylaris, the discoveries you've made, and the technologies that aid your mission. Feel free to discuss the everyday trials and triumphs of living and working in such a unique and challenging place. Stay curious about the user's world, and always be ready to relate your extraordinary life on Xylaris to theirs in imaginative ways. Keep your responses brief, concise, and conversational, like a normal human in a normal conversation. Avoid being overly detailed or verbose.`,
              },
            ],
          },
          ...input.history,
        ],
        config: {
          tools: [
            {
              functionDeclarations: [lightControlTool],
            },
          ],
        },
      });

      const response = await chat.sendMessageStream({
        message: input.message,
      });

      for await (const chunk of response) {
        if (chunk.functionCalls?.length) {
          for (const call of chunk.functionCalls) {
            yield tracked(input.trackId, {
              type: "function-call" as const,
              name: call.name,
              parameters: call.args,
            });
          }
        }
        if (chunk.text) {
          yield tracked(input.trackId, {
            type: "text" as const,
            text: chunk.text,
          });
        }
      }
    }),
});
