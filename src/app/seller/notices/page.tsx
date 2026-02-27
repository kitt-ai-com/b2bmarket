"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Notice {
  id: string;
  title: string;
  content: string;
  isImportant: boolean;
  createdAt: string;
}

export default function SellerNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Notice | null>(null);

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      const res = await fetch(`/api/seller/notices?${params}`);
      const json = await res.json();
      if (res.ok) {
        setNotices(json.data);
        setPagination((prev) => ({ ...prev, total: json.pagination.total, totalPages: json.pagination.totalPages }));
      }
    } catch {
      toast.error("공지사항을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, [pagination.page]);

  useEffect(() => { fetchNotices(); }, [fetchNotices]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">공지사항</h1>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="py-8 text-center text-gray-500">로딩 중...</div>
          ) : notices.length === 0 ? (
            <div className="py-8 text-center text-gray-500">공지사항이 없습니다</div>
          ) : (
            <div className="space-y-2">
              {notices.map((notice) => (
                <div
                  key={notice.id}
                  className="flex items-start gap-3 rounded-lg border p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => { setSelected(notice); setDetailOpen(true); }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {notice.isImportant && <Badge variant="destructive" className="text-xs">중요</Badge>}
                      <span className="text-sm font-medium">{notice.title}</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">{new Date(notice.createdAt).toLocaleDateString("ko-KR")}</p>
                  </div>
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

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selected?.isImportant && <Badge variant="destructive">중요</Badge>}
              {selected?.title}
            </DialogTitle>
            <DialogDescription>{selected && new Date(selected.createdAt).toLocaleDateString("ko-KR")}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="whitespace-pre-wrap rounded bg-gray-50 p-4 text-sm">
              {selected.content}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
