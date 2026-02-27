"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Search } from "lucide-react";
import { toast } from "sonner";

interface Inquiry {
  id: string;
  title: string;
  content: string;
  answer: string | null;
  status: string;
  answeredAt: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
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
  { value: "CLOSED", label: "종료" },
];

export default function AdminInquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/inquiries?${params}`);
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
  }, [pagination.page, statusFilter, search]);

  useEffect(() => { fetchInquiries(); }, [fetchInquiries]);

  const openDetail = (inq: Inquiry) => {
    setSelected(inq);
    setAnswerText(inq.answer || "");
    setDetailOpen(true);
  };

  const handleAnswer = async () => {
    if (!selected || !answerText.trim()) {
      toast.error("답변 내용을 입력해주세요");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/inquiries/${selected.id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: answerText }),
      });
      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error?.message || "답변 등록 실패");
        return;
      }
      toast.success("답변이 등록되었습니다");
      setDetailOpen(false);
      fetchInquiries();
    } catch {
      toast.error("오류가 발생했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    setSearch(searchInput);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">문의 관리</h1>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
            <div className="flex gap-2">
              <Input
                placeholder="제목, 내용, 작성자 검색"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-60"
              />
              <Button variant="outline" size="icon" onClick={handleSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
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
                    <TableHead>작성자</TableHead>
                    <TableHead>등록일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inquiries.map((inq) => {
                    const st = statusConfig[inq.status] || statusConfig.OPEN;
                    return (
                      <TableRow key={inq.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openDetail(inq)}>
                        <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                        <TableCell className="font-medium">{inq.title}</TableCell>
                        <TableCell>{inq.user.name}</TableCell>
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

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>문의 상세</DialogTitle>
            <DialogDescription>{selected?.user.name} ({selected?.user.email})</DialogDescription>
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
              <div className="text-xs text-gray-400">
                등록일: {new Date(selected.createdAt).toLocaleString("ko-KR")}
                {selected.answeredAt && ` | 답변일: ${new Date(selected.answeredAt).toLocaleString("ko-KR")}`}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500 mb-1">답변</div>
                <Textarea
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="답변을 입력하세요"
                  rows={4}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>닫기</Button>
            <Button onClick={handleAnswer} disabled={submitting || !answerText.trim()}>
              {submitting ? "등록 중..." : "답변 등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
