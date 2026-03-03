"use client";

import { signOut, useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, LogOut, User, CheckCheck } from "lucide-react";
import Link from "next/link";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

const typeLabel: Record<string, string> = {
  ORDER_NEW: "주문",
  TRACKING_UPDATED: "송장",
  PRICE_CHANGED: "가격",
  STOCK_LOW: "재고",
  CLAIM_NEW: "클레임",
  SETTLEMENT_READY: "정산",
  NOTICE: "공지",
  SYSTEM: "시스템",
};

export function TopHeader() {
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const role = (session?.user as Record<string, unknown>)?.role as string;
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
  const notificationsPage = isAdmin ? "/admin/notifications" : "/seller/notifications";

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=5");
      if (!res.ok) return;
      const json = await res.json();
      setNotifications(json.data?.slice(0, 5) || []);
      setUnreadCount(json.unreadCount || 0);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (session?.user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [session, fetchNotifications]);

  const markAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      fetchNotifications();
    } catch {
      // ignore
    }
  };

  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-4">
      <div />
      <div className="flex items-center gap-3">
        <DropdownMenu onOpenChange={(open) => { if (open) fetchNotifications(); }}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-sm font-semibold">알림</span>
              {unreadCount > 0 && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); markAllRead(); }}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                >
                  <CheckCheck className="h-3 w-3" /> 모두 읽음
                </button>
              )}
            </div>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="py-4 text-center text-sm text-gray-400">알림이 없습니다</div>
            ) : (
              notifications.map((n) => (
                <DropdownMenuItem key={n.id} className={`flex flex-col items-start gap-0.5 px-3 py-2 ${!n.isRead ? "bg-blue-50" : ""}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-gray-100 px-1 py-0.5 text-[10px] font-medium text-gray-600">
                      {typeLabel[n.type] || n.type}
                    </span>
                    <span className="text-xs font-medium truncate">{n.title}</span>
                    {!n.isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />}
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-1">{n.message}</p>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={notificationsPage} className="w-full justify-center text-xs text-blue-600">
                전체 알림 보기
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs">
                  {session?.user?.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{session?.user?.name || "사용자"}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              내 정보
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut className="mr-2 h-4 w-4" />
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
