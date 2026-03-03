"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, X, Send, Trash2, Loader2, Copy, Check, Download, Paperclip, FileSpreadsheet, ImageIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface ChartData {
  type: "bar" | "line";
  title: string;
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
}

interface FileAttachment {
  type: "image" | "spreadsheet";
  fileName: string;
  mimeType?: string;
  base64?: string;
  fileContext?: string;
  sheetCount?: number;
  totalRows?: number;
}

interface ChatMessage {
  id?: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt?: string;
  exportInfo?: { name: string; args: Record<string, unknown> }[];
  chartData?: ChartData;
  fileName?: string;
}

export function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<FileAttachment | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingToolsRef = useRef<{ name: string; args: Record<string, unknown> }[]>([]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && !historyLoaded) loadHistory();
  }, [isOpen, historyLoaded]);

  useEffect(() => {
    if (isOpen && !isLoading) inputRef.current?.focus();
  }, [isOpen, isLoading]);

  const loadHistory = async () => {
    try {
      const res = await fetch("/api/chat/history?limit=50");
      if (!res.ok) return;
      const json = await res.json();
      if (json.data?.length) setMessages(json.data);
      setHistoryLoaded(true);
    } catch {
      setHistoryLoaded(true);
    }
  };

  const handleCopy = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExport = async (tools: { name: string; args: Record<string, unknown> }[]) => {
    try {
      const res = await fetch("/api/chat/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tools }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/chat/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error?.message || "파일 업로드 실패");
        return;
      }
      setAttachedFile(json.data);
    } catch {
      alert("파일 업로드 중 오류가 발생했습니다");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput("");
    setIsLoading(true);
    setToolStatus(null);
    pendingToolsRef.current = [];

    const currentFile = attachedFile;
    setAttachedFile(null);

    const userMsg: ChatMessage = {
      role: "USER",
      content: text,
      fileName: currentFile?.fileName,
    };
    setMessages((prev) => [...prev, userMsg]);

    const assistantMsg: ChatMessage = { role: "ASSISTANT", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          ...(currentFile && { fileContext: currentFile }),
        }),
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
        const tool = data as { name: string; args: Record<string, unknown> };
        const toolNames: Record<string, string> = {
          search_orders: "주문 검색 중",
          search_products: "상품 검색 중",
          get_dashboard_stats: "통계 조회 중",
          search_sellers: "셀러 조회 중",
          get_order_detail: "주문 상세 조회 중",
          get_recent_claims: "클레임 조회 중",
          get_sales_chart: "차트 데이터 조회 중",
          update_order_status: "주문 상태 변경 중",
          search_inquiries: "문의 내역 조회 중",
          // Admin write tools
          create_product: "상품 등록 중",
          update_product: "상품 수정 중",
          bulk_update_price: "가격 일괄 변경 중",
          input_tracking_number: "송장번호 입력 중",
          process_claim: "클레임 처리 중",
          send_notice: "공지 등록 중",
          answer_inquiry: "문의 답변 중",
          manage_seller: "셀러 관리 중",
          // Seller write tools
          create_order: "주문 등록 중",
          create_claim: "클레임 요청 중",
          create_inquiry: "문의 작성 중",
          // Phase 5 advanced tools
          upload_tracking_excel: "송장 일괄 등록 중",
          bulk_create_orders: "주문 일괄 등록 중",
          get_margin_stats: "마진율 분석 중",
          detect_anomalies: "이상 탐지 중",
        };
        setToolStatus(toolNames[tool.name] || "처리 중");
        const exportableTools = ["search_orders", "search_products", "search_sellers", "get_recent_claims", "search_inquiries"];
        if (exportableTools.includes(tool.name)) {
          pendingToolsRef.current.push({ name: tool.name, args: tool.args || {} });
        }
        break;
      }

      case "chart": {
        const chartData = data as ChartData;
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "ASSISTANT") {
            updated[updated.length - 1] = { ...last, chartData };
          }
          return updated;
        });
        break;
      }

      case "done": {
        const d = data as { messageId: string };
        const exportInfo = pendingToolsRef.current.length > 0 ? [...pendingToolsRef.current] : undefined;
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "ASSISTANT") {
            updated[updated.length - 1] = { ...last, id: d.messageId, exportInfo };
          }
          return updated;
        });
        setToolStatus(null);
        pendingToolsRef.current = [];
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
            <button onClick={handleClear} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="대화 초기화">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button onClick={() => setIsOpen(false)} className="rounded-md p-1.5 hover:bg-gray-100">
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
              <p>&ldquo;이번 달 매출 차트 보여줘&rdquo;</p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const msgId = msg.id || `msg-${i}`;
          return (
            <div key={msgId} className={`flex ${msg.role === "USER" ? "justify-end" : "justify-start"}`}>
              <div className={`group relative max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === "USER" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"
              }`}>
                {/* Attached file indicator */}
                {msg.role === "USER" && msg.fileName && (
                  <div className="mb-1 flex items-center gap-1 text-xs opacity-80">
                    {msg.fileName.match(/\.(png|jpg|jpeg|webp)$/i)
                      ? <ImageIcon className="h-3 w-3" />
                      : <FileSpreadsheet className="h-3 w-3" />}
                    {msg.fileName}
                  </div>
                )}

                {msg.content ? (
                  msg.role === "ASSISTANT" ? (
                    <div className="chat-markdown prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )
                ) : (
                  <span className="flex items-center gap-2 text-gray-400">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {toolStatus || "생각 중..."}
                  </span>
                )}

                {/* Chart */}
                {msg.chartData && (
                  <div className="mt-2 rounded border bg-white p-2">
                    <p className="mb-1 text-xs font-medium text-gray-600">{msg.chartData.title}</p>
                    <ResponsiveContainer width="100%" height={180}>
                      {msg.chartData.type === "bar" ? (
                        <BarChart data={msg.chartData.data}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey={msg.chartData.xKey} tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Bar dataKey={msg.chartData.yKey} fill="#3b82f6" />
                        </BarChart>
                      ) : (
                        <LineChart data={msg.chartData.data}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey={msg.chartData.xKey} tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Line type="monotone" dataKey={msg.chartData.yKey} stroke="#3b82f6" strokeWidth={2} />
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Action buttons for assistant messages */}
                {msg.role === "ASSISTANT" && msg.content && (
                  <div className="mt-1 flex items-center gap-1 border-t border-gray-200 pt-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => handleCopy(msg.content, msgId)}
                      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                      title="복사"
                    >
                      {copiedId === msgId ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copiedId === msgId ? "복사됨" : "복사"}
                    </button>
                    {msg.exportInfo && msg.exportInfo.length > 0 && (
                      <button
                        onClick={() => handleExport(msg.exportInfo!)}
                        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                        title="엑셀 다운로드"
                      >
                        <Download className="h-3 w-3" />
                        엑셀
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

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
        {/* File preview */}
        {attachedFile && (
          <div className="mb-2 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs">
            {attachedFile.type === "image"
              ? <ImageIcon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              : <FileSpreadsheet className="h-3.5 w-3.5 text-green-600 shrink-0" />}
            <span className="truncate flex-1 font-medium">{attachedFile.fileName}</span>
            {attachedFile.type === "spreadsheet" && (
              <span className="text-gray-500 shrink-0">{attachedFile.totalRows}행</span>
            )}
            <button
              onClick={() => setAttachedFile(null)}
              className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-blue-100 hover:text-gray-600"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md border p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600 disabled:opacity-50"
            disabled={isLoading || isUploading}
            title="파일 첨부"
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={attachedFile ? "파일에 대해 질문하세요..." : "메시지를 입력하세요..."}
            className="flex-1 rounded-md border px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-gray-50"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            className="rounded-md bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
