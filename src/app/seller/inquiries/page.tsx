"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface Inquiry {
  id: string;
  title: string;
  content: string;
  answer: string | null;
  status: string;
  answeredAt: string | null;
  createdAt: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  OPEN: { label: "미답변", variant: "destructive" },
  ANSWERED: { label: "답변완료", variant: "default" },
  CLOSED: { label: "종료", variant: "secondary" },
};

const statusTabs = [
  { value: "", label: "전체" },
  { value: "OPEN", label: "미답변" },
  { value: "ANSWERED", label: "답변완료" },
];

export default function SellerInquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  // 문의 작성
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [creating, setCreating] = useState(false);

  // 상세 보기
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Inquiry | null>(null);

  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/seller/inquiries?${params}`);
      const json = await res.json();
      if (res.ok) {
        setInquiries(json.data);
        setPagination((prev) => ({ ...prev, total: json.pagination.total, totalPages: json.pagination.totalPages }));
      }
    } catch {
      toast.error("문의 목록을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, statusFilter]);

  useEffect(() => { fetchInquiries(); }, [fetchInquiries]);

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("제목과 내용을 입력해주세요");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/seller/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error?.message || "등록 실패");
        return;
      }
      toast.success("문의가 등록되었습니다");
      setCreateOpen(false);
      setTitle("");
      setContent("");
      fetchInquiries();
    } catch {
      toast.error("오류가 발생했습니다");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">문의</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          문의 작성
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex gap-1 flex-wrap">
            {statusTabs.map((tab) => (
              <Button
                key={tab.value}
                variant={statusFilter === tab.value ? "default" : "outline"}
                size="sm"
                onClick={() => { setStatusFilter(tab.value); setPagination((prev) => ({ ...prev, page: 1 })); }}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-gray-500">로딩 중...</div>
          ) : inquiries.length === 0 ? (
            <div className="py-8 text-center text-gray-500">문의가 없습니다</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>상태</TableHead>
                    <TableHead>제목</TableHead>
                    <TableHead>등록일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inquiries.map((inq) => {
                    const st = statusConfig[inq.status] || statusConfig.OPEN;
                    return (
                      <TableRow key={inq.id} className="cursor-pointer hover:bg-gray-50" onClick={() => { setSelected(inq); setDetailOpen(true); }}>
                        <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                        <TableCell className="font-medium">{inq.title}</TableCell>
                        <TableCell className="text-sm text-gray-500">{new Date(inq.createdAt).toLocaleDateString("ko-KR")}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {pagination.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}>이전</Button>
                  <span className="text-sm text-gray-500">{pagination.page} / {pagination.totalPages}</span>
                  <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}>다음</Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 문의 작성 다이얼로그 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>문의 작성</DialogTitle>
            <DialogDescription>궁금한 점을 남겨주시면 관리자가 답변드립니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>제목</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="문의 제목" />
            </div>
            <div className="space-y-2">
              <Label>내용</Label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="문의 내용을 입력하세요" rows={5} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>취소</Button>
            <Button onClick={handleCreate} disabled={creating}>{creating ? "등록 중..." : "등록"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 상세 보기 다이얼로그 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>문의 상세</DialogTitle>
            <DialogDescription>
              {selected && new Date(selected.createdAt).toLocaleString("ko-KR")}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 py-2">
              <div>
                <div className="text-sm font-medium text-gray-500 mb-1">제목</div>
                <div className="font-medium">{selected.title}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500 mb-1">내용</div>
                <div className="whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm">{selected.content}</div>
              </div>
              {selected.answer ? (
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-1">답변</div>
                  <div className="whitespace-pre-wrap rounded bg-blue-50 p-3 text-sm">{selected.answer}</div>
                  <div className="mt-1 text-xs text-gray-400">
                    답변일: {selected.answeredAt && new Date(selected.answeredAt).toLocaleString("ko-KR")}
                  </div>
                </div>
              ) : (
                <div className="rounded bg-yellow-50 p-3 text-sm text-yellow-700">아직 답변이 등록되지 않았습니다.</div>
              )}
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
