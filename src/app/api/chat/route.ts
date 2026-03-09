export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { GoogleGenerativeAI, type Content, type Part } from "@google/generative-ai";
import { chatTools, executeTool } from "@/lib/chat/tools";
import { getSystemPrompt } from "@/lib/chat/system-prompt";
import { getTenantContext, checkUsageLimit, incrementUsage } from "@/lib/tenant";

const MAX_TOOL_ROUNDS = 5;

export async function POST(request: NextRequest) {
  const { error, ctx } = await getTenantContext();
  if (error) return error;

  // AI 채팅 사용량 체크 (SUPER_ADMIN은 제한 없음)
  if (!ctx.isSuperAdmin && ctx.tenantId) {
    const usageCheck = await checkUsageLimit(ctx.tenantId, "aiChats");
    if (!usageCheck.allowed) {
      return new Response(JSON.stringify({ error: { code: "USAGE_LIMIT", message: usageCheck.message } }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    }
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
  const fileContext = body.fileContext as { type: string; fileName: string; fileContext?: string; base64?: string; mimeType?: string } | undefined;

  if (!userMessage) {
    return new Response(JSON.stringify({ error: { code: "VALIDATION_ERROR", message: "메시지를 입력해주세요" } }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = ctx.userId;
  const role = ctx.role;
  const tenantId = ctx.tenantId || undefined;

  // userName은 DB에서 조회
  const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  const userName = currentUser?.name || "사용자";

  // Save user message to DB (include file name if attached)
  const dbContent = fileContext
    ? `${userMessage}\n\n[첨부파일: ${fileContext.fileName}]`
    : userMessage;
  await prisma.chatMessage.create({
    data: { userId, role: "USER", content: dbContent, tenantId },
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
  const adminOnlyTools = [
    "search_sellers", "update_order_status",
    "create_product", "update_product", "bulk_update_price",
    "input_tracking_number", "process_claim", "send_notice",
    "answer_inquiry", "manage_seller",
    "upload_tracking_excel", "get_margin_stats", "detect_anomalies",
  ];
  const sellerOnlyTools = ["create_order", "create_claim", "create_inquiry"];
  const availableTools = role === "SELLER"
    ? chatTools.filter((t: { name: string }) => !adminOnlyTools.includes(t.name))
    : chatTools.filter((t: { name: string }) => !sellerOnlyTools.includes(t.name));

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
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
        // Build user message parts (text + optional file)
        const userParts: Part[] = [];
        if (fileContext?.type === "image" && fileContext.base64 && fileContext.mimeType) {
          userParts.push({
            inlineData: { data: fileContext.base64, mimeType: fileContext.mimeType },
          });
          userParts.push({ text: `[첨부 이미지: ${fileContext.fileName}]\n${userMessage}` });
        } else if (fileContext?.type === "spreadsheet" && fileContext.fileContext) {
          userParts.push({
            text: `[첨부 파일: ${fileContext.fileName}]\n아래는 첨부된 엑셀/CSV 파일의 내용입니다:\n\n${fileContext.fileContext}\n\n사용자 질문: ${userMessage}`,
          });
        } else {
          userParts.push({ text: userMessage });
        }

        let currentHistory: Content[] = [
          ...history,
          { role: "user", parts: userParts },
        ];

        let finalText = "";

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const result = await model.generateContent({
            contents: currentHistory,
          });

          const response = result.response;
          const candidate = response.candidates?.[0];
          if (!candidate) break;

          const parts = candidate.content?.parts || [];
          if (parts.length === 0) break;
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
            const fcArgs = (fc.args || {}) as Record<string, unknown>;
            send("tool_use", { name: fc.name, args: fcArgs });

            const toolResult = await executeTool(fc.name, fcArgs, userId, role, tenantId);

            // Check for chart data
            if (toolResult && typeof toolResult === "object" && (toolResult as Record<string, unknown>).__chart) {
              const { __chart, summary, ...chartData } = toolResult as Record<string, unknown>;
              void __chart;
              send("chart", chartData);
              toolResults.push({
                functionResponse: {
                  name: fc.name,
                  response: { result: summary },
                },
              });
            } else {
              toolResults.push({
                functionResponse: {
                  name: fc.name,
                  response: { result: toolResult },
                },
              });
            }
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
          data: { userId, role: "ASSISTANT", content: finalText, tenantId },
        });

        // 사용량 증가 (정상 응답 완료 후)
        if (!ctx.isSuperAdmin && ctx.tenantId) {
          await incrementUsage(ctx.tenantId, "aiChats");
        }

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
