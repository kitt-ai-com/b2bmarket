"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, X, Send, Trash2, Loader2 } from "lucide-react";

interface ChatMessage {
  id?: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt?: string;
}

export function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load chat history when panel opens
  useEffect(() => {
    if (isOpen && !historyLoaded) {
      loadHistory();
    }
  }, [isOpen, historyLoaded]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && !isLoading) {
      inputRef.current?.focus();
    }
  }, [isOpen, isLoading]);

  const loadHistory = async () => {
    try {
      const res = await fetch("/api/chat/history?limit=50");
      if (!res.ok) return;
      const json = await res.json();
      if (json.data?.length) {
        setMessages(json.data);
      }
      setHistoryLoaded(true);
    } catch {
      setHistoryLoaded(true);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput("");
    setIsLoading(true);
    setToolStatus(null);

    // Add user message optimistically
    const userMsg: ChatMessage = { role: "USER", content: text };
    setMessages((prev) => [...prev, userMsg]);

    // Add placeholder for assistant response
    const assistantMsg: ChatMessage = { role: "ASSISTANT", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        const err = await res.json();
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "ASSISTANT",
            content: err.error?.message || "오류가 발생했습니다.",
          };
          return updated;
        });
        setIsLoading(false);
        return;
      }

      // Read SSE stream
      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7);
          } else if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            handleSSEEvent(eventType, data);
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "ASSISTANT",
          content: "네트워크 오류가 발생했습니다. 다시 시도해주세요.",
        };
        return updated;
      });
    } finally {
      setIsLoading(false);
      setToolStatus(null);
    }
  };

  const handleSSEEvent = (event: string, data: unknown) => {
    switch (event) {
      case "token":
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "ASSISTANT") {
            updated[updated.length - 1] = { ...last, content: last.content + (data as string) };
          }
          return updated;
        });
        break;

      case "tool_use": {
        const tool = data as { name: string };
        const toolNames: Record<string, string> = {
          search_orders: "주문 검색 중",
          search_products: "상품 검색 중",
          get_dashboard_stats: "통계 조회 중",
          search_sellers: "셀러 조회 중",
          get_order_detail: "주문 상세 조회 중",
          get_recent_claims: "클레임 조회 중",
        };
        setToolStatus(toolNames[tool.name] || "데이터 조회 중");
        break;
      }

      case "done": {
        const d = data as { messageId: string };
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "ASSISTANT") {
            updated[updated.length - 1] = { ...last, id: d.messageId };
          }
          return updated;
        });
        setToolStatus(null);
        break;
      }

      case "error": {
        const err = data as { message: string };
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "ASSISTANT",
            content: err.message || "오류가 발생했습니다.",
          };
          return updated;
        });
        break;
      }
    }
  };

  const handleClear = async () => {
    if (!confirm("대화 기록을 모두 삭제하시겠습니까?")) return;
    try {
      await fetch("/api/chat/history", { method: "DELETE" });
      setMessages([]);
    } catch {
      // ignore
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-transform hover:scale-105"
      >
        <MessageSquare className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 top-0 z-50 flex w-96 flex-col border-l bg-white shadow-xl">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-blue-600" />
          <span className="font-semibold">AI 어시스턴트</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title="대화 초기화"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-md p-1.5 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
            <MessageSquare className="h-12 w-12 mb-3" />
            <p className="text-sm">
              무엇을 도와드릴까요?<br />
              자연어로 업무를 처리해보세요.
            </p>
            <div className="mt-4 space-y-2 text-xs text-gray-400">
              <p>&ldquo;오늘 주문 몇 건이야?&rdquo;</p>
              <p>&ldquo;재고 부족 상품 보여줘&rdquo;</p>
              <p>&ldquo;ORD-001 주문 상세 알려줘&rdquo;</p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={msg.id || `msg-${i}`}
            className={`flex ${msg.role === "USER" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                msg.role === "USER"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {msg.content || (
                <span className="flex items-center gap-2 text-gray-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {toolStatus || "생각 중..."}
                </span>
              )}
            </div>
          </div>
        ))}

        {isLoading && toolStatus && messages[messages.length - 1]?.content && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-lg bg-yellow-50 px-3 py-2 text-xs text-yellow-700">
              <Loader2 className="h-3 w-3 animate-spin" />
              {toolStatus}...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-3">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요..."
            className="flex-1 rounded-md border px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-gray-50"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            className="rounded-md bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
