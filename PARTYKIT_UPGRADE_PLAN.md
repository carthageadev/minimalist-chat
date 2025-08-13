# PartyKit Upgrade Plan

This document outlines the steps to upgrade the chat functionality from the temporary, non-streaming implementation to a full, real-time implementation using [PartyKit](https://partykit.io/).

## The Problem

The current implementation uses a standard tRPC mutation (`sendMessage`) to send a message to the AI and receive the full response at once. This was a temporary measure to allow for deployment on Vercel, which does not support the original WebSocket-based implementation (`sendMessageStream`).

The original implementation provided a much better user experience by streaming the AI's response back to the user in real-time.

## The Solution

PartyKit is a platform for building real-time, collaborative applications that integrates perfectly with serverless environments like Vercel. We will use PartyKit to re-implement the real-time streaming functionality.

## The Plan

1.  **Install PartyKit:**
    ```bash
    npm install partykit
    ```

2.  **Create a PartyKit Server:**
    *   Create a new file at `party/server.ts`.
    *   This file will contain the logic for the PartyKit server. It will be responsible for:
        *   Receiving chat messages from the Next.js application.
        *   Broadcasting the messages to all connected clients in the same "room."

3.  **Deploy the PartyKit Server:**
    *   Deploy the server to PartyKit's cloud:
        ```bash
        npx partykit deploy
        ```

4.  **Update the Next.js Application:**
    *   **Re-enable the `sendMessageStream` subscription:** Uncomment the `sendMessageStream` code in `src/server/api/routers/chat.ts`.
    *   **Modify the subscription logic:** Instead of yielding the response directly, the subscription will make an HTTP request to the deployed PartyKit server, passing along each chunk of the AI's response.
    *   **Update the frontend:** In `src/components/retro-chat/retro-chat.tsx`, switch back to using the `useSubscription` hook, but point it to the PartyKit WebSocket URL instead of the local WebSocket server.

5.  **Clean Up:**
    *   The `src/server/ws-server.ts` file can be safely deleted.
    *   The `ws` dependency can be removed from `package.json`.