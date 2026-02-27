"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";

interface Notification {
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

export default function SellerNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      if (showUnreadOnly) params.set("unread", "true");

      const res = await fetch(`/api/seller/notifications?${params}`);
      const json = await res.json();
      if (res.ok) {
        setNotifications(json.data);
        setUnreadCount(json.unreadCount);
        setPagination((prev) => ({ ...prev, total: json.pagination.total, totalPages: json.pagination.totalPages }));
      }
    } catch {
      toast.error("알림을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, showUnreadOnly]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markAllRead = async () => {
    try {
      await fetch("/api/seller/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      toast.success("모두 읽음 처리되었습니다");
      fetchNotifications();
    } catch {
      toast.error("오류가 발생했습니다");
    }
  };

  const markRead = async (id: string) => {
    try {
      await fetch("/api/seller/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      fetchNotifications();
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">알림</h1>
          {unreadCount > 0 && (
            <Badge variant="destructive">{unreadCount}개 미읽음</Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant={showUnreadOnly ? "default" : "outline"}
            size="sm"
            onClick={() => { setShowUnreadOnly(!showUnreadOnly); setPagination((prev) => ({ ...prev, page: 1 })); }}
          >
            미읽음만
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <CheckCheck className="mr-1 h-4 w-4" />
              모두 읽음
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="py-8 text-center text-gray-500">로딩 중...</div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center text-gray-500">알림이 없습니다</div>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 rounded-lg border p-4 transition-colors ${
                    n.isRead ? "bg-white" : "bg-blue-50 border-blue-200"
                  }`}
                  onClick={() => !n.isRead && markRead(n.id)}
                  role={n.isRead ? undefined : "button"}
                >
                  <Bell className={`mt-0.5 h-4 w-4 shrink-0 ${n.isRead ? "text-gray-400" : "text-blue-500"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{typeLabel[n.type] || n.type}</Badge>
                      <span className="text-sm font-medium">{n.title}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{n.message}</p>
                    <p className="mt-1 text-xs text-gray-400">{new Date(n.createdAt).toLocaleString("ko-KR")}</p>
                  </div>
                  {!n.isRead && <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                </div>
              ))}
            </div>
          )}

          {pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}>이전</Button>
              <span className="text-sm text-gray-500">{pagination.page} / {pagination.totalPages}</span>
              <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}>다음</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
