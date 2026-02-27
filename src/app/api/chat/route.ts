export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GoogleGenerativeAI, type Content, type Part } from "@google/generative-ai";
import { chatTools, executeTool } from "@/lib/chat/tools";
import { getSystemPrompt } from "@/lib/chat/system-prompt";

const MAX_TOOL_ROUNDS = 5;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다" } }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: { code: "CONFIG_ERROR", message: "AI API 키가 설정되지 않았습니다" } }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json();
  const userMessage = body.message?.trim();
  if (!userMessage) {
    return new Response(JSON.stringify({ error: { code: "VALIDATION_ERROR", message: "메시지를 입력해주세요" } }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = session.user.id;
  const role = (session.user as Record<string, unknown>).role as string;
  const userName = session.user.name || "사용자";

  // Save user message to DB
  await prisma.chatMessage.create({
    data: { userId, role: "USER", content: userMessage },
  });

  // Load recent conversation history
  const recentMessages = await prisma.chatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: { role: true, content: true },
  });

  // Build Gemini conversation history
  const history: Content[] = [];
  for (const msg of recentMessages.slice(0, -1)) {
    // Skip last one (it's the user message we just saved)
    history.push({
      role: msg.role === "USER" ? "user" : "model",
      parts: [{ text: msg.content }],
    });
  }

  // Determine tools available to role
  const availableTools = role === "SELLER"
    ? chatTools.filter((t) => t.name !== "search_sellers")
    : chatTools;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: getSystemPrompt(role as "ADMIN" | "SUPER_ADMIN" | "SELLER", userName),
    tools: [{ functionDeclarations: availableTools }],
  });

  // SSE streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Non-streaming tool calling loop
        let currentHistory: Content[] = [
          ...history,
          { role: "user", parts: [{ text: userMessage }] },
        ];

        let finalText = "";

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const result = await model.generateContent({
            contents: currentHistory,
          });

          const response = result.response;
          const candidate = response.candidates?.[0];
          if (!candidate) break;

          const parts = candidate.content.parts;
          const functionCalls = parts.filter((p: Part) => p.functionCall);

          if (functionCalls.length === 0) {
            // No tool calls — this is the final text response
            finalText = parts.map((p: Part) => p.text || "").join("");
            break;
          }

          // Execute tool calls
          const toolResults: Part[] = [];
          for (const part of functionCalls) {
            const fc = part.functionCall!;
            send("tool_use", { name: fc.name, args: fc.args });

            const toolResult = await executeTool(fc.name, fc.args as Record<string, unknown>, userId, role);
            toolResults.push({
              functionResponse: {
                name: fc.name,
                response: { result: toolResult },
              },
            });
          }

          // Add assistant message and tool results to history
          currentHistory = [
            ...currentHistory,
            { role: "model", parts },
            { role: "user", parts: toolResults },
          ];
        }

        // Stream the final text response if we got one from the non-streaming call
        if (finalText) {
          // Send in chunks to simulate streaming
          const chunks = splitIntoChunks(finalText, 20);
          for (const chunk of chunks) {
            send("token", chunk);
            // Small delay for streaming feel
            await new Promise((r) => setTimeout(r, 30));
          }
        } else {
          // Fallback: stream the final response
          const streamResult = await model.generateContentStream({
            contents: currentHistory,
          });

          const textParts: string[] = [];
          for await (const chunk of streamResult.stream) {
            const text = chunk.text();
            if (text) {
              send("token", text);
              textParts.push(text);
            }
          }
          finalText = textParts.join("");
        }

        // Save assistant response to DB
        const saved = await prisma.chatMessage.create({
          data: { userId, role: "ASSISTANT", content: finalText },
        });

        send("done", { messageId: saved.id });
      } catch (err) {
        const message = err instanceof Error ? err.message : "AI 응답 생성 중 오류가 발생했습니다";
        send("error", { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function splitIntoChunks(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + maxLen));
    i += maxLen;
  }
  return chunks;
}
