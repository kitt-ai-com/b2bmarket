"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, X, Send } from "lucide-react";

export function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-transform hover:scale-105"
      >
        <MessageSquare className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 top-0 z-50 flex w-96 flex-col border-l bg-white shadow-xl">
      <div className="flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-blue-600" />
          <span className="font-semibold">AI 어시스턴트</span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="rounded-md p-1 hover:bg-gray-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
          <MessageSquare className="h-12 w-12 mb-3" />
          <p className="text-sm">
            무엇을 도와드릴까요?<br />
            자연어로 업무를 처리해보세요.
          </p>
        </div>
      </div>
      <div className="border-t p-3">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="메시지를 입력하세요..."
            className="flex-1 rounded-md border px-3 py-2 text-sm outline-none focus:border-blue-500"
            disabled
          />
          <button
            className="rounded-md bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:opacity-50"
            disabled
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-gray-400">
          AI 채팅은 Phase 4에서 구현됩니다
        </p>
      </div>
    </div>
  );
}
